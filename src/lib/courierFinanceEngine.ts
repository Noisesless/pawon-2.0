import {
  sendWhatsAppNotification,
  buildSettlementNotificationMessage,
} from '@/sanity/lib/whatsapp'
import { APP_SETTINGS_QUERY } from '@/sanity/lib/queries'

export interface FinanceConfig {
  defaultShippingFee: number
  courierCommissionAmount: number
  kalurahanFeeAmount: number
  defaultCourierFloatCash: number
  dailySettlementCutoffHour: number
  maxSettlementDelayHours: number
  financeLedgerStartedAt?: string | null
  adminPhone?: string
}

export const DEFAULT_FINANCE_CONFIG: FinanceConfig = {
  defaultShippingFee: 6000,
  courierCommissionAmount: 4000,
  kalurahanFeeAmount: 2000,
  defaultCourierFloatCash: 100000,
  dailySettlementCutoffHour: 16,
  maxSettlementDelayHours: 48,
  financeLedgerStartedAt: null,
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

export function isOrderEligibleForCashLedger(
  order: { completedAt?: string; _updatedAt?: string; _createdAt?: string },
  ledgerStartedAt?: string | null
): boolean {
  if (!ledgerStartedAt) return true
  const startMs = new Date(ledgerStartedAt).getTime()
  if (Number.isNaN(startMs)) return true
  const ordMs = new Date(order.completedAt || order._updatedAt || order._createdAt || 0).getTime()
  if (Number.isNaN(ordMs)) return false
  return ordMs >= startMs
}

export function resolveFinanceConfig(rawSettings: any): FinanceConfig {
  const shippingFee =
    typeof rawSettings?.defaultShippingFee === 'number'
      ? Math.max(0, rawSettings.defaultShippingFee)
      : DEFAULT_FINANCE_CONFIG.defaultShippingFee

  const commission =
    typeof rawSettings?.courierCommissionAmount === 'number'
      ? Math.max(0, rawSettings.courierCommissionAmount)
      : Math.min(DEFAULT_FINANCE_CONFIG.courierCommissionAmount, shippingFee)

  const kalurahanFee =
    typeof rawSettings?.kalurahanFeeAmount === 'number'
      ? Math.max(0, rawSettings.kalurahanFeeAmount)
      : Math.max(0, shippingFee - commission)

  return {
    defaultShippingFee: shippingFee,
    courierCommissionAmount: commission,
    kalurahanFeeAmount: kalurahanFee,
    defaultCourierFloatCash:
      typeof rawSettings?.defaultCourierFloatCash === 'number'
        ? Math.max(0, rawSettings.defaultCourierFloatCash)
        : DEFAULT_FINANCE_CONFIG.defaultCourierFloatCash,
    dailySettlementCutoffHour: Math.min(
      23,
      Math.max(0, Number(rawSettings?.dailySettlementCutoffHour ?? 16))
    ),
    maxSettlementDelayHours: Math.max(
      1,
      Number(rawSettings?.maxSettlementDelayHours ?? 48)
    ),
    financeLedgerStartedAt: rawSettings?.financeLedgerStartedAt || null,
    adminPhone: rawSettings?.adminPhone || '+62895325586281',
  }
}

export function getWibParts(tsMs: number): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  dateKey: string
} {
  const shifted = new Date(tsMs + WIB_OFFSET_MS)
  const year = shifted.getUTCFullYear()
  const month = shifted.getUTCMonth() + 1
  const day = shifted.getUTCDate()
  const hour = shifted.getUTCHours()
  const minute = shifted.getUTCMinutes()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    year,
    month,
    day,
    hour,
    minute,
    dateKey: `${year}-${pad(month)}-${pad(day)}`,
  }
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const baseUtc = Date.UTC(y, m - 1, d, 12, 0, 0) + days * 86400000
  const next = new Date(baseUtc)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

export function wibDateHourToIso(dateKey: string, hourWib: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const utcMs = Date.UTC(y, m - 1, d, hourWib, 0, 0) - WIB_OFFSET_MS
  return new Date(utcMs).toISOString()
}

/**
 * Menentukan periode buku harian (WIB) untuk pesanan selesai.
 * Pesanan selesai sebelum jam cutoff (default 16:00 WIB) masuk periode hari itu;
 * pesanan >= 16:00 WIB otomatis masuk buku periode esok hari.
 */
export function assignOrderSettlementPeriodKey(
  completedIso: string,
  cutoffHourWib = 16
): string {
  const ts = new Date(completedIso).getTime()
  const safeMs = Number.isNaN(ts) ? Date.now() : ts
  const wib = getWibParts(safeMs)
  if (wib.hour >= cutoffHourWib) {
    return addDaysToDateKey(wib.dateKey, 1)
  }
  return wib.dateKey
}

export function isCutoffPassedForPeriod(
  periodKey: string,
  nowMs: number,
  cutoffHourWib = 16
): boolean {
  const cutoffMs = new Date(wibDateHourToIso(periodKey, cutoffHourWib)).getTime()
  return nowMs >= cutoffMs
}

export function computeOrderFinanceSnapshot(
  order: {
    orderCategory?: string
    totalAmount?: number
    shippingFee?: number
    productSubtotal?: number
    courierCommissionAmount?: number
    kalurahanFeeAmount?: number
    items?: Array<{ price?: number; quantity?: number }>
  },
  config: FinanceConfig,
  courierFloatCash?: number
): {
  productSubtotal: number
  shippingFee: number
  courierCommissionAmount: number
  kalurahanFeeAmount: number
  exceededFloatCash: boolean
} {
  if (order.orderCategory === 'service') {
    return {
      productSubtotal: Number(order.totalAmount || 0),
      shippingFee: 0,
      courierCommissionAmount: 0,
      kalurahanFeeAmount: 0,
      exceededFloatCash: false,
    }
  }

  const shippingFee = Number(order.shippingFee ?? config.defaultShippingFee)
  const itemsSum = Array.isArray(order.items)
    ? order.items.reduce(
        (acc, it) => acc + Number(it?.price || 0) * Number(it?.quantity || 0),
        0
      )
    : 0

  const productSubtotal =
    typeof order.productSubtotal === 'number'
      ? Math.max(0, order.productSubtotal)
      : itemsSum > 0
        ? itemsSum
        : Math.max(0, Number(order.totalAmount || 0) - shippingFee)

  let courierCommissionAmount: number
  let kalurahanFeeAmount: number

  if (typeof order.courierCommissionAmount === 'number') {
    courierCommissionAmount = Math.max(0, order.courierCommissionAmount)
    kalurahanFeeAmount =
      typeof order.kalurahanFeeAmount === 'number'
        ? Math.max(0, order.kalurahanFeeAmount)
        : Math.max(0, shippingFee - courierCommissionAmount)
  } else if (shippingFee <= 0) {
    courierCommissionAmount = 0
    kalurahanFeeAmount = 0
  } else if (shippingFee === config.defaultShippingFee) {
    courierCommissionAmount = Math.min(config.courierCommissionAmount, shippingFee)
    kalurahanFeeAmount = Math.max(0, shippingFee - courierCommissionAmount)
  } else {
    // Jika ongkir order lama berbeda (mis. 5000), proporsional atau ikuti batas aman
    courierCommissionAmount = Math.min(config.courierCommissionAmount, shippingFee)
    kalurahanFeeAmount = Math.max(0, shippingFee - courierCommissionAmount)
  }

  const floatRef = courierFloatCash ?? config.defaultCourierFloatCash
  return {
    productSubtotal,
    shippingFee,
    courierCommissionAmount,
    kalurahanFeeAmount,
    exceededFloatCash: productSubtotal > floatRef,
  }
}

export interface CourierLedgerSummary {
  openingFloatCash: number
  orderCount: number
  orderNumbers: string[]
  codOrderTotal: number
  qrisOrderTotal: number
  sellerCashPaid: number
  courierCommissionTotal: number
  kalurahanFeeTotal: number
  endingCashInHand: number
  kurirOutOfPocket: number
  netContinueNextDay: number
  netFullClose: number
  hasTalanganOrder: boolean
}

export function computeCourierLedgerSummary(
  orders: any[],
  openingFloatCash: number,
  config: FinanceConfig
): CourierLedgerSummary {
  let codOrderTotal = 0
  let qrisOrderTotal = 0
  let sellerCashPaid = 0
  let courierCommissionTotal = 0
  let kalurahanFeeTotal = 0
  let hasTalanganOrder = false
  const orderNumbers: string[] = []

  for (const ord of orders) {
    if (!ord || ord.orderCategory === 'service') continue
    if (ord.orderNumber) orderNumbers.push(ord.orderNumber)

    const snap = computeOrderFinanceSnapshot(ord, config, openingFloatCash)
    const grandTotal = Number(ord.totalAmount ?? snap.productSubtotal + snap.shippingFee)

    sellerCashPaid += snap.productSubtotal
    courierCommissionTotal += snap.courierCommissionAmount
    kalurahanFeeTotal += snap.kalurahanFeeAmount
    if (snap.exceededFloatCash) hasTalanganOrder = true

    if (ord.paymentMethod === 'qris') {
      qrisOrderTotal += grandTotal
    } else {
      codOrderTotal += grandTotal
    }
  }

  const endingCashInHand = openingFloatCash - sellerCashPaid + codOrderTotal
  const kurirOutOfPocket = Math.max(0, -endingCashInHand)
  if (kurirOutOfPocket > 0) hasTalanganOrder = true

  const netContinueNextDay = codOrderTotal - sellerCashPaid - courierCommissionTotal
  const netFullClose = endingCashInHand - courierCommissionTotal

  return {
    openingFloatCash,
    orderCount: orderNumbers.length,
    orderNumbers,
    codOrderTotal,
    qrisOrderTotal,
    sellerCashPaid,
    courierCommissionTotal,
    kalurahanFeeTotal,
    endingCashInHand,
    kurirOutOfPocket,
    netContinueNextDay,
    netFullClose,
    hasTalanganOrder,
  }
}

function getWriteClient() {
  const { createClient } = require('next-sanity')
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    apiVersion: '2026-02-01',
    useCdn: false,
    token: process.env.SANITY_API_WRITE_TOKEN,
  })
}

export interface SettlementSyncResult {
  createdCount: number
  warnedCount: number
  blockedCount: number
  unblockedCount: number
}

/**
 * Menjalankan sinkronisasi buku setoran harian jam 16.00 WIB & pengawasan batas 2x24 jam:
 * 1. Membentuk tagihan/refill periode yang sudah melewati jam cutoff (16:00 WIB) dari order `completed` belum masuk buku.
 * 2. Mengirim pengingat > 24 jam & membekukan antrean kurir bila tertunda > 48 jam (2x24 jam).
 */
export async function syncDailyCourierSettlements(options?: {
  nowMs?: number
  dryRun?: boolean
  clientOverride?: any
}): Promise<SettlementSyncResult> {
  const nowMs = options?.nowMs ?? Date.now()
  const dryRun = options?.dryRun ?? false
  const client = options?.clientOverride ?? getWriteClient()

  const [rawSettings, couriers, unsettledCompletedOrders, existingSettlements] =
    await Promise.all([
      client.fetch(APP_SETTINGS_QUERY, {}, { cache: 'no-store' }),
      client.fetch(
        `*[_type == "courier" && !(_id in path("drafts.**"))]{
          _id, name, phone, isActive, status, customFloatCash, isSettlementBlocked
        }`,
        {},
        { cache: 'no-store' }
      ),
      client.fetch(
        `*[_type == "order" && !(_id in path("drafts.**")) && status == "completed" && orderCategory != "service" && !defined(settlementId) && defined(courier)]{
          _id, orderNumber, paymentMethod, totalAmount, shippingFee,
          productSubtotal, courierCommissionAmount, kalurahanFeeAmount, exceededFloatCash,
          completedAt, _updatedAt, _createdAt,
          "courierId": courier._ref,
          items[]{ quantity, price }
        }`,
        {},
        { cache: 'no-store' }
      ),
      client.fetch(
        `*[_type == "courierSettlement" && !(_id in path("drafts.**")) && status != "settled"]{
          _id, periodKey, courierName, courierPhone, cutoffAt, dueAt,
          openingFloatCash, orderCount, orderNumbers, codOrderTotal, qrisOrderTotal,
          sellerCashPaid, courierCommissionTotal, kalurahanFeeTotal, endingCashInHand,
          kurirOutOfPocket, netContinueNextDay, netFullClose, status,
          warning24SentAt, blocked48SentAt,
          "courierId": courier._ref
        }`,
        {},
        { cache: 'no-store' }
      ),
    ])

  const config = resolveFinanceConfig(rawSettings)
  const adminPhone = config.adminPhone || '+62895325586281'
  const courierMap = new Map<string, any>()
  for (const c of couriers || []) {
    if (c?._id) courierMap.set(String(c._id).replace(/^drafts\./, ''), c)
  }

  // 1. Kelompokkan order selesai yang belum dibukukan berdasarkan (courierId, periodKey)
  const grouped = new Map<string, { courierId: string; periodKey: string; orders: any[] }>()
  for (const ord of unsettledCompletedOrders || []) {
    const cleanCourierId = String(ord.courierId || '').replace(/^drafts\./, '')
    if (!cleanCourierId || !courierMap.has(cleanCourierId)) continue
    if (!isOrderEligibleForCashLedger(ord, config.financeLedgerStartedAt)) continue
    const completedIso = ord.completedAt || ord._updatedAt || ord._createdAt
    const periodKey = assignOrderSettlementPeriodKey(
      completedIso,
      config.dailySettlementCutoffHour
    )
    if (!isCutoffPassedForPeriod(periodKey, nowMs, config.dailySettlementCutoffHour)) {
      continue
    }
    const key = `${cleanCourierId}::${periodKey}`
    if (!grouped.has(key)) {
      grouped.set(key, { courierId: cleanCourierId, periodKey, orders: [] })
    }
    grouped.get(key)!.orders.push(ord)
  }

  let createdCount = 0
  let warnedCount = 0
  let blockedCount = 0
  let unblockedCount = 0
  const nowIso = new Date(nowMs).toISOString()

  const activeSettlements: any[] = [...(existingSettlements || [])]

  for (const bucket of grouped.values()) {
    const courier = courierMap.get(bucket.courierId)
    if (!courier) continue
    const settlementId = `settlement-${bucket.courierId}-${bucket.periodKey}`
    const alreadyExists = activeSettlements.some((s) => s._id === settlementId)
    if (alreadyExists) {
      // Hanya kaitkan order bila dokumen sudah terbentuk sebelumnya
      if (!dryRun) {
        for (const ord of bucket.orders) {
          await client
            .patch(String(ord._id).replace(/^drafts\./, ''))
            .set({ settlementId })
            .commit()
            .catch(() => {})
        }
      }
      continue
    }

    const openingFloat =
      typeof courier.customFloatCash === 'number'
        ? Math.max(0, courier.customFloatCash)
        : config.defaultCourierFloatCash

    const summary = computeCourierLedgerSummary(bucket.orders, openingFloat, config)
    const cutoffAt = wibDateHourToIso(bucket.periodKey, config.dailySettlementCutoffHour)
    const dueAt = new Date(
      new Date(cutoffAt).getTime() + config.maxSettlementDelayHours * 3600000
    ).toISOString()

    const doc = {
      _id: settlementId,
      _type: 'courierSettlement',
      periodKey: bucket.periodKey,
      courier: { _type: 'reference', _ref: bucket.courierId },
      courierName: courier.name || 'Kurir PAWON',
      courierPhone: courier.phone || '',
      cutoffAt,
      dueAt,
      openingFloatCash: summary.openingFloatCash,
      orderCount: summary.orderCount,
      orderNumbers: summary.orderNumbers,
      codOrderTotal: summary.codOrderTotal,
      qrisOrderTotal: summary.qrisOrderTotal,
      sellerCashPaid: summary.sellerCashPaid,
      courierCommissionTotal: summary.courierCommissionTotal,
      kalurahanFeeTotal: summary.kalurahanFeeTotal,
      endingCashInHand: summary.endingCashInHand,
      kurirOutOfPocket: summary.kurirOutOfPocket,
      netContinueNextDay: summary.netContinueNextDay,
      netFullClose: summary.netFullClose,
      status: 'waiting_settlement',
    }

    if (!dryRun) {
      await client.createIfNotExists(doc)
      for (const ord of bucket.orders) {
        await client
          .patch(String(ord._id).replace(/^drafts\./, ''))
          .set({ settlementId })
          .commit()
          .catch(() => {})
      }

      if (courier.phone) {
        const msg = buildSettlementNotificationMessage({
          kind: 'daily_cutoff',
          courierName: doc.courierName,
          periodKey: doc.periodKey,
          orderCount: doc.orderCount,
          codOrderTotal: doc.codOrderTotal,
          qrisOrderTotal: doc.qrisOrderTotal,
          sellerCashPaid: doc.sellerCashPaid,
          courierCommissionTotal: doc.courierCommissionTotal,
          netContinueNextDay: doc.netContinueNextDay,
          netFullClose: doc.netFullClose,
          maxDelayHours: config.maxSettlementDelayHours,
        })
        await sendWhatsAppNotification(courier.phone, msg).catch(() => {})
      }

      await sendWhatsAppNotification(
        adminPhone,
        buildSettlementNotificationMessage({
          kind: 'admin_daily_summary',
          courierName: doc.courierName,
          periodKey: doc.periodKey,
          orderCount: doc.orderCount,
          codOrderTotal: doc.codOrderTotal,
          qrisOrderTotal: doc.qrisOrderTotal,
          sellerCashPaid: doc.sellerCashPaid,
          courierCommissionTotal: doc.courierCommissionTotal,
          netContinueNextDay: doc.netContinueNextDay,
          netFullClose: doc.netFullClose,
          maxDelayHours: config.maxSettlementDelayHours,
        })
      ).catch(() => {})
    }

    activeSettlements.push({ ...doc, courierId: bucket.courierId })
    createdCount++
  }

  // 2. Periksa tenggat 24 jam & 48 jam (2x24 jam) pada seluruh laporan belum lunas
  const blockedCourierIds = new Set<string>()
  for (const st of activeSettlements) {
    if (st.status === 'settled') continue
    const cutoffMs = new Date(st.cutoffAt).getTime()
    if (Number.isNaN(cutoffMs)) continue
    const hoursPastCutoff = (nowMs - cutoffMs) / 3600000
    const cleanCourierId = String(st.courierId || '').replace(/^drafts\./, '')

    if (hoursPastCutoff >= config.maxSettlementDelayHours) {
      if (cleanCourierId) blockedCourierIds.add(cleanCourierId)
      if (st.status !== 'blocked_overdue') {
        if (!dryRun) {
          await client
            .patch(st._id)
            .set({ status: 'blocked_overdue', blocked48SentAt: nowIso })
            .commit()
            .catch(() => {})

          if (st.courierPhone) {
            await sendWhatsAppNotification(
              st.courierPhone,
              buildSettlementNotificationMessage({
                kind: 'blocked_48h',
                courierName: st.courierName,
                periodKey: st.periodKey,
                orderCount: st.orderCount || 0,
                codOrderTotal: st.codOrderTotal || 0,
                qrisOrderTotal: st.qrisOrderTotal || 0,
                sellerCashPaid: st.sellerCashPaid || 0,
                courierCommissionTotal: st.courierCommissionTotal || 0,
                netContinueNextDay: st.netContinueNextDay || 0,
                netFullClose: st.netFullClose || 0,
                maxDelayHours: config.maxSettlementDelayHours,
              })
            ).catch(() => {})
          }

          await sendWhatsAppNotification(
            adminPhone,
            buildSettlementNotificationMessage({
              kind: 'admin_blocked_48h',
              courierName: st.courierName,
              periodKey: st.periodKey,
              orderCount: st.orderCount || 0,
              codOrderTotal: st.codOrderTotal || 0,
              qrisOrderTotal: st.qrisOrderTotal || 0,
              sellerCashPaid: st.sellerCashPaid || 0,
              courierCommissionTotal: st.courierCommissionTotal || 0,
              netContinueNextDay: st.netContinueNextDay || 0,
              netFullClose: st.netFullClose || 0,
              maxDelayHours: config.maxSettlementDelayHours,
            })
          ).catch(() => {})
        }
        blockedCount++
      }
    } else if (hoursPastCutoff >= 24 && st.status === 'waiting_settlement') {
      if (!dryRun) {
        await client
          .patch(st._id)
          .set({ status: 'overdue_warning', warning24SentAt: nowIso })
          .commit()
          .catch(() => {})

        if (st.courierPhone) {
          await sendWhatsAppNotification(
            st.courierPhone,
            buildSettlementNotificationMessage({
              kind: 'warning_24h',
              courierName: st.courierName,
              periodKey: st.periodKey,
              orderCount: st.orderCount || 0,
              codOrderTotal: st.codOrderTotal || 0,
              qrisOrderTotal: st.qrisOrderTotal || 0,
              sellerCashPaid: st.sellerCashPaid || 0,
              courierCommissionTotal: st.courierCommissionTotal || 0,
              netContinueNextDay: st.netContinueNextDay || 0,
              netFullClose: st.netFullClose || 0,
              maxDelayHours: config.maxSettlementDelayHours,
            })
          ).catch(() => {})
        }
      }
      warnedCount++
    }
  }

  // 3. Sinkronkan flag isSettlementBlocked di dokumen kurir (blokir / buka blokir otomatis)
  if (!dryRun) {
    for (const [cid, courier] of courierMap.entries()) {
      const shouldBlock = blockedCourierIds.has(cid)
      const currentlyBlocked = Boolean(courier.isSettlementBlocked)
      if (shouldBlock && !currentlyBlocked) {
        await client
          .patch(cid)
          .set({
            isSettlementBlocked: true,
            settlementBlockedReason: `Laporan kas harian tertunda melebihi ${config.maxSettlementDelayHours} jam.`,
          })
          .commit()
          .catch(() => {})
      } else if (!shouldBlock && currentlyBlocked) {
        await client
          .patch(cid)
          .set({
            isSettlementBlocked: false,
            settlementBlockedReason: '',
          })
          .commit()
          .catch(() => {})
        unblockedCount++
      }
    }
  }

  return { createdCount, warnedCount, blockedCount, unblockedCount }
}
