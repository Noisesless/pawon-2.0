'use server'

import { createClient } from 'next-sanity'
import { updateOrderStatus } from './order'
import { DEFAULT_PAWON_STATIC_QRIS, parseQRIS, validateCRC16 } from '@/lib/qrisEngine'
import { runOrderSopEvaluation } from '@/lib/orderSopEngine'
import {
  resolveFinanceConfig,
  computeCourierLedgerSummary,
  assignOrderSettlementPeriodKey,
  wibDateHourToIso,
  syncDailyCourierSettlements,
  isOrderEligibleForCashLedger,
} from '@/lib/courierFinanceEngine'
import { sendWhatsAppNotification } from '@/sanity/lib/whatsapp'

const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2026-02-01',
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
})

function canonicalId(id: string): string {
  return id.replace(/^drafts\./, '')
}

async function purgeDraft(id: string) {
  const clean = canonicalId(id)
  try {
    await writeClient.delete(`drafts.${clean}`)
  } catch {
    // Ignore if no draft exists
  }
}

function toSlug(input: string, withSuffix = false): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90)
  if (!withSuffix) return base || `item-${Date.now()}`
  return `${base}-${Math.random().toString(36).substring(2, 6)}`
}

/**
 * Verifikasi PIN Login Dasbor Admin (/admin) terhadap Sanity appSettings
 */
export async function verifyAdminPin(pinInput: string) {
  try {
    const settings = await writeClient.fetch(
      `*[_type == "appSettings"] | order(_updatedAt desc)[0]{adminPin}`,
      {},
      { cache: 'no-store' }
    )
    const activePin = settings?.adminPin?.trim() || '12341'
    if (pinInput.trim() === activePin) {
      return { success: true }
    }
    return { success: false, error: 'PIN Admin tidak sesuai.' }
  } catch {
    if (pinInput.trim() === '12341') return { success: true }
    return { success: false, error: 'Gagal memverifikasi PIN.' }
  }
}

/**
 * Kompatibilitas mundur untuk fetchAllOrders
 */
export async function fetchAllOrders() {
  try {
    const query = `*[_type == "order" && !(_id in path("drafts.**"))] | order(_createdAt desc) {
      _id,
      orderNumber,
      orderCategory,
      _createdAt,
      _updatedAt,
      customerName,
      customerPhone,
      deliveryAddress,
      totalAmount,
      shippingFee,
      paymentMethod,
      paymentStatus,
      status,
      courierNotes,
      autoResolutionReason,
      completedAt,
      productSubtotal,
      courierCommissionAmount,
      kalurahanFeeAmount,
      exceededFloatCash,
      settlementId,
      serviceDate,
      serviceItem->{
        _id,
        name,
        price,
        "vendorName": vendor->name,
        "vendorPhone": vendor->phone
      },
      items[]{
        _key,
        quantity,
        price,
        product->{
          _id,
          name,
          "vendorName": vendor->name,
          "vendorPhone": vendor->phone
        }
      },
      courier->{
        _id,
        name,
        phone
      }
    }`
    const orders = await writeClient.fetch(query, {}, { cache: 'no-store' })
    return { success: true, data: orders }
  } catch (error) {
    console.error('Error fetching orders:', error)
    return { success: false, error: 'Gagal memuat daftar pesanan.' }
  }
}

/**
 * Memuat seluruh data 6 Tab Pusat Kendali Admin sekaligus (Zero-Cache, Published SSOT)
 */
export async function fetchAdminDashboardData() {
  try {
    // Auto-heal orphan draft vendors created by legacy registerVendor
    try {
      const draftVendors = await writeClient.fetch(
        `*[_type == "vendor" && _id in path("drafts.**")]`,
        {},
        { cache: 'no-store' }
      )
      if (Array.isArray(draftVendors) && draftVendors.length > 0) {
        for (const dv of draftVendors) {
          const pubId = canonicalId(dv._id)
          await writeClient.createIfNotExists({ ...dv, _id: pubId })
          await writeClient.delete(dv._id).catch(() => {})
        }
      }
    } catch {
      // Ignore if mock/read-only
    }

    const [
      ordersRes,
      vendors,
      couriers,
      customers,
      products,
      services,
      categories,
      banners,
      articles,
      incubatorServices,
      incubatorSettings,
      rawAppSettings,
      courierSettlements,
    ] = await Promise.all([
      fetchAllOrders(),
      writeClient.fetch(
        `*[_type == "vendor" && !(_id in path("drafts.**"))] | order(_createdAt desc) {
          _id,
          name,
          "slug": slug.current,
          phone,
          pin,
          address,
          description,
          businessType,
          isOpen,
          closingMessage,
          isVerified,
          latitude,
          longitude,
          "logoAssetId": logo.asset._ref,
          "logoUrl": logo.asset->url
        }`,
        {},
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "courier" && !(_id in path("drafts.**"))] | order(_createdAt desc) {
          _id,
          name,
          phone,
          pin,
          isActive,
          status,
          statusMessage,
          customFloatCash,
          isSettlementBlocked,
          settlementBlockedReason,
          lastSettledAt
        }`,
        {},
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "customer" && !(_id in path("drafts.**"))] | order(_createdAt desc) {
          _id,
          name,
          phone,
          address,
          pin,
          isVerified,
          successfulOrders,
          failedOrders
        }`,
        {},
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "product" && !(_id in path("drafts.**"))] | order(_createdAt desc) {
          _id,
          name,
          "slug": slug.current,
          price,
          stock,
          description,
          isBestSeller,
          isPromo,
          promoDiscount,
          "vendorId": vendor._ref,
          "vendorName": vendor->name,
          "categoryIds": categories[]._ref,
          "imageAssetId": image.asset._ref,
          "imageUrl": image.asset->url
        }`,
        {},
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "service" && !(_id in path("drafts.**"))] | order(_createdAt desc) {
          _id,
          name,
          "slug": slug.current,
          price,
          priceType,
          description,
          isBestSeller,
          isPromo,
          promoDiscount,
          "vendorId": vendor._ref,
          "vendorName": vendor->name,
          "categoryIds": categories[]._ref,
          "imageAssetId": image.asset._ref,
          "imageUrl": image.asset->url
        }`,
        {},
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "category" && !(_id in path("drafts.**"))] | order(name asc) {
          _id,
          name,
          "slug": slug.current,
          description,
          "imageAssetId": image.asset._ref,
          "imageUrl": image.asset->url
        }`,
        {},
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "banner" && !(_id in path("drafts.**"))] | order(_createdAt desc) {
          _id,
          title,
          link,
          isActive,
          "desktopAssetId": imageDesktop.asset._ref,
          "desktopUrl": imageDesktop.asset->url,
          "mobileAssetId": imageMobile.asset._ref,
          "mobileUrl": imageMobile.asset->url
        }`,
        {},
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "article" && !(_id in path("drafts.**"))] | order(publishedAt desc) {
          _id,
          title,
          "slug": slug.current,
          publishedAt,
          category,
          excerpt,
          content,
          "imageAssetId": image.asset._ref,
          "imageUrl": image.asset->url
        }`,
        {},
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "incubatorService" && !(_id in path("drafts.**"))] | order(order asc) {
          _id,
          title,
          "slug": slug.current,
          description,
          iconName,
          order
        }`,
        {},
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "incubatorSettings"] | order(_updatedAt desc)[0] {
          _id,
          heroTitle,
          "heroAssetId": heroImage.asset._ref,
          "heroImageUrl": heroImage.asset->url
        }`,
        {},
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "appSettings"] | order(_updatedAt desc)[0] {
          _id,
          siteName,
          adminPhone,
          adminPin,
          defaultShippingFee,
          courierCommissionAmount,
          kalurahanFeeAmount,
          defaultCourierFloatCash,
          dailySettlementCutoffHour,
          maxSettlementDelayHours,
          financeLedgerStartedAt,
          isMaintenance,
          isQrisEnabled,
          qrisMerchantName,
          qrisNmid,
          qrisStaticPayload,
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
      ),
      writeClient.fetch(
        `*[_type == "courierSettlement" && !(_id in path("drafts.**"))] | order(cutoffAt desc)[0..100] {
          _id,
          periodKey,
          "courierId": courier._ref,
          courierName,
          courierPhone,
          cutoffAt,
          dueAt,
          openingFloatCash,
          orderCount,
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
          settlementMode,
          status,
          settledAt,
          settledAmount,
          notes
        }`,
        {},
        { cache: 'no-store' }
      ),
    ])

    const appSettings = {
      _id: rawAppSettings?._id || 'appSettings',
      siteName: rawAppSettings?.siteName || 'PAWON PONDOKREJO',
      adminPhone: rawAppSettings?.adminPhone || '+62895325586281',
      adminPin: rawAppSettings?.adminPin || '12341',
      defaultShippingFee: rawAppSettings?.defaultShippingFee ?? 6000,
      courierCommissionAmount: rawAppSettings?.courierCommissionAmount ?? 4000,
      kalurahanFeeAmount: rawAppSettings?.kalurahanFeeAmount ?? 2000,
      defaultCourierFloatCash: rawAppSettings?.defaultCourierFloatCash ?? 100000,
      dailySettlementCutoffHour: rawAppSettings?.dailySettlementCutoffHour ?? 16,
      maxSettlementDelayHours: rawAppSettings?.maxSettlementDelayHours ?? 48,
      financeLedgerStartedAt: rawAppSettings?.financeLedgerStartedAt || null,
      isMaintenance: Boolean(rawAppSettings?.isMaintenance),
      isQrisEnabled: rawAppSettings?.isQrisEnabled !== false,
      qrisMerchantName: rawAppSettings?.qrisMerchantName || 'PAWON PONDOKREJO',
      qrisNmid: rawAppSettings?.qrisNmid || 'ID1026574925990',
      qrisStaticPayload: rawAppSettings?.qrisStaticPayload || DEFAULT_PAWON_STATIC_QRIS,
      isSopAutoEnabled: rawAppSettings?.isSopAutoEnabled !== false,
      sopPendingCancelHours: Number(rawAppSettings?.sopPendingCancelHours) || 24,
      sopStuckWarningHours: Number(rawAppSettings?.sopStuckWarningHours) || 4,
      sopDeliveredCompleteHours:
        Number(rawAppSettings?.sopDeliveredCompleteHours) || 24,
      sopProcessingCancelHours:
        Number(rawAppSettings?.sopProcessingCancelHours) || 48,
      sopCourierTimeoutMinutes:
        Number(rawAppSettings?.sopCourierTimeoutMinutes) || 5,
      sopLastRunAt: rawAppSettings?.sopLastRunAt || null,
    }

    return {
      success: true,
      data: {
        orders: ordersRes.data || [],
        vendors: vendors || [],
        couriers: couriers || [],
        customers: customers || [],
        products: products || [],
        services: services || [],
        categories: categories || [],
        banners: banners || [],
        articles: articles || [],
        incubatorServices: incubatorServices || [],
        incubatorSettings: incubatorSettings || null,
        courierSettlements: courierSettlements || [],
        appSettings,
      },
    }
  } catch (error: any) {
    console.error('fetchAdminDashboardData failed:', error)
    return {
      success: false,
      error: error?.message || 'Gagal memuat data Pusat Kendali Admin.',
    }
  }
}

/**
 * Upload file gambar ke Sanity Asset Storage
 */
export async function uploadAdminImage(formData: FormData) {
  try {
    const file = formData.get('file') as File
    if (!file) return { success: false, error: 'File gambar tidak ditemukan.' }

    const asset = await writeClient.assets.upload('image', file, {
      filename: file.name,
    })

    return {
      success: true,
      assetId: asset._id,
      url: asset.url,
    }
  } catch (error: any) {
    console.error('uploadAdminImage error:', error)
    return {
      success: false,
      error: error?.message || 'Gagal mengunggah gambar ke Sanity.',
    }
  }
}

/**
 * Hapus dokumen apapun beserta draft bayangannya (Zero-Draft Delete)
 */
export async function adminDeleteDocument(docId: string) {
  try {
    const clean = canonicalId(docId)
    await Promise.allSettled([
      writeClient.delete(clean),
      writeClient.delete(`drafts.${clean}`),
    ])
    return { success: true }
  } catch (error: any) {
    console.error('adminDeleteDocument error:', error)
    return {
      success: false,
      error: error?.message || 'Gagal menghapus dokumen.',
    }
  }
}

/**
 * Simpan Konfigurasi Global & Dynamic QRIS (Singleton Zero-Draft)
 */
export async function saveAppSettings(data: {
  siteName: string
  adminPhone: string
  adminPin: string
  defaultShippingFee: number
  courierCommissionAmount?: number
  kalurahanFeeAmount?: number
  defaultCourierFloatCash?: number
  dailySettlementCutoffHour?: number
  maxSettlementDelayHours?: number
  isMaintenance: boolean
  isQrisEnabled: boolean
  qrisMerchantName: string
  qrisNmid: string
  qrisStaticPayload: string
  isSopAutoEnabled?: boolean
  sopPendingCancelHours?: number
  sopStuckWarningHours?: number
  sopDeliveredCompleteHours?: number
  sopProcessingCancelHours?: number
  sopCourierTimeoutMinutes?: number
}) {
  try {
    const cleanPayload = data.qrisStaticPayload.trim() || DEFAULT_PAWON_STATIC_QRIS
    if (!validateCRC16(cleanPayload)) {
      return {
        success: false,
        error:
          'String Payload QRIS Statis tidak lolos validasi Checksum CRC-16 EMVCo. Pastikan string utuh diawali 000201 dan diakhiri 4 digit CRC.',
      }
    }

    const parsed = parseQRIS(cleanPayload)
    const rawExisting = await writeClient.fetch(
      `*[_type == "appSettings"]{_id, sopLastRunAt, financeLedgerStartedAt}`,
      {},
      { cache: 'no-store' }
    )
    const existingDocs = Array.isArray(rawExisting)
      ? rawExisting
      : rawExisting
        ? [rawExisting]
        : []
    const primaryId =
      existingDocs
        .map((d: any) => canonicalId(d._id))
        .find((id: string) => id === 'appSettings') ||
      (existingDocs[0]?._id ? canonicalId(existingDocs[0]._id) : 'appSettings')

    const rawPhoneInput = (data.adminPhone || '+62895325586281').trim()
    const hasPlus = rawPhoneInput.startsWith('+')
    let normalizedPhone = rawPhoneInput.replace(/\D/g, '')
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '62' + normalizedPhone.slice(1)
    }
    const finalAdminPhone = normalizedPhone
      ? (hasPlus ? `+${normalizedPhone}` : normalizedPhone)
      : '+62895325586281'

    const shippingFeeVal = Math.max(0, Number(data.defaultShippingFee) ?? 6000)
    const commissionVal = Math.max(
      0,
      Number(data.courierCommissionAmount ?? 4000)
    )
    const kalurahanVal = Math.max(
      0,
      Number(
        data.kalurahanFeeAmount ?? Math.max(0, shippingFeeVal - commissionVal)
      )
    )

    const docToSave: { _id: string; _type: string; [key: string]: any } = {
      _id: primaryId,
      _type: 'appSettings',
      siteName: data.siteName.trim() || 'PAWON PONDOKREJO',
      adminPhone: finalAdminPhone,
      adminPin: data.adminPin.trim() || '12341',
      defaultShippingFee: shippingFeeVal,
      courierCommissionAmount: commissionVal,
      kalurahanFeeAmount: kalurahanVal,
      defaultCourierFloatCash: Math.max(
        0,
        Number(data.defaultCourierFloatCash ?? 100000)
      ),
      dailySettlementCutoffHour: Math.min(
        23,
        Math.max(0, Number(data.dailySettlementCutoffHour ?? 16))
      ),
      maxSettlementDelayHours: Math.max(
        1,
        Number(data.maxSettlementDelayHours ?? 48)
      ),
      isMaintenance: Boolean(data.isMaintenance),
      isQrisEnabled: Boolean(data.isQrisEnabled),
      qrisMerchantName:
        data.qrisMerchantName.trim().slice(0, 25) ||
        parsed.summary?.merchantName ||
        'PAWON PONDOKREJO',
      qrisNmid:
        data.qrisNmid.trim() || parsed.summary?.nmid || 'ID1026574925990',
      qrisStaticPayload: cleanPayload,
      isSopAutoEnabled: data.isSopAutoEnabled !== false,
      sopPendingCancelHours: Math.max(1, Number(data.sopPendingCancelHours) || 24),
      sopStuckWarningHours: Math.max(1, Number(data.sopStuckWarningHours) || 4),
      sopDeliveredCompleteHours: Math.max(
        1,
        Number(data.sopDeliveredCompleteHours) || 24
      ),
      sopProcessingCancelHours: Math.max(
        1,
        Number(data.sopProcessingCancelHours) || 48
      ),
      sopCourierTimeoutMinutes: Math.max(
        1,
        Number(data.sopCourierTimeoutMinutes) || 5
      ),
    }

    const existingLastRun = existingDocs.find((d: any) => d.sopLastRunAt)?.sopLastRunAt
    if (existingLastRun) {
      docToSave.sopLastRunAt = existingLastRun
    }
    const existingLedgerStart = existingDocs.find((d: any) => d.financeLedgerStartedAt)?.financeLedgerStartedAt
    if (existingLedgerStart) {
      docToSave.financeLedgerStartedAt = existingLedgerStart
    }

    await writeClient.createOrReplace(docToSave)
    await purgeDraft(primaryId)

    // Bersihkan dokumen duplikat atau draft sisa di Sanity Studio agar SSOT
    if (existingDocs && existingDocs.length > 1) {
      for (const d of existingDocs) {
        if (d._id !== primaryId) {
          await writeClient.delete(d._id).catch(() => {})
        }
      }
    }

    return { success: true, data: docToSave }
  } catch (error: any) {
    console.error('saveAppSettings error:', error)
    return {
      success: false,
      error: error?.message || 'Gagal menyimpan pengaturan aplikasi.',
    }
  }
}

/**
 * Konfirmasi Pesanan (Lunas QRIS / COD) & Tugaskan Kurir langsung dari Dasbor Admin
 */
export async function adminConfirmAndAssignOrder(params: {
  orderId: string
  orderNumber: string
  actionMode: 'paid' | 'processing_cod'
  courierId?: string
  courierNotes?: string
}) {
  try {
    const cleanId = canonicalId(params.orderId)
    if (params.courierNotes !== undefined) {
      await writeClient
        .patch(cleanId)
        .set({ courierNotes: params.courierNotes })
        .commit()
    }
    await purgeDraft(cleanId)

    const res = await updateOrderStatus(
      params.orderNumber,
      params.actionMode,
      'Dikonfirmasi via Pusat Kendali Admin',
      params.courierId || undefined
    )
    return res
  } catch (error: any) {
    console.error('adminConfirmAndAssignOrder error:', error)
    return {
      success: false,
      error: error?.message || 'Gagal mengonfirmasi pesanan.',
    }
  }
}

/**
 * Update langsung status / pembayaran / kurir / catatan pesanan dari Dasbor Admin
 */
export async function adminUpdateOrderDirect(params: {
  orderId: string
  orderNumber: string
  status: string
  paymentStatus: 'unpaid' | 'paid'
  courierId?: string
  courierNotes?: string
}) {
  try {
    const cleanId = canonicalId(params.orderId)
    const updates: any = {
      status: params.status,
      paymentStatus: params.paymentStatus,
      courierNotes: params.courierNotes || '',
    }
    if (params.courierId) {
      updates.courier = { _type: 'reference', _ref: canonicalId(params.courierId) }
    }

    await writeClient.patch(cleanId).set(updates).commit()
    await purgeDraft(cleanId)
    return { success: true }
  } catch (error: any) {
    console.error('adminUpdateOrderDirect error:', error)
    return {
      success: false,
      error: error?.message || 'Gagal memperbarui data pesanan.',
    }
  }
}

/**
 * Preview & Eksekusi SOP Transaksi Kedaluwarsa dari Dasbor Admin
 */
export async function previewOrderSopAction() {
  try {
    const res = await runOrderSopEvaluation({ dryRun: true, force: true })
    return { success: true, data: res }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Gagal menganalisa transaksi SOP.',
    }
  }
}

export async function executeOrderSopAction(sendWaForRecent = true) {
  try {
    const res = await runOrderSopEvaluation({
      dryRun: false,
      force: true,
      sendWaForRecent,
    })
    return { success: true, data: res }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Gagal menjalankan SOP otomatis.',
    }
  }
}

/**
 * Konfirmasi cepat atau selesaikan pesanan (termasuk pesanan jasa) via updateOrderStatus
 */
export async function adminQuickOrderTransition(
  orderNumber: string,
  newStatus: string,
  note: string
) {
  return await updateOrderStatus(orderNumber, newStatus, note)
}

/**
 * Menjalankan sinkronisasi tutup buku harian jam 16.00 WIB dan batas 2x24 jam secara manual dari Admin
 */
export async function syncCourierSettlementsAction() {
  try {
    const res = await syncDailyCourierSettlements({ dryRun: false })
    return { success: true, data: res }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Gagal menyinkronkan laporan kas kurir.',
    }
  }
}

/**
 * Mengonfirmasi penyelesaian setoran/refill kas kurir oleh Admin Kalurahan dan membuka blokir antrean jika ada
 */
export async function confirmCourierSettlementAction(params: {
  settlementId?: string
  courierId: string
  periodKey?: string
  mode: 'continue_float' | 'full_return'
  notes?: string
}) {
  try {
    const cleanCourierId = canonicalId(params.courierId)
    const nowIso = new Date().toISOString()

    const [rawSettings, courier] = await Promise.all([
      writeClient.fetch(
        `*[_type == "appSettings"] | order(_updatedAt desc)[0]`,
        {},
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "courier" && _id == $id][0]{ _id, name, phone, customFloatCash }`,
        { id: cleanCourierId },
        { cache: 'no-store' }
      ),
    ])

    if (!courier) {
      return { success: false, error: 'Data kurir tidak ditemukan.' }
    }

    const finConfig = resolveFinanceConfig(rawSettings)
    const openingFloat =
      typeof courier.customFloatCash === 'number'
        ? Math.max(0, courier.customFloatCash)
        : finConfig.defaultCourierFloatCash

    let settledAmount = 0
    let usedPeriodKey = params.periodKey || assignOrderSettlementPeriodKey(nowIso, finConfig.dailySettlementCutoffHour)

    if (params.settlementId) {
      const existing = await writeClient.fetch(
        `*[_type == "courierSettlement" && _id == $sid][0]`,
        { sid: params.settlementId },
        { cache: 'no-store' }
      )
      if (!existing) {
        return { success: false, error: 'Laporan kas periode tersebut tidak ditemukan.' }
      }
      if (existing.status === 'settled') {
        return { success: false, error: 'Laporan kas ini sudah diselesaikan sebelumnya.' }
      }
      usedPeriodKey = existing.periodKey || usedPeriodKey
      settledAmount =
        params.mode === 'continue_float'
          ? Number(existing.netContinueNextDay || 0)
          : Number(existing.netFullClose || 0)

      await writeClient
        .patch(existing._id)
        .set({
          status: 'settled',
          settlementMode: params.mode,
          settledAt: nowIso,
          settledAmount,
          notes: params.notes?.trim() || '',
        })
        .commit()
    } else {
      // Penyelesaian langsung untuk transaksi hari berjalan sebelum tutup buku 16.00 WIB
      const openOrders = await writeClient.fetch(
        `*[_type == "order" && !(_id in path("drafts.**")) && courier._ref == $cid && status == "completed" && orderCategory != "service" && !defined(settlementId)]{
          _id, orderNumber, paymentMethod, totalAmount, shippingFee,
          productSubtotal, courierCommissionAmount, kalurahanFeeAmount, exceededFloatCash,
          completedAt, _updatedAt, _createdAt, items[]{ quantity, price }
        }`,
        { cid: cleanCourierId },
        { cache: 'no-store' }
      )

      const matchedOrders = (openOrders || []).filter((ord: any) => {
        if (!isOrderEligibleForCashLedger(ord, finConfig.financeLedgerStartedAt)) return false
        if (!params.periodKey) return true
        const pKey = assignOrderSettlementPeriodKey(
          ord.completedAt || ord._updatedAt || ord._createdAt,
          finConfig.dailySettlementCutoffHour
        )
        return pKey === params.periodKey
      })

      const summary = computeCourierLedgerSummary(matchedOrders, openingFloat, finConfig)
      settledAmount =
        params.mode === 'continue_float'
          ? summary.netContinueNextDay
          : summary.netFullClose

      const docId = `settlement-${cleanCourierId}-${usedPeriodKey}`
      const cutoffAt = wibDateHourToIso(usedPeriodKey, finConfig.dailySettlementCutoffHour)
      const dueAt = new Date(
        new Date(cutoffAt).getTime() + finConfig.maxSettlementDelayHours * 3600000
      ).toISOString()

      await writeClient.createOrReplace({
        _id: docId,
        _type: 'courierSettlement',
        periodKey: usedPeriodKey,
        courier: { _type: 'reference', _ref: cleanCourierId },
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
        settlementMode: params.mode,
        status: 'settled',
        settledAt: nowIso,
        settledAmount,
        notes: params.notes?.trim() || '',
      })

      for (const ord of matchedOrders) {
        await writeClient
          .patch(canonicalId(ord._id))
          .set({ settlementId: docId })
          .commit()
          .catch(() => {})
      }
    }

    // Periksa apakah masih ada tunggakan blocked_overdue lain sebelum membuka blokir kurir
    const remainingOverdue = await writeClient.fetch(
      `count(*[_type == "courierSettlement" && !(_id in path("drafts.**")) && courier._ref == $cid && status == "blocked_overdue"])`,
      { cid: cleanCourierId },
      { cache: 'no-store' }
    )

    const courierPatch: Record<string, any> = { lastSettledAt: nowIso }
    if ((remainingOverdue || 0) === 0) {
      courierPatch.isSettlementBlocked = false
      courierPatch.settlementBlockedReason = ''
    }
    await writeClient.patch(cleanCourierId).set(courierPatch).commit()

    if (courier.phone) {
      const modeText =
        params.mode === 'continue_float'
          ? `Lanjut Kas Awal Rp${openingFloat.toLocaleString('id-ID')}`
          : 'Tutup Kas Penuh'
      const flowText =
        settledAmount >= 0
          ? `Setoran diterima Admin: Rp${Math.round(settledAmount).toLocaleString('id-ID')}`
          : `Refill / ganti talangan ke Kurir: Rp${Math.abs(Math.round(settledAmount)).toLocaleString('id-ID')}`
      await sendWhatsAppNotification(
        courier.phone,
        `*PAWON PONDOKREJO - KONFIRMASI REKAP KAS SELESAI*\n--------------------------------\nKurir   : ${courier.name}\nPeriode : ${usedPeriodKey}\nStatus  : Lunas (${modeText})\n${flowText}\n\nTerima kasih, giliran pengantaran Anda aktif kembali.`
      ).catch(() => {})
    }

    return { success: true, settledAmount }
  } catch (error: any) {
    console.error('confirmCourierSettlementAction error:', error)
    return {
      success: false,
      error: error?.message || 'Gagal mengonfirmasi setoran kas kurir.',
    }
  }
}

/**
 * Reset buku kas kurir: menghapus rekap setoran, membuka blokir seluruh kurir, dan menetapkan waktu mulai buku baru
 */
export async function resetCourierFinanceLedgerAction() {
  try {
    const nowIso = new Date().toISOString()
    const [settlements, couriers, settingsDocs] = await Promise.all([
      writeClient.fetch(`*[_type == "courierSettlement"]{_id}`, {}, { cache: 'no-store' }),
      writeClient.fetch(`*[_type == "courier" && !(_id in path("drafts.**"))]{_id}`, {}, { cache: 'no-store' }),
      writeClient.fetch(`*[_type == "appSettings"] | order(_updatedAt desc)[0]{_id}`, {}, { cache: 'no-store' }),
    ])

    for (const s of settlements || []) {
      await Promise.allSettled([
        writeClient.delete(s._id),
        writeClient.delete(`drafts.${s._id.replace(/^drafts\./, '')}`),
      ])
    }

    for (const c of couriers || []) {
      const cid = canonicalId(c._id)
      await writeClient
        .patch(cid)
        .set({
          isSettlementBlocked: false,
          settlementBlockedReason: '',
          lastSettledAt: null,
        })
        .commit()
        .catch(() => {})
    }

    const settingsId = settingsDocs?._id ? canonicalId(settingsDocs._id) : 'appSettings'
    await writeClient
      .patch(settingsId)
      .set({ financeLedgerStartedAt: nowIso })
      .commit()

    return { success: true, startedAt: nowIso }
  } catch (error: any) {
    console.error('resetCourierFinanceLedgerAction error:', error)
    return {
      success: false,
      error: error?.message || 'Gagal mereset buku kas kurir.',
    }
  }
}

/**
 * Simpan / Buat Penjual (UMKM)
 */
export async function saveVendor(data: {
  _id?: string
  name: string
  phone: string
  pin: string
  address: string
  description: string
  businessType: 'product' | 'service'
  isOpen: boolean
  closingMessage?: string
  isVerified: boolean
  latitude?: number | string | null
  longitude?: number | string | null
  logoAssetId?: string
}) {
  try {
    const cleanName = data.name.trim()
    if (!cleanName || !data.phone.trim()) {
      return { success: false, error: 'Nama UMKM dan Nomor WhatsApp wajib diisi.' }
    }

    const latNum =
      data.latitude !== undefined && data.latitude !== null && String(data.latitude).trim() !== ''
        ? Number(data.latitude)
        : null
    const lngNum =
      data.longitude !== undefined && data.longitude !== null && String(data.longitude).trim() !== ''
        ? Number(data.longitude)
        : null

    const payload: any = {
      _type: 'vendor',
      name: cleanName,
      slug: { _type: 'slug', current: toSlug(cleanName) },
      phone: data.phone.trim(),
      pin: data.pin.trim() || '123456',
      address: data.address.trim(),
      description: data.description.trim(),
      businessType: data.businessType || 'product',
      isOpen: Boolean(data.isOpen),
      closingMessage: data.closingMessage?.trim() || '',
      isVerified: Boolean(data.isVerified),
    }

    if (latNum !== null && Number.isFinite(latNum) && lngNum !== null && Number.isFinite(lngNum)) {
      payload.latitude = latNum
      payload.longitude = lngNum
    }

    if (data.logoAssetId) {
      payload.logo = {
        _type: 'image',
        asset: { _type: 'reference', _ref: data.logoAssetId },
      }
    }

    if (data._id) {
      const cleanId = canonicalId(data._id)
      const patch = writeClient.patch(cleanId).set(payload)
      if (latNum === null || lngNum === null) {
        await patch.unset(['latitude', 'longitude']).commit()
      } else {
        await patch.commit()
      }
      await purgeDraft(cleanId)
      return { success: true, _id: cleanId }
    } else {
      const created = await writeClient.create(payload)
      return { success: true, _id: created._id }
    }
  } catch (error: any) {
    console.error('saveVendor error:', error)
    return { success: false, error: error?.message || 'Gagal menyimpan data UMKM.' }
  }
}

/**
 * Simpan titik koordinat peta lokasi UMKM secara langsung dari tab Peta UMKM
 */
export async function updateVendorLocationAction(params: {
  vendorId: string
  latitude: number
  longitude: number
}) {
  try {
    const cleanId = canonicalId(params.vendorId)
    const lat = Number(params.latitude)
    const lng = Number(params.longitude)
    if (
      !cleanId ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return { success: false, error: 'Koordinat lokasi tidak valid.' }
    }

    await writeClient
      .patch(cleanId)
      .set({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) })
      .commit()
    await purgeDraft(cleanId)
    return { success: true }
  } catch (error: any) {
    console.error('updateVendorLocationAction error:', error)
    return {
      success: false,
      error: error?.message || 'Gagal menyimpan titik lokasi UMKM.',
    }
  }
}

/**
 * Simpan / Buat Kurir Kalurahan (Sinkronisasi isActive + status sekaligus)
 */
export async function saveCourier(data: {
  _id?: string
  name: string
  phone: string
  pin: string
  isActive: boolean
  statusMessage?: string
}) {
  try {
    if (!data.name.trim() || !data.phone.trim()) {
      return { success: false, error: 'Nama Kurir dan Nomor WhatsApp wajib diisi.' }
    }

    const active = Boolean(data.isActive)
    const payload = {
      _type: 'courier',
      name: data.name.trim(),
      phone: data.phone.trim(),
      pin: data.pin.trim() || '123456',
      isActive: active,
      status: active ? 'active' : 'inactive',
      statusMessage: data.statusMessage?.trim() || '',
    }

    if (data._id) {
      const cleanId = canonicalId(data._id)
      await writeClient.patch(cleanId).set(payload).commit()
      await purgeDraft(cleanId)
      return { success: true, _id: cleanId }
    } else {
      const created = await writeClient.create(payload)
      return { success: true, _id: created._id }
    }
  } catch (error: any) {
    console.error('saveCourier error:', error)
    return { success: false, error: error?.message || 'Gagal menyimpan data kurir.' }
  }
}

/**
 * Simpan / Buat Data Warga (Pembeli)
 */
export async function saveCustomer(data: {
  _id?: string
  name: string
  phone: string
  address: string
  pin: string
  isVerified: boolean
}) {
  try {
    if (!data.name.trim() || !data.phone.trim()) {
      return { success: false, error: 'Nama dan Nomor WhatsApp warga wajib diisi.' }
    }

    const payload = {
      _type: 'customer',
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address.trim(),
      pin: data.pin.trim() || '123456',
      isVerified: Boolean(data.isVerified),
    }

    if (data._id) {
      const cleanId = canonicalId(data._id)
      await writeClient.patch(cleanId).set(payload).commit()
      await purgeDraft(cleanId)
      return { success: true, _id: cleanId }
    } else {
      const created = await writeClient.create({
        ...payload,
        successfulOrders: 0,
        failedOrders: 0,
      })
      return { success: true, _id: created._id }
    }
  } catch (error: any) {
    console.error('saveCustomer error:', error)
    return { success: false, error: error?.message || 'Gagal menyimpan data warga.' }
  }
}

/**
 * Simpan / Buat Produk Barang UMKM
 */
export async function saveProduct(data: {
  _id?: string
  name: string
  vendorId: string
  categoryIds: string[]
  price: number
  stock: number
  description: string
  isBestSeller: boolean
  isPromo: boolean
  promoDiscount?: number
  imageAssetId?: string
}) {
  try {
    if (!data.name.trim() || !data.vendorId) {
      return { success: false, error: 'Nama Produk dan Penjual (UMKM) wajib dipilih.' }
    }

    const payload: any = {
      _type: 'product',
      name: data.name.trim(),
      slug: {
        _type: 'slug',
        current: data._id ? toSlug(data.name) : toSlug(data.name, true),
      },
      vendor: { _type: 'reference', _ref: canonicalId(data.vendorId) },
      categories: (data.categoryIds || []).map((cid) => ({
        _key: Math.random().toString(36).substring(2, 9),
        _type: 'reference',
        _ref: canonicalId(cid),
      })),
      price: Math.max(0, Number(data.price) || 0),
      stock: Math.max(0, Number(data.stock) || 0),
      description: data.description?.trim() || '',
      isBestSeller: Boolean(data.isBestSeller),
      isPromo: Boolean(data.isPromo),
      promoDiscount: data.isPromo
        ? Math.min(99, Math.max(1, Number(data.promoDiscount) || 10))
        : undefined,
    }

    if (data.imageAssetId) {
      payload.image = {
        _type: 'image',
        asset: { _type: 'reference', _ref: data.imageAssetId },
      }
    }

    if (data._id) {
      const cleanId = canonicalId(data._id)
      await writeClient.patch(cleanId).set(payload).commit()
      await purgeDraft(cleanId)
      return { success: true, _id: cleanId }
    } else {
      const created = await writeClient.create(payload)
      return { success: true, _id: created._id }
    }
  } catch (error: any) {
    console.error('saveProduct error:', error)
    return { success: false, error: error?.message || 'Gagal menyimpan produk.' }
  }
}

/**
 * Simpan / Buat Jasa & Layanan Warga
 */
export async function saveService(data: {
  _id?: string
  name: string
  vendorId: string
  categoryIds: string[]
  price: number
  priceType: 'fixed' | 'starting_from' | 'hourly' | 'negotiable'
  description: string
  isBestSeller: boolean
  isPromo: boolean
  promoDiscount?: number
  imageAssetId?: string
}) {
  try {
    if (!data.name.trim() || !data.vendorId) {
      return { success: false, error: 'Nama Jasa dan Penyedia Jasa wajib dipilih.' }
    }

    const payload: any = {
      _type: 'service',
      name: data.name.trim(),
      slug: {
        _type: 'slug',
        current: data._id ? toSlug(data.name) : toSlug(data.name, true),
      },
      vendor: { _type: 'reference', _ref: canonicalId(data.vendorId) },
      categories: (data.categoryIds || []).map((cid) => ({
        _key: Math.random().toString(36).substring(2, 9),
        _type: 'reference',
        _ref: canonicalId(cid),
      })),
      price: Math.max(0, Number(data.price) || 0),
      priceType: data.priceType || 'starting_from',
      description: data.description?.trim() || '',
      isBestSeller: Boolean(data.isBestSeller),
      isPromo: Boolean(data.isPromo),
      promoDiscount: data.isPromo
        ? Math.min(99, Math.max(1, Number(data.promoDiscount) || 10))
        : undefined,
    }

    if (data.imageAssetId) {
      payload.image = {
        _type: 'image',
        asset: { _type: 'reference', _ref: data.imageAssetId },
      }
    }

    if (data._id) {
      const cleanId = canonicalId(data._id)
      await writeClient.patch(cleanId).set(payload).commit()
      await purgeDraft(cleanId)
      return { success: true, _id: cleanId }
    } else {
      const created = await writeClient.create(payload)
      return { success: true, _id: created._id }
    }
  } catch (error: any) {
    console.error('saveService error:', error)
    return { success: false, error: error?.message || 'Gagal menyimpan layanan jasa.' }
  }
}

/**
 * Simpan / Buat Kategori Produk & Jasa
 */
export async function saveCategory(data: {
  _id?: string
  name: string
  description?: string
  imageAssetId?: string
}) {
  try {
    if (!data.name.trim()) {
      return { success: false, error: 'Nama Kategori wajib diisi.' }
    }

    const payload: any = {
      _type: 'category',
      name: data.name.trim(),
      slug: { _type: 'slug', current: toSlug(data.name) },
      description: data.description?.trim() || '',
    }

    if (data.imageAssetId) {
      payload.image = {
        _type: 'image',
        asset: { _type: 'reference', _ref: data.imageAssetId },
      }
    }

    if (data._id) {
      const cleanId = canonicalId(data._id)
      await writeClient.patch(cleanId).set(payload).commit()
      await purgeDraft(cleanId)
      return { success: true, _id: cleanId }
    } else {
      const created = await writeClient.create(payload)
      return { success: true, _id: created._id }
    }
  } catch (error: any) {
    console.error('saveCategory error:', error)
    return { success: false, error: error?.message || 'Gagal menyimpan kategori.' }
  }
}

/**
 * Simpan / Buat Banner Promosi Beranda
 */
export async function saveBanner(data: {
  _id?: string
  title: string
  link?: string
  isActive: boolean
  desktopAssetId?: string
  mobileAssetId?: string
}) {
  try {
    if (!data.title.trim()) {
      return { success: false, error: 'Judul Banner wajib diisi.' }
    }

    const payload: any = {
      _type: 'banner',
      title: data.title.trim(),
      link: data.link?.trim() || '/products',
      isActive: Boolean(data.isActive),
    }

    if (data.desktopAssetId) {
      payload.imageDesktop = {
        _type: 'image',
        asset: { _type: 'reference', _ref: data.desktopAssetId },
      }
    }
    if (data.mobileAssetId) {
      payload.imageMobile = {
        _type: 'image',
        asset: { _type: 'reference', _ref: data.mobileAssetId },
      }
    }

    if (data._id) {
      const cleanId = canonicalId(data._id)
      await writeClient.patch(cleanId).set(payload).commit()
      await purgeDraft(cleanId)
      return { success: true, _id: cleanId }
    } else {
      const created = await writeClient.create(payload)
      return { success: true, _id: created._id }
    }
  } catch (error: any) {
    console.error('saveBanner error:', error)
    return { success: false, error: error?.message || 'Gagal menyimpan banner.' }
  }
}

/**
 * Simpan / Buat Info & Pengumuman Kalurahan (Konversi Teks Paragraf ke PortableText Blocks)
 */
export async function saveArticle(data: {
  _id?: string
  title: string
  category: 'pelatihan' | 'pengumuman' | 'panduan'
  publishedAt?: string
  excerpt: string
  bodyText: string
  imageAssetId?: string
}) {
  try {
    if (!data.title.trim()) {
      return { success: false, error: 'Judul Info wajib diisi.' }
    }

    const paragraphs = (data.bodyText || '')
      .split(/\n\s*\n|\n/)
      .map((p) => p.trim())
      .filter(Boolean)

    const blocks = (paragraphs.length > 0 ? paragraphs : [data.excerpt || data.title]).map(
      (paragraph) => ({
        _type: 'block',
        _key: Math.random().toString(36).substring(2, 9),
        style: 'normal',
        markDefs: [],
        children: [
          {
            _type: 'span',
            _key: Math.random().toString(36).substring(2, 9),
            text: paragraph,
            marks: [],
          },
        ],
      })
    )

    const payload: any = {
      _type: 'article',
      title: data.title.trim(),
      slug: {
        _type: 'slug',
        current: data._id ? toSlug(data.title) : toSlug(data.title, true),
      },
      category: data.category || 'pengumuman',
      publishedAt: data.publishedAt
        ? new Date(data.publishedAt).toISOString()
        : new Date().toISOString(),
      excerpt: data.excerpt?.trim() || '',
      content: blocks,
    }

    if (data.imageAssetId) {
      payload.image = {
        _type: 'image',
        asset: { _type: 'reference', _ref: data.imageAssetId },
      }
    }

    if (data._id) {
      const cleanId = canonicalId(data._id)
      await writeClient.patch(cleanId).set(payload).commit()
      await purgeDraft(cleanId)
      return { success: true, _id: cleanId }
    } else {
      const created = await writeClient.create(payload)
      return { success: true, _id: created._id }
    }
  } catch (error: any) {
    console.error('saveArticle error:', error)
    return {
      success: false,
      error: error?.message || 'Gagal menyimpan artikel info.',
    }
  }
}

/**
 * Simpan / Buat Layanan Inkubator UMKM & Pengaturan Hero Inkubator
 */
export async function saveIncubatorService(data: {
  _id?: string
  title: string
  description: string
  iconName: string
  order: number
}) {
  try {
    if (!data.title.trim()) {
      return { success: false, error: 'Nama Layanan Inkubator wajib diisi.' }
    }

    const payload = {
      _type: 'incubatorService',
      title: data.title.trim(),
      slug: { _type: 'slug', current: toSlug(data.title) },
      description: data.description.trim(),
      iconName: data.iconName.trim() || 'Rocket',
      order: Number(data.order) || 0,
    }

    if (data._id) {
      const cleanId = canonicalId(data._id)
      await writeClient.patch(cleanId).set(payload).commit()
      await purgeDraft(cleanId)
      return { success: true, _id: cleanId }
    } else {
      const created = await writeClient.create(payload)
      return { success: true, _id: created._id }
    }
  } catch (error: any) {
    console.error('saveIncubatorService error:', error)
    return {
      success: false,
      error: error?.message || 'Gagal menyimpan layanan inkubator.',
    }
  }
}

export async function saveIncubatorSettings(data: {
  heroTitle?: string
  heroAssetId?: string
}) {
  try {
    const existing = await writeClient.fetch(
      `*[_type == "incubatorSettings"]{_id}`,
      {},
      { cache: 'no-store' }
    )
    const primaryId =
      existing
        ?.map((d: any) => canonicalId(d._id))
        .find((id: string) => id === 'incubatorSettings') ||
      (existing?.[0]?._id ? canonicalId(existing[0]._id) : 'incubatorSettings')

    const payload: any = {
      _id: primaryId,
      _type: 'incubatorSettings',
      heroTitle: data.heroTitle?.trim() || '',
    }

    if (data.heroAssetId) {
      payload.heroImage = {
        _type: 'image',
        asset: { _type: 'reference', _ref: data.heroAssetId },
      }
    }

    await writeClient.createOrReplace(payload)
    await purgeDraft(primaryId)
    return { success: true }
  } catch (error: any) {
    console.error('saveIncubatorSettings error:', error)
    return {
      success: false,
      error: error?.message || 'Gagal menyimpan pengaturan halaman inkubator.',
    }
  }
}
