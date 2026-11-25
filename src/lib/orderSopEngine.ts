import { createClient } from 'next-sanity'
import {
  sendWhatsAppNotification,
  buildAdminProgressLogMessage,
  buildCourierOfferMessage,
  buildBuyerStatusMessage,
} from '@/sanity/lib/whatsapp'
import { pickNextRoundRobinCourier } from '@/lib/courierAssigner'
import { syncDailyCourierSettlements } from '@/lib/courierFinanceEngine'

export interface SopConfig {
  isSopAutoEnabled: boolean
  sopPendingCancelHours: number
  sopStuckWarningHours: number
  sopDeliveredCompleteHours: number
  sopProcessingCancelHours: number
  sopCourierTimeoutMinutes: number
  sopLastRunAt?: string | null
  adminPhone?: string
}

export interface SopCandidate {
  _id: string
  orderNumber: string
  customerName: string
  customerPhone?: string
  customerId?: string
  paymentMethod?: string
  paymentStatus?: string
  status: string
  ageHours: number
  isLegacySilent: boolean
  action: 'auto_cancel_pending' | 'auto_complete_delivered' | 'auto_cancel_stuck'
  reason: string
}

export interface SopEvaluationResult {
  skipped?: boolean
  skipReason?: string
  dryRun: boolean
  evaluatedAt: string
  config: SopConfig
  candidates: SopCandidate[]
  courierSkippedCount?: number
  counts: {
    cancelPending: number
    completeDelivered: number
    cancelStuck: number
    totalAffected: number
    waSent: number
  }
}

const DEFAULT_SOP: SopConfig = {
  isSopAutoEnabled: true,
  sopPendingCancelHours: 24,
  sopStuckWarningHours: 4,
  sopDeliveredCompleteHours: 24,
  sopProcessingCancelHours: 48,
  sopCourierTimeoutMinutes: 5,
}

function getWriteClient() {
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    apiVersion: '2026-02-01',
    useCdn: false,
    token: process.env.SANITY_API_WRITE_TOKEN,
  })
}

function getHumanActionSummary(candidate: SopCandidate): string {
  if (candidate.action === 'auto_cancel_pending') {
    return `Batal otomatis (belum dikonfirmasi melebihi ${candidate.ageHours} jam)`
  }
  if (candidate.action === 'auto_complete_delivered') {
    return `Selesai otomatis (barang sudah diserahkan > ${candidate.ageHours} jam)`
  }
  return `Tutup otomatis (proses melewati batas waktu ${candidate.ageHours} jam)`
}

export function classifyOrderForSop(
  order: any,
  config: SopConfig,
  nowMs: number = Date.now()
): SopCandidate | null {
  const createdMs = new Date(order._createdAt).getTime()
  const updatedMs = new Date(order._updatedAt || order._createdAt).getTime()
  if (Number.isNaN(createdMs)) return null

  const ageSinceCreatedHours = (nowMs - createdMs) / 3600000
  const ageSinceUpdatedHours = (nowMs - updatedMs) / 3600000
  const isLegacySilent = ageSinceCreatedHours > 168

  if (order.status === 'pending') {
    if (ageSinceCreatedHours >= config.sopPendingCancelHours) {
      const labelMethod = order.paymentMethod === 'qris' ? 'QRIS' : 'COD'
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName || 'Warga',
        customerPhone: order.customerPhone,
        customerId: order.customerId,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        ageHours: Math.round(ageSinceCreatedHours),
        isLegacySilent,
        action: 'auto_cancel_pending',
        reason: `Batal otomatis: Pesanan ${labelMethod} belum dikonfirmasi melebihi ${config.sopPendingCancelHours} jam`,
      }
    }
    return null
  }

  if (order.status === 'delivered') {
    if (ageSinceUpdatedHours >= config.sopDeliveredCompleteHours) {
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName || 'Warga',
        customerPhone: order.customerPhone,
        customerId: order.customerId,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        ageHours: Math.round(ageSinceUpdatedHours),
        isLegacySilent,
        action: 'auto_complete_delivered',
        reason: `Selesai otomatis: Pesanan sudah diserahkan lebih dari ${config.sopDeliveredCompleteHours} jam`,
      }
    }
    return null
  }

  if (['accepted', 'processing', 'shipped', 'delivering'].includes(order.status)) {
    if (ageSinceUpdatedHours >= config.sopProcessingCancelHours) {
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName || 'Warga',
        customerPhone: order.customerPhone,
        customerId: order.customerId,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
        ageHours: Math.round(ageSinceUpdatedHours),
        isLegacySilent,
        action: 'auto_cancel_stuck',
        reason: `Tutup otomatis: Pesanan tidak dilanjutkan melebihi ${config.sopProcessingCancelHours} jam`,
      }
    }
  }

  return null
}

/**
 * Mengevaluasi batas waktu respons kurir (Auto-Skip Round-Robin).
 * Jika kurir saat ini belum mengklik Terima Order melebihi `sopCourierTimeoutMinutes`,
 * penawaran otomatis dialihkan ke kurir aktif berikutnya.
 */
export async function runCourierTimeoutCheck(options: {
  dryRun?: boolean
  nowMs?: number
} = {}): Promise<{ skippedCount: number; alerts: string[] }> {
  const { dryRun = false, nowMs = Date.now() } = options
  const client = getWriteClient()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawon.pondokrejo.id'

  const rawSettings = await client.fetch(
    `*[_type == "appSettings"] | order(_updatedAt desc)[0]{ adminPhone, isSopAutoEnabled, sopCourierTimeoutMinutes }`,
    {},
    { cache: 'no-store' }
  )

  if (rawSettings?.isSopAutoEnabled === false) {
    return { skippedCount: 0, alerts: [] }
  }

  const timeoutMinutes = Math.max(
    1,
    Number(rawSettings?.sopCourierTimeoutMinutes) || DEFAULT_SOP.sopCourierTimeoutMinutes
  )
  const adminPhone = rawSettings?.adminPhone || '+62895325586281'

  const offeredOrders: any[] =
    (await client.fetch(
      `*[_type == "order" && !(_id in path("drafts.**")) && status in ["processing", "shipped"] && defined(courierOfferedAt)]{
        _id,
        _rev,
        status,
        orderNumber,
        customerName,
        deliveryAddress,
        paymentMethod,
        totalAmount,
        courierOfferedAt,
        rejectedCourierIds,
        courier->{_id, name, phone},
        items[]{ quantity, product->{name, vendor->{name}} }
      }`,
      {},
      { cache: 'no-store' }
    )) || []

  let skippedCount = 0
  const alerts: string[] = []
  const nowIso = new Date(nowMs).toISOString()

  for (const ord of offeredOrders) {
    const offeredMs = new Date(ord.courierOfferedAt).getTime()
    if (Number.isNaN(offeredMs)) continue
    const elapsedMinutes = (nowMs - offeredMs) / 60000
    if (elapsedMinutes < timeoutMinutes) continue

    if (dryRun) {
      skippedCount++
      continue
    }

    const cleanOrderId = String(ord._id).replace(/^drafts\./, '')
    const currentCourierId = ord.courier?._id
    const currentCourierName = ord.courier?.name || 'Kurir sebelumnya'
    const currentCourierPhone = ord.courier?.phone
    const prevRejected: string[] = Array.isArray(ord.rejectedCourierIds)
      ? ord.rejectedCourierIds
      : []
    const nextRejected = currentCourierId
      ? Array.from(new Set([...prevRejected, currentCourierId]))
      : prevRejected

    const rrNext = await pickNextRoundRobinCourier(client, nextRejected)

    // Kunci atomik via _rev agar beberapa proses server tidak mengirim WA ganda
    try {
      let lockPatch = client.patch(cleanOrderId)
      if (ord._rev && typeof lockPatch.ifRevisionId === 'function') {
        lockPatch = lockPatch.ifRevisionId(ord._rev)
      }
      if (rrNext.courier) {
        await lockPatch
          .set({
            courier: { _type: 'reference', _ref: rrNext.courier._id },
            courierOfferedAt: nowIso,
            rejectedCourierIds: nextRejected,
          })
          .commit()
      } else {
        await lockPatch
          .set({
            courierOfferedAt: null,
            rejectedCourierIds: nextRejected,
          })
          .unset(['courier'])
          .commit()
      }
    } catch {
      // Sudah diproses oleh worker/proses server lain
      continue
    }

    skippedCount++

    if (currentCourierPhone) {
      await sendWhatsAppNotification(
        currentCourierPhone,
        `*PAWON PONDOKREJO - PENGALIHAN GILIRAN*\n--------------------------------\nPenawaran pengantaran pesanan ${ord.orderNumber} dilewati otomatis karena melewati batas waktu respons (${timeoutMinutes} menit).`
      )
    }

    if (rrNext.courier) {
      const offerMsg = buildCourierOfferMessage({
        baseUrl,
        orderNumber: ord.orderNumber,
        courierId: rrNext.courier._id,
        courierName: rrNext.courier.name,
        customerName: ord.customerName,
        deliveryAddress: ord.deliveryAddress,
        paymentMethod: ord.paymentMethod === 'qris' ? 'qris' : 'cod',
        totalAmount: ord.totalAmount || 0,
        items: (ord.items || []).map((i: any) => ({
          name: i.product?.name || 'Produk',
          quantity: i.quantity || 1,
          vendorName: i.product?.vendor?.name,
        })),
        notice: `Dialihkan otomatis karena ${currentCourierName} tidak merespons dalam ${timeoutMinutes} menit.`,
      })
      await sendWhatsAppNotification(rrNext.courier.phone, offerMsg)

      const noteText = `${currentCourierName} tidak merespons (${timeoutMinutes} menit), tugas dialihkan ke ${rrNext.courier.name}.`
      alerts.push(`${ord.orderNumber}: ${noteText}`)
      await sendWhatsAppNotification(
        adminPhone,
        buildAdminProgressLogMessage({
          orderNumber: ord.orderNumber,
          customerName: ord.customerName,
          stageLabel: 'Pengalihan Otomatis Antrean Kurir',
          detail: noteText,
        })
      )
    } else {
      const noteText = `${currentCourierName} tidak merespons dan seluruh kurir aktif sudah melewati antrean. Mohon tugaskan lewat Pusat Kendali Admin.`
      alerts.push(`${ord.orderNumber}: ${noteText}`)
      await sendWhatsAppNotification(
        adminPhone,
        buildAdminProgressLogMessage({
          orderNumber: ord.orderNumber,
          customerName: ord.customerName,
          stageLabel: 'Perlu Penugasan Kurir Admin',
          detail: noteText,
        })
      )
    }
  }

  return { skippedCount, alerts }
}

/**
 * Menjalankan evaluasi & eksekusi penutupan pesanan otomatis + skip antrean kurir.
 */
export async function runOrderSopEvaluation(options: {
  dryRun?: boolean
  force?: boolean
  sendWaForRecent?: boolean
  nowMs?: number
} = {}): Promise<SopEvaluationResult> {
  const {
    dryRun = false,
    force = false,
    sendWaForRecent = true,
    nowMs = Date.now(),
  } = options

  const client = getWriteClient()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawon.pondokrejo.id'
  const evaluatedAt = new Date(nowMs).toISOString()

  const rawSettings = await client.fetch(
    `*[_type == "appSettings"] | order(_updatedAt desc)[0]{
      _id,
      adminPhone,
      isSopAutoEnabled,
      sopPendingCancelHours,
      sopStuckWarningHours,
      sopDeliveredCompleteHours,
      sopProcessingCancelHours,
      sopCourierTimeoutMinutes,
      sopLastRunAt
    }`,
    {},
    { cache: 'no-store' }
  )

  const config: SopConfig = {
    isSopAutoEnabled: rawSettings?.isSopAutoEnabled !== false,
    sopPendingCancelHours:
      Number(rawSettings?.sopPendingCancelHours) || DEFAULT_SOP.sopPendingCancelHours,
    sopStuckWarningHours:
      Number(rawSettings?.sopStuckWarningHours) || DEFAULT_SOP.sopStuckWarningHours,
    sopDeliveredCompleteHours:
      Number(rawSettings?.sopDeliveredCompleteHours) ||
      DEFAULT_SOP.sopDeliveredCompleteHours,
    sopProcessingCancelHours:
      Number(rawSettings?.sopProcessingCancelHours) ||
      DEFAULT_SOP.sopProcessingCancelHours,
    sopCourierTimeoutMinutes:
      Number(rawSettings?.sopCourierTimeoutMinutes) ||
      DEFAULT_SOP.sopCourierTimeoutMinutes,
    sopLastRunAt: rawSettings?.sopLastRunAt || null,
    adminPhone: rawSettings?.adminPhone || '+62895325586281',
  }

  if (!config.isSopAutoEnabled && !force) {
    return {
      skipped: true,
      skipReason: 'Penutupan pesanan otomatis sedang dinonaktifkan di pengaturan.',
      dryRun,
      evaluatedAt,
      config,
      candidates: [],
      counts: {
        cancelPending: 0,
        completeDelivered: 0,
        cancelStuck: 0,
        totalAffected: 0,
        waSent: 0,
      },
    }
  }

  // Distributed lock cooldown 9 menit bila dijalankan periodik tanpa force
  if (!dryRun && !force && config.sopLastRunAt) {
    const lastRunMs = new Date(config.sopLastRunAt).getTime()
    if (!Number.isNaN(lastRunMs)) {
      const diffMinutes = (nowMs - lastRunMs) / 60000
      if (diffMinutes < 9) {
        return {
          skipped: true,
          skipReason: `Sudah dijalankan ${diffMinutes.toFixed(1)} menit lalu.`,
          dryRun,
          evaluatedAt,
          config,
          candidates: [],
          counts: {
            cancelPending: 0,
            completeDelivered: 0,
            cancelStuck: 0,
            totalAffected: 0,
            waSent: 0,
          },
        }
      }
    }
  }

  // 1. Cek antrean kurir yang melewati batas menit respons lebih dulu
  const courierSkipRes = await runCourierTimeoutCheck({ dryRun, nowMs })

  // 2. Cek pesanan yang melewati batas waktu jam penyelesaian/pembatalan
  const openOrders = await client.fetch(
    `*[_type == "order" && !(_id in path("drafts.**")) && status in ["pending", "accepted", "processing", "shipped", "delivering", "delivered"]]{
      _id,
      orderNumber,
      customerName,
      customerPhone,
      "customerId": customer._ref,
      paymentMethod,
      paymentStatus,
      status,
      _createdAt,
      _updatedAt
    }`,
    {},
    { cache: 'no-store' }
  )

  const candidates: SopCandidate[] = []
  for (const ord of openOrders || []) {
    const c = classifyOrderForSop(ord, config, nowMs)
    if (c) candidates.push(c)
  }

  let waSent = 0
  if (!dryRun) {
    const settingsId = rawSettings?._id?.replace(/^drafts\./, '') || 'appSettings'
    await client
      .patch(settingsId)
      .set({ sopLastRunAt: evaluatedAt })
      .commit()
      .catch(() => {})

    for (const item of candidates) {
      const cleanId = item._id.replace(/^drafts\./, '')
      if (item.action === 'auto_complete_delivered') {
        const updates: Record<string, any> = {
          status: 'completed',
          completedAt: evaluatedAt,
          autoResolutionReason: item.reason,
          courierOfferedAt: null,
        }
        if (item.paymentMethod !== 'qris') {
          updates.paymentStatus = 'paid'
        }
        await client.patch(cleanId).set(updates).commit()

        if (item.customerId) {
          await client
            .patch(item.customerId.replace(/^drafts\./, ''))
            .setIfMissing({ successfulOrders: 0 })
            .inc({ successfulOrders: 1 })
            .commit()
            .catch(() => {})
        }

        if (sendWaForRecent && !item.isLegacySilent && item.customerPhone) {
          await sendWhatsAppNotification(
            item.customerPhone,
            buildBuyerStatusMessage({
              baseUrl,
              orderNumber: item.orderNumber,
              customerName: item.customerName,
              headline: 'PESANAN SELESAI OTOMATIS',
              body: `Pesanan Anda telah ditandai selesai karena barang sudah diserahkan lebih dari ${config.sopDeliveredCompleteHours} jam. Terima kasih telah berbelanja di PAWON Pondokrejo.`,
            })
          )
          waSent++
        }
      } else {
        await client
          .patch(cleanId)
          .set({
            status: 'cancelled',
            autoResolutionReason: item.reason,
            courierOfferedAt: null,
          })
          .commit()

        if (sendWaForRecent && !item.isLegacySilent && item.customerPhone) {
          await sendWhatsAppNotification(
            item.customerPhone,
            buildBuyerStatusMessage({
              baseUrl,
              orderNumber: item.orderNumber,
              customerName: item.customerName,
              headline: 'PESANAN DIBATALKAN OTOMATIS',
              body: `Pesanan Anda dibatalkan otomatis (${item.reason}). Silakan pesan kembali bila Anda masih membutuhkannya.`,
            })
          )
          waSent++
        }
      }
    }

    const recentClosed = candidates.filter((c) => !c.isLegacySilent)
    if (sendWaForRecent && recentClosed.length > 0 && config.adminPhone) {
      const summaryLines = recentClosed
        .slice(0, 10)
        .map((c) => `- ${c.orderNumber} (${c.customerName}): ${getHumanActionSummary(c)}`)
        .join('\n')
      await sendWhatsAppNotification(
        config.adminPhone,
        `*PAWON PONDOKREJO - RINGKASAN PENUTUPAN OTOMATIS*\n--------------------------------\nTerdapat ${recentClosed.length} pesanan yang melewati batas waktu dan ditutup otomatis:\n${summaryLines}`
      )
      waSent++
    }
  }

  // 3. Sinkronkan laporan setoran kas kurir harian (cutoff 16.00 WIB & batas 2x24 jam)
  await syncDailyCourierSettlements({ dryRun, nowMs }).catch((err) => {
    console.error('[PAWON Settlement Sync] Error:', err)
  })

  const cancelPending = candidates.filter(
    (c) => c.action === 'auto_cancel_pending'
  ).length
  const completeDelivered = candidates.filter(
    (c) => c.action === 'auto_complete_delivered'
  ).length
  const cancelStuck = candidates.filter(
    (c) => c.action === 'auto_cancel_stuck'
  ).length

  return {
    dryRun,
    evaluatedAt,
    config,
    candidates,
    courierSkippedCount: courierSkipRes.skippedCount,
    counts: {
      cancelPending,
      completeDelivered,
      cancelStuck,
      totalAffected: candidates.length,
      waSent,
    },
  }
}
