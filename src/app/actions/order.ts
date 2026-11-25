'use server'

import { createClient } from 'next-sanity'
import { headers } from 'next/headers'
import { OrderFormData } from '@/types'
import { CartItem } from '@/context/CartContext'
import {
  formatOrderMessage,
  sendWhatsAppNotification,
  buildAdminCodLogMessage,
  buildAdminQrisVerifyMessage,
  buildAdminProgressLogMessage,
  buildSellerOrderMessage,
  buildCourierOfferMessage,
  buildCourierNextStepMessage,
  buildBuyerStatusMessage,
  getStatusLabelId,
  WaItemSummary,
} from '@/sanity/lib/whatsapp'
import { APP_SETTINGS_QUERY } from '@/sanity/lib/queries'
import { DEFAULT_PAWON_STATIC_QRIS, parseQRIS, validateCRC16 } from '@/lib/qrisEngine'
import { verifyOrderActionToken, normalizePhoneTo62 } from '@/lib/actionToken'
import { pickNextRoundRobinCourier } from '@/lib/courierAssigner'
import {
  resolveFinanceConfig,
  computeOrderFinanceSnapshot,
} from '@/lib/courierFinanceEngine'

const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2026-02-01',
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
})

/**
 * Mengambil base URL aktif (mendukung fallback IP LAN saat testing di mode pengembangan lokal).
 */
async function resolveRuntimeBaseUrl(): Promise<string> {
  const configured = (process.env.NEXT_PUBLIC_BASE_URL || '').trim()
  if (process.env.NODE_ENV !== 'production') {
    try {
      const h = await headers()
      const host = h.get('x-forwarded-host') || h.get('host') || ''
      const proto = h.get('x-forwarded-proto') || 'http'
      if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
        return `${proto}://${host}`
      }
    } catch {
      // Di luar HTTP request context (misal saat unit test Vitest)
    }
  }
  return configured || 'https://pawon.pondokrejo.id'
}

export async function getPublicPaymentSettings() {
  try {
    const settings = await writeClient.fetch(APP_SETTINGS_QUERY, {}, { cache: 'no-store' })
    const rawPayload = settings?.qrisStaticPayload?.trim()
    const hasValidCustomPayload = Boolean(rawPayload && validateCRC16(rawPayload))
    const activeStaticPayload = hasValidCustomPayload ? rawPayload : DEFAULT_PAWON_STATIC_QRIS
    const parsed = parseQRIS(activeStaticPayload)

    return {
      success: true,
      data: {
        isQrisEnabled: settings?.isQrisEnabled !== false,
        qrisMerchantName:
          settings?.qrisMerchantName?.trim() ||
          parsed.summary?.merchantName ||
          'PAWON PONDOKREJO',
        qrisNmid:
          settings?.qrisNmid?.trim() ||
          parsed.summary?.nmid ||
          'ID1026574925990',
        qrisStaticPayload: activeStaticPayload,
        isUsingDemoPayload: !hasValidCustomPayload,
        defaultShippingFee: settings?.defaultShippingFee ?? 6000,
      },
    }
  } catch (err) {
    console.warn('Fallback to default QRIS settings:', err)
    return {
      success: true,
      data: {
        isQrisEnabled: true,
        qrisMerchantName: 'PAWON PONDOKREJO',
        qrisNmid: 'ID1026574925990',
        qrisStaticPayload: DEFAULT_PAWON_STATIC_QRIS,
        isUsingDemoPayload: true,
        defaultShippingFee: 6000,
      },
    }
  }
}

/**
 * Mengelompokkan item pesanan berdasarkan lapak penjual dan mengirim WA berisi item milik masing-masing toko.
 */
async function notifyVendorsGrouped(
  baseUrl: string,
  orderNumber: string,
  customerName: string,
  courierName: string | null,
  rawItems: Array<{
    name: string
    quantity: number
    vendorId?: string
    vendorName?: string
    vendorPhone?: string
  }>,
  adminFallbackPhone: string
): Promise<string[]> {
  const byVendor = new Map<
    string,
    { phone: string; vendorName: string; items: WaItemSummary[] }
  >()

  for (const it of rawItems) {
    const cleanPhone = normalizePhoneTo62(it.vendorPhone || '')
    const key = it.vendorId || cleanPhone || it.vendorName || 'umkm'
    if (!byVendor.has(key)) {
      byVendor.set(key, {
        phone: cleanPhone,
        vendorName: it.vendorName || 'Penjual UMKM',
        items: [],
      })
    }
    byVendor.get(key)!.items.push({
      name: it.name,
      quantity: it.quantity,
      vendorName: it.vendorName,
    })
  }

  const notifiedPhones = new Set<string>()
  const sellerNames: string[] = []

  for (const group of byVendor.values()) {
    sellerNames.push(group.vendorName)
    const msg = buildSellerOrderMessage({
      baseUrl,
      orderNumber,
      customerName,
      courierName,
      items: group.items,
    })
    const targetPhone = group.phone || normalizePhoneTo62(adminFallbackPhone)
    if (targetPhone && !notifiedPhones.has(targetPhone)) {
      notifiedPhones.add(targetPhone)
      await sendWhatsAppNotification(targetPhone, msg)
    }
  }

  return Array.from(new Set(sellerNames))
}

export async function createOrder(
  formData: OrderFormData,
  items: CartItem[],
  totalAmount: number,
  shippingFee: number,
  customerId?: string
) {
  try {
    const settings = await writeClient.fetch(APP_SETTINGS_QUERY, {}, { cache: 'no-store' })
    const adminPhone = settings?.adminPhone || '+62895325586281'

    const productIds = items.map((i) => i._id)
    const productsWithVendorStatus =
      (await writeClient.fetch(
        `*[_type == "product" && _id in $productIds]{
          _id,
          name,
          stock,
          "vendor": vendor->{_id, name, phone, isOpen, closingMessage}
        }`,
        { productIds },
        { cache: 'no-store' }
      )) || []

    const productMetaById = new Map<string, any>()
    for (const p of productsWithVendorStatus) {
      productMetaById.set(String(p._id).replace(/^drafts\./, ''), p)
      if (p.vendor?.isOpen === false) {
        return {
          success: false,
          error: `Gagal membuat pesanan. Toko "${p.vendor.name}" (${p.name}) sedang tutup: ${p.vendor.closingMessage || 'Maaf, kami sedang tidak menerima pesanan.'}`,
        }
      }
    }

    const publishDraft = async (id: string) => {
      if (id.startsWith('drafts.') && typeof writeClient.createOrReplace === 'function') {
        const draft = await writeClient.fetch(`*[_id == $id][0]`, { id })
        if (draft) {
          const publishedId = id.replace('drafts.', '')
          const publishedDoc = { ...draft, _id: publishedId }
          await writeClient.createOrReplace(publishedDoc)
          await writeClient.delete(id)
          return publishedId
        }
      }
      return id.replace('drafts.', '')
    }

    const orderNumber = `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    const resolvedItems = await Promise.all(
      items.map(async (item) => ({
        _key: Math.random().toString(36).substr(2, 9),
        product: {
          _type: 'reference',
          _ref: await publishDraft(item._id),
        },
        quantity: item.quantity,
        price: item.price,
      }))
    )

    const isQris = formData.paymentMethod === 'qris'
    const nowIso = new Date().toISOString()

    // Untuk COD: langsung cari kurir giliran Round-Robin tanpa campur tangan Admin
    const roundRobinResult = !isQris
      ? await pickNextRoundRobinCourier(writeClient, [])
      : { courier: null, totalActiveCount: 0, remainingCount: 0 }

    const finConfig = resolveFinanceConfig(settings)
    const finSnap = computeOrderFinanceSnapshot(
      {
        orderCategory: 'product',
        totalAmount,
        shippingFee,
        items: resolvedItems.map((it) => ({ price: it.price, quantity: it.quantity })),
      },
      finConfig
    )

    const doc: any = {
      _type: 'order',
      orderCategory: 'product',
      orderNumber,
      customerName: formData.name,
      customerPhone: formData.phone,
      deliveryAddress: formData.address,
      totalAmount,
      shippingFee,
      productSubtotal: finSnap.productSubtotal,
      courierCommissionAmount: finSnap.courierCommissionAmount,
      kalurahanFeeAmount: finSnap.kalurahanFeeAmount,
      exceededFloatCash: finSnap.exceededFloatCash,
      paymentMethod: isQris ? 'qris' : 'cod',
      paymentStatus: 'unpaid',
      status: isQris ? 'pending' : 'processing',
      items: resolvedItems,
      rejectedCourierIds: [],
    }

    if (!isQris && roundRobinResult.courier) {
      doc.courier = {
        _type: 'reference',
        _ref: roundRobinResult.courier._id,
      }
      doc.courierOfferedAt = nowIso
    }

    if (customerId) {
      doc.customer = {
        _type: 'reference',
        _ref: await publishDraft(customerId),
      }
    }

    const result = await writeClient.create(doc)

    if (result._id) {
      const baseUrl = await resolveRuntimeBaseUrl()
      const baseOrderMessage = formatOrderMessage(
        orderNumber,
        formData.name,
        formData.phone,
        formData.address,
        items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
        totalAmount - shippingFee,
        shippingFee,
        totalAmount,
        isQris ? 'qris' : 'cod'
      )

      const enrichedItems = items.map((i) => {
        const cleanProdId = i._id.replace(/^drafts\./, '')
        const meta = productMetaById.get(cleanProdId)
        return {
          name: i.name,
          quantity: i.quantity,
          vendorId: meta?.vendor?._id,
          vendorName: meta?.vendor?.name || i.vendorName,
          vendorPhone: meta?.vendor?.phone,
        }
      })

      if (isQris) {
        // QRIS: Admin menerima 1 tautan verifikasi dana masuk (Penjual & Kurir menunggu lunas)
        const adminQrisMsg = buildAdminQrisVerifyMessage({
          baseUrl,
          orderNumber,
          baseMessage: baseOrderMessage,
          totalAmount,
        })
        await sendWhatsAppNotification(adminPhone, adminQrisMsg)

        const buyerQrisMsg = buildBuyerStatusMessage({
          baseUrl,
          orderNumber,
          customerName: formData.name,
          headline: 'MENUNGGU VERIFIKASI PEMBAYARAN QRIS',
          body: `Terima kasih telah berbelanja di PAWON Pondokrejo. Pesanan QRIS Anda sebesar Rp${totalAmount.toLocaleString('id-ID')} sedang diperiksa oleh Admin. Setelah pembayaran terverifikasi, pesanan otomatis diteruskan ke penjual dan kurir.`,
          items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
        })
        await sendWhatsAppNotification(formData.phone, buyerQrisMsg)
      } else {
        // COD: Otomatis penuh -> notif ke Penjual, Kurir giliran, Pembeli, dan WA Admin hanya Log
        const sellerNames = await notifyVendorsGrouped(
          baseUrl,
          orderNumber,
          formData.name,
          roundRobinResult.courier?.name || null,
          enrichedItems,
          adminPhone
        )

        const buyerCodMsg = buildBuyerStatusMessage({
          baseUrl,
          orderNumber,
          customerName: formData.name,
          headline: 'PESANAN COD DITERIMA',
          body: roundRobinResult.courier
            ? `Terima kasih telah berbelanja di PAWON Pondokrejo. Pesanan COD Anda sebesar Rp${totalAmount.toLocaleString('id-ID')} sudah diteruskan ke penjual dan kurir ${roundRobinResult.courier.name}.`
            : `Terima kasih telah berbelanja di PAWON Pondokrejo. Pesanan COD Anda sebesar Rp${totalAmount.toLocaleString('id-ID')} sudah diteruskan ke penjual untuk disiapkan.`,
          items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
        })
        await sendWhatsAppNotification(formData.phone, buyerCodMsg)

        if (roundRobinResult.courier) {
          const courierMsg = buildCourierOfferMessage({
            baseUrl,
            orderNumber,
            courierId: roundRobinResult.courier._id,
            courierName: roundRobinResult.courier.name,
            customerName: formData.name,
            deliveryAddress: formData.address,
            paymentMethod: 'cod',
            totalAmount,
            items: enrichedItems,
          })
          await sendWhatsAppNotification(roundRobinResult.courier.phone, courierMsg)
        }

        const adminLogMsg = buildAdminCodLogMessage({
          baseMessage: baseOrderMessage,
          courierName: roundRobinResult.courier?.name || null,
          sellerNames,
        })
        await sendWhatsAppNotification(adminPhone, adminLogMsg)
      }
    }

    return { success: true, orderId: result._id, orderNumber }
  } catch (error: any) {
    console.error('Order creation failed:', error)
    const detailMsg = error?.details?.description || error?.message || ''
    if (detailMsg.includes('Insufficient permissions') || !process.env.SANITY_API_WRITE_TOKEN) {
      return {
        success: false,
        error: 'Gagal membuat pesanan: izin penyimpanan data belum dikonfigurasi.',
      }
    }
    return { success: false, error: 'Gagal membuat pesanan: ' + (detailMsg || 'Terjadi kesalahan sistem.') }
  }
}

export async function updateOrderStatus(
  orderNumber: string,
  newStatus: string,
  note?: string,
  courierId?: string,
  courierPhoneParam?: string,
  actionGuard?: { role: string; token?: string | null }
) {
  try {
    const [order, settings] = await Promise.all([
      writeClient.fetch(
        `*[_type == "order" && orderNumber == $orderNumber][0]{
          _id, orderNumber, orderCategory, customerName, customerPhone, deliveryAddress,
          totalAmount, shippingFee, paymentMethod, paymentStatus, status,
          productSubtotal, courierCommissionAmount, kalurahanFeeAmount, exceededFloatCash,
          courierOfferedAt, rejectedCourierIds,
          "customerId": customer._ref,
          courier->{_id, phone, name, customFloatCash},
          items[]{
            quantity,
            price,
            product->{
              _id,
              name,
              stock,
              vendor->{_id, phone, name}
            }
          }
        }`,
        { orderNumber },
        { cache: 'no-store' }
      ),
      writeClient.fetch(APP_SETTINGS_QUERY, {}, { cache: 'no-store' }),
    ])

    const adminPhone = settings?.adminPhone || '+62895325586281'
    if (!order) {
      return { success: false, error: 'Pesanan tidak ditemukan.' }
    }

    // Validasi token pengaman bila dipanggil dari tautan WA (/order/[orderNumber]/action)
    if (actionGuard) {
      const valid = verifyOrderActionToken(
        actionGuard.token,
        orderNumber,
        actionGuard.role,
        newStatus,
        courierId
      )
      if (!valid) {
        return {
          success: false,
          error: 'Tautan aksi tidak valid atau sudah tidak berlaku.',
        }
      }
    }

    // Cegah perubahan status pesanan yang sudah selesai atau dibatalkan
    if (
      (order.status === 'completed' || order.status === 'cancelled') &&
      newStatus !== 'admin_override'
    ) {
      return {
        success: false,
        error: `Pesanan ini sudah berstatus "${getStatusLabelId(order.status)}" dan tidak dapat diubah lagi.`,
      }
    }

    const baseUrl = await resolveRuntimeBaseUrl()
    const cleanItems: WaItemSummary[] = (order.items || []).map((i: any) => ({
      name: i.product?.name || 'Produk',
      quantity: i.quantity || 1,
      vendorName: i.product?.vendor?.name,
    }))
    const itemsText = cleanItems.map((i) => `- ${i.name} (x${i.quantity})`).join('\n')

    const enrichedForSeller = (order.items || []).map((i: any) => ({
      name: i.product?.name || 'Produk',
      quantity: i.quantity || 1,
      vendorId: i.product?.vendor?._id,
      vendorName: i.product?.vendor?.name,
      vendorPhone: i.product?.vendor?.phone,
    }))

    // 1. Konfirmasi Pembayaran QRIS Masuk (atau konfirmasi manual COD via Admin) -> memicu Round-Robin
    if (newStatus === 'paid' || newStatus === 'processing_cod') {
      if (newStatus === 'paid' && order.paymentStatus === 'paid') {
        return { success: false, error: 'Pembayaran QRIS pesanan ini sudah dikonfirmasi sebelumnya.' }
      }
      if (newStatus === 'processing_cod' && order.status !== 'pending') {
        return { success: false, error: 'Pesanan COD ini sudah diproses sebelumnya.' }
      }

      const excludedIds: string[] = Array.isArray(order.rejectedCourierIds)
        ? order.rejectedCourierIds
        : []
      const rr = await pickNextRoundRobinCourier(writeClient, excludedIds, courierId)
      const nowIso = new Date().toISOString()

      const patchFields: Record<string, any> = {
        status: 'processing',
      }
      if (newStatus === 'paid') {
        patchFields.paymentStatus = 'paid'
      }
      if (rr.courier) {
        patchFields.courier = { _type: 'reference', _ref: rr.courier._id }
        patchFields.courierOfferedAt = nowIso
      }
      await writeClient.patch(order._id).set(patchFields).commit()

      // Notif Pembeli
      const buyerMsg = buildBuyerStatusMessage({
        baseUrl,
        orderNumber,
        customerName: order.customerName,
        headline:
          newStatus === 'paid'
            ? 'PEMBAYARAN QRIS DIKONFIRMASI'
            : 'PESANAN COD DIPROSES',
        body: rr.courier
          ? `${newStatus === 'paid' ? 'Pembayaran QRIS Anda sudah diterima.' : 'Pesanan COD Anda sudah dikonfirmasi.'} Barang sedang disiapkan penjual dan akan dikirim oleh ${rr.courier.name}.`
          : `${newStatus === 'paid' ? 'Pembayaran QRIS Anda sudah diterima.' : 'Pesanan COD Anda sudah dikonfirmasi.'} Barang sedang disiapkan penjual.`,
        items: cleanItems,
      })
      await sendWhatsAppNotification(order.customerPhone, buyerMsg)

      // Notif Penjual per Toko
      const sellerNames = await notifyVendorsGrouped(
        baseUrl,
        orderNumber,
        order.customerName,
        rr.courier?.name || null,
        enrichedForSeller,
        adminPhone
      )

      // Notif Kurir Giliran
      if (rr.courier) {
        const courierOffer = buildCourierOfferMessage({
          baseUrl,
          orderNumber,
          courierId: rr.courier._id,
          courierName: rr.courier.name,
          customerName: order.customerName,
          deliveryAddress: order.deliveryAddress,
          paymentMethod: order.paymentMethod === 'qris' ? 'qris' : 'cod',
          totalAmount: order.totalAmount || 0,
          items: cleanItems,
        })
        await sendWhatsAppNotification(rr.courier.phone, courierOffer)
      }

      // Log WA ke Admin (tanpa link)
      const adminLog = buildAdminProgressLogMessage({
        orderNumber,
        customerName: order.customerName,
        stageLabel:
          newStatus === 'paid'
            ? 'Pembayaran QRIS Terverifikasi & Diteruskan Otomatis'
            : 'Pesanan COD Diteruskan Otomatis',
        detail: `Penjual: ${sellerNames.join(', ') || '-'}. Kurir giliran: ${rr.courier?.name || 'Belum ada kurir aktif'}.`,
        itemsSummary: itemsText,
      })
      await sendWhatsAppNotification(adminPhone, adminLog)

      return { success: true }
    }

    // 2. Kurir Menolak Order -> Catat penolakan & lempar otomatis ke kurir giliran berikutnya
    if (newStatus === 'reject') {
      if (!['pending', 'processing', 'shipped', 'accepted'].includes(order.status)) {
        return {
          success: false,
          error: 'Pesanan sudah dalam tahap pengantaran dan tidak bisa ditolak.',
        }
      }

      const activeCourierId = order.courier?._id
      const rejectingId = courierId || activeCourierId
      if (activeCourierId && courierId && courierId !== activeCourierId) {
        return {
          success: false,
          error: 'Penawaran tugas ini sudah dialihkan ke kurir lain.',
        }
      }

      const prevRejected: string[] = Array.isArray(order.rejectedCourierIds)
        ? order.rejectedCourierIds
        : []
      const nextRejected = rejectingId
        ? Array.from(new Set([...prevRejected, rejectingId]))
        : prevRejected

      const rrNext = await pickNextRoundRobinCourier(writeClient, nextRejected)
      const prevCourierName = order.courier?.name || 'Kurir sebelumnya'

      if (rrNext.courier) {
        const nowIso = new Date().toISOString()
        await writeClient
          .patch(order._id)
          .set({
            status: 'processing',
            courier: { _type: 'reference', _ref: rrNext.courier._id },
            courierOfferedAt: nowIso,
            rejectedCourierIds: nextRejected,
          })
          .commit()

        const nextOfferMsg = buildCourierOfferMessage({
          baseUrl,
          orderNumber,
          courierId: rrNext.courier._id,
          courierName: rrNext.courier.name,
          customerName: order.customerName,
          deliveryAddress: order.deliveryAddress,
          paymentMethod: order.paymentMethod === 'qris' ? 'qris' : 'cod',
          totalAmount: order.totalAmount || 0,
          items: cleanItems,
          notice: `Dialihkan dari ${prevCourierName} kepada Anda sesuai giliran berikutnya.`,
        })
        await sendWhatsAppNotification(rrNext.courier.phone, nextOfferMsg)

        const adminLog = buildAdminProgressLogMessage({
          orderNumber,
          customerName: order.customerName,
          stageLabel: 'Pengalihan Kurir Otomatis',
          detail: `${prevCourierName} menolak tugas. Giliran dialihkan ke ${rrNext.courier.name}.`,
        })
        await sendWhatsAppNotification(adminPhone, adminLog)

        return {
          success: true,
          message: `Tugas berhasil dialihkan ke kurir berikutnya (${rrNext.courier.name}).`,
        }
      }

      // Semua kurir aktif menolak dalam 1 putaran
      await writeClient
        .patch(order._id)
        .set({
          courierOfferedAt: null,
          rejectedCourierIds: nextRejected,
        })
        .unset(['courier'])
        .commit()

      const adminAlert = buildAdminProgressLogMessage({
        orderNumber,
        customerName: order.customerName,
        stageLabel: 'Butuh Penugasan Kurir Manual',
        detail: `${prevCourierName} menolak tugas dan seluruh kurir aktif sudah mendapat penawaran. Silakan atur kurir melalui Pusat Kendali Admin.`,
        itemsSummary: itemsText,
      })
      await sendWhatsAppNotification(adminPhone, adminAlert)

      return {
        success: true,
        message: 'Penolakan dicatat dan Admin telah diberi laporan untuk penugasan manual.',
      }
    }

    // Validasi kepemilikan kurir bila aksi dilakukan lewat tautan WA kurir
    if (actionGuard?.role === 'courier' && courierId) {
      const rejectedList: string[] = Array.isArray(order.rejectedCourierIds)
        ? order.rejectedCourierIds
        : []
      if (
        !order.courier?._id ||
        order.courier._id !== courierId ||
        rejectedList.includes(courierId)
      ) {
        return {
          success: false,
          error: 'Penawaran tugas ini sudah kedaluwarsa atau dialihkan ke kurir lain.',
        }
      }
    }

    // 3. Kurir Menerima Order (Menuju Penjual)
    if (newStatus === 'accepted') {
      await writeClient
        .patch(order._id)
        .set({ status: 'accepted', courierOfferedAt: null })
        .commit()

      const activeCourierName = order.courier?.name || 'Kurir PAWON'
      const activeCourierId = order.courier?._id || courierId || ''

      // Kabari Kurir dengan langkah lanjutan (Ambil / Antar)
      if (order.courier?.phone) {
        const nextCourierMsg = buildCourierNextStepMessage({
          baseUrl,
          orderNumber,
          courierId: activeCourierId,
          courierName: activeCourierName,
          stage: 'accepted',
          customerName: order.customerName,
          deliveryAddress: order.deliveryAddress,
        })
        await sendWhatsAppNotification(order.courier.phone, nextCourierMsg)
      }

      // Kabari Penjual agar bersiap diserahkan ke kurir
      const sellerPhones = Array.from(
        new Set(
          enrichedForSeller
            .map((i: any) => normalizePhoneTo62(i.vendorPhone || ''))
            .filter(Boolean)
        )
      ) as string[]
      for (const sPhone of sellerPhones) {
        await sendWhatsAppNotification(
          sPhone,
          `*PAWON PONDOKREJO - INFO KURIR*\n--------------------------------\nNo. Pesanan : ${orderNumber}\nKurir       : ${activeCourierName}\n\nKurir telah menerima tugas dan sedang menuju lapak Anda untuk mengambil pesanan atas nama ${order.customerName}.`
        )
      }

      await sendWhatsAppNotification(
        adminPhone,
        buildAdminProgressLogMessage({
          orderNumber,
          customerName: order.customerName,
          stageLabel: 'Kurir Menerima Tugas',
          detail: `${activeCourierName} menerima tugas dan sedang menjemput pesanan ke penjual.`,
        })
      )

      return { success: true }
    }

    // 4. Penjual Menyerahkan / Kurir Sudah Mengambil Barang
    if (newStatus === 'shipped') {
      const triggeredBySeller =
        actionGuard?.role === 'seller' ||
        (order.status === 'processing' && actionGuard?.role !== 'courier')
      const shippedUpdates: Record<string, any> = { status: 'shipped' }
      // Pertahankan courierOfferedAt bila Penjual yang klik siap tapi Kurir belum Terima Order
      if (!triggeredBySeller) {
        shippedUpdates.courierOfferedAt = null
      }

      await writeClient.patch(order._id).set(shippedUpdates).commit()

      const activeCourierName = order.courier?.name || 'Kurir PAWON'
      const activeCourierId = order.courier?._id || courierId || ''

      if (order.courier?.phone) {
        if (triggeredBySeller && order.courierOfferedAt) {
          // Kurir belum sempat Terima Order saat Penjual sudah siap -> ingatkan dengan Terima/Tolak tetap aktif
          const offerReminder = buildCourierOfferMessage({
            baseUrl,
            orderNumber,
            courierId: activeCourierId,
            courierName: activeCourierName,
            customerName: order.customerName,
            deliveryAddress: order.deliveryAddress,
            paymentMethod: order.paymentMethod === 'qris' ? 'qris' : 'cod',
            totalAmount: order.totalAmount || 0,
            items: cleanItems,
            notice: 'Barang sudah disiapkan penjual dan siap diambil sekarang.',
          })
          await sendWhatsAppNotification(order.courier.phone, offerReminder)
        } else {
          const nextCourierMsg = buildCourierNextStepMessage({
            baseUrl,
            orderNumber,
            courierId: activeCourierId,
            courierName: activeCourierName,
            stage: 'shipped',
            customerName: order.customerName,
            deliveryAddress: order.deliveryAddress,
          })
          await sendWhatsAppNotification(order.courier.phone, nextCourierMsg)
        }
      }

      await sendWhatsAppNotification(
        order.customerPhone,
        buildBuyerStatusMessage({
          baseUrl,
          orderNumber,
          customerName: order.customerName,
          headline: 'PESANAN SIAP DIANTAR',
          body: `Barang pesanan Anda sudah siap dan diserahkan ke kurir (${activeCourierName}) untuk segera dikirim ke alamat Anda.`,
          items: cleanItems,
        })
      )

      await sendWhatsAppNotification(
        adminPhone,
        buildAdminProgressLogMessage({
          orderNumber,
          customerName: order.customerName,
          stageLabel: 'Barang Diserahkan ke Kurir',
          detail: `${note || 'Barang telah disiapkan penjual dan berada di tangan kurir.'}`,
        })
      )

      return { success: true }
    }

    // 5. Kurir Mulai Mengantar ke Alamat Pembeli
    if (newStatus === 'delivering') {
      await writeClient
        .patch(order._id)
        .set({ status: 'delivering', courierOfferedAt: null })
        .commit()

      const activeCourierName = order.courier?.name || 'Kurir PAWON'
      const activeCourierId = order.courier?._id || courierId || ''
      const paymentNotice =
        order.paymentMethod === 'qris'
          ? `Pembayaran pesanan ini SUDAH LUNAS VIA QRIS (Rp${order.totalAmount.toLocaleString('id-ID')}). Anda tidak perlu membayar tunai ke kurir.`
          : `Harap siapkan uang tunai sebesar Rp${order.totalAmount.toLocaleString('id-ID')} untuk pembayaran COD.`

      await sendWhatsAppNotification(
        order.customerPhone,
        buildBuyerStatusMessage({
          baseUrl,
          orderNumber,
          customerName: order.customerName,
          headline: 'KURIR MENUJU ALAMAT ANDA',
          body: `Pesanan Anda sedang dalam perjalanan menuju alamat Anda bersama ${activeCourierName}. ${paymentNotice}`,
          items: cleanItems,
        })
      )

      if (order.courier?.phone) {
        await sendWhatsAppNotification(
          order.courier.phone,
          buildCourierNextStepMessage({
            baseUrl,
            orderNumber,
            courierId: activeCourierId,
            courierName: activeCourierName,
            stage: 'delivering',
            customerName: order.customerName,
            deliveryAddress: order.deliveryAddress,
          })
        )
      }

      await sendWhatsAppNotification(
        adminPhone,
        buildAdminProgressLogMessage({
          orderNumber,
          customerName: order.customerName,
          stageLabel: 'Sedang Diantar Kurir',
          detail: `${activeCourierName} sedang dalam perjalanan menuju alamat pembeli.`,
          itemsSummary: itemsText,
        })
      )

      return { success: true }
    }

    // 6. Barang Sudah Diserahkan Kurir -> Tunggu Konfirmasi Pembeli
    if (newStatus === 'delivered') {
      await writeClient
        .patch(order._id)
        .set({ status: 'delivered', courierOfferedAt: null })
        .commit()

      await sendWhatsAppNotification(
        order.customerPhone,
        buildBuyerStatusMessage({
          baseUrl,
          orderNumber,
          customerName: order.customerName,
          headline: 'PESANAN TELAH DISERAHKAN',
          body: 'Kurir kami melaporkan bahwa pesanan Anda sudah diserahkan di alamat tujuan.',
          items: cleanItems,
          includeCompletionLinks: true,
        })
      )

      await sendWhatsAppNotification(
        adminPhone,
        buildAdminProgressLogMessage({
          orderNumber,
          customerName: order.customerName,
          stageLabel: 'Barang Tiba - Menunggu Konfirmasi Pembeli',
          detail: `${order.courier?.name || 'Kurir'} melaporkan barang sudah diterima warga. Menunggu pembeli menekan konfirmasi selesai.`,
          itemsSummary: itemsText,
        })
      )

      return { success: true }
    }

    // 7. Selesai (completed), Dibatalkan (cancelled), atau Kendala (problem)
    const patchUpdates: Record<string, any> = {
      status: newStatus,
      courierOfferedAt: null,
    }
    if (newStatus === 'completed') {
      if (order.paymentMethod !== 'qris') {
        patchUpdates.paymentStatus = 'paid'
      }
      patchUpdates.completedAt = new Date().toISOString()
      const finConfig = resolveFinanceConfig(settings)
      const courierFloat =
        typeof order.courier?.customFloatCash === 'number'
          ? order.courier.customFloatCash
          : finConfig.defaultCourierFloatCash
      const finSnap = computeOrderFinanceSnapshot(order, finConfig, courierFloat)
      patchUpdates.productSubtotal = finSnap.productSubtotal
      patchUpdates.courierCommissionAmount = finSnap.courierCommissionAmount
      patchUpdates.kalurahanFeeAmount = finSnap.kalurahanFeeAmount
      patchUpdates.exceededFloatCash = finSnap.exceededFloatCash
    }
    await writeClient.patch(order._id).set(patchUpdates).commit()

    if (newStatus === 'completed') {
      // Tambah rekor transaksi berhasil warga
      if (order.customerId) {
        await writeClient
          .patch(order.customerId.replace(/^drafts\./, ''))
          .setIfMissing({ successfulOrders: 0 })
          .inc({ successfulOrders: 1 })
          .commit()
          .catch(() => {})
      }

      // Kurangi stok produk saat pesanan baru selesai (guard: order.status sebelumnya bukan completed)
      if (order.status !== 'completed') {
        for (const item of order.items || []) {
          const prodId = item?.product?._id
          const qty = Number(item?.quantity) || 0
          const currentStock = Number(item?.product?.stock)
          if (prodId && qty > 0 && !Number.isNaN(currentStock)) {
            const nextStock = Math.max(0, currentStock - qty)
            await writeClient
              .patch(String(prodId).replace(/^drafts\./, ''))
              .set({ stock: nextStock })
              .commit()
              .catch(() => {})
          }
        }
      }

      await sendWhatsAppNotification(
        order.customerPhone,
        buildBuyerStatusMessage({
          baseUrl,
          orderNumber,
          customerName: order.customerName,
          headline: 'PESANAN SELESAI',
          body: 'Terima kasih, pesanan Anda telah selesai. Semoga bermanfaat bagi keluarga dan turut menggerakkan ekonomi warga Pondokrejo.',
        })
      )

      const sellerPhones = Array.from(
        new Set(
          enrichedForSeller
            .map((i: any) => normalizePhoneTo62(i.vendorPhone || ''))
            .filter(Boolean)
        )
      ) as string[]
      for (const sPhone of sellerPhones) {
        await sendWhatsAppNotification(
          sPhone,
          `*PAWON PONDOKREJO - PESANAN SELESAI*\n--------------------------------\nNo. Pesanan : ${orderNumber}\nPemesan     : ${order.customerName}\n\nPesanan telah diterima pembeli dengan baik dan transaksi dinyatakan selesai.`
        )
      }
    } else if (newStatus === 'cancelled') {
      await sendWhatsAppNotification(
        order.customerPhone,
        buildBuyerStatusMessage({
          baseUrl,
          orderNumber,
          customerName: order.customerName,
          headline: 'PESANAN DIBATALKAN',
          body: `Mohon maaf, pesanan Anda dibatalkan${note ? ` (${note})` : ''}. Anda dapat memilih produk serupa di etalase PAWON.`,
        })
      )
      if (order.courier?.phone) {
        await sendWhatsAppNotification(
          order.courier.phone,
          `*PAWON PONDOKREJO - PESANAN DIBATALKAN*\n--------------------------------\nNo. Pesanan : ${orderNumber}\n\nPesanan atas nama ${order.customerName} dibatalkan dan pengantaran tidak perlu dilanjutkan.`
        )
      }
    }

    await sendWhatsAppNotification(
      adminPhone,
      buildAdminProgressLogMessage({
        orderNumber,
        customerName: order.customerName,
        stageLabel: getStatusLabelId(newStatus),
        detail: note || `Status pesanan diperbarui menjadi ${getStatusLabelId(newStatus)}.`,
        itemsSummary: itemsText,
      })
    )

    return { success: true }
  } catch (error) {
    console.error('Update status failed:', error)
    return { success: false, error: 'Gagal memperbarui status pesanan.' }
  }
}
