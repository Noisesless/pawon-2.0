import { normalizePhoneTo62, buildOrderActionUrl } from '@/lib/actionToken'

const LINE = '--------------------------------'

export interface WaItemSummary {
  name: string
  quantity: number
  price?: number
  vendorName?: string
}

export function getStatusLabelId(status: string): string {
  const map: Record<string, string> = {
    pending: 'Menunggu Konfirmasi Pembayaran',
    processing: 'Sedang Disiapkan Penjual',
    accepted: 'Kurir Menjemput ke Penjual',
    shipped: 'Barang Sudah Diambil Kurir',
    delivering: 'Sedang Diantar ke Pembeli',
    delivered: 'Pesanan Sudah Diserahkan ke Pembeli',
    completed: 'Pesanan Selesai',
    cancelled: 'Pesanan Dibatalkan',
    problem: 'Ada Kendala Pengiriman',
  }
  return map[status] || status
}

export function formatOrderMessage(
  orderNumber: string,
  customerName: string,
  customerPhone: string,
  customerAddress: string,
  items: { name: string; quantity: number; price: number }[],
  totalPrice: number,
  shippingFee: number,
  grandTotal: number,
  paymentMethod: 'cod' | 'qris' = 'cod'
): string {
  const itemLines = items
    .map(
      (item, index) =>
        `${index + 1}. *${item.name}* (x${item.quantity}) - Rp${(item.price * item.quantity).toLocaleString('id-ID')}`
    )
    .join('\n')

  const paymentLabel =
    paymentMethod === 'qris' ? 'QRIS (Menunggu Verifikasi)' : 'COD (Bayar di Tempat)'

  return `*PAWON PONDOKREJO - PESANAN BARU*
${LINE}
No. Pesanan : ${orderNumber}
Pemesan     : ${customerName}
WhatsApp    : ${customerPhone}
Alamat      : ${customerAddress}
Metode      : ${paymentLabel}
${LINE}
Daftar Belanja:
${itemLines}

Subtotal    : Rp${totalPrice.toLocaleString('id-ID')}
Ongkir      : Rp${shippingFee.toLocaleString('id-ID')}
*Total      : Rp${grandTotal.toLocaleString('id-ID')}*
${LINE}`
}

export function formatServiceOrderMessage(
  orderNumber: string,
  customerName: string,
  customerPhone: string,
  serviceAddress: string,
  serviceName: string,
  serviceDate: string,
  price: number
): string {
  const dateStr = new Date(serviceDate).toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
  })
  return `*PAWON PONDOKREJO - PEMESANAN JASA BARU*
${LINE}
No. Pesanan : ${orderNumber}
Pemesan     : ${customerName}
WhatsApp    : ${customerPhone}
Alamat      : ${serviceAddress}
Jadwal      : ${dateStr}
Layanan     : ${serviceName}
Estimasi    : Rp${price.toLocaleString('id-ID')}
${LINE}`
}

/**
 * Pesan WA Log ke Admin untuk COD (Otomatis, TANPA tombol/link aksi).
 */
export function buildAdminCodLogMessage(params: {
  baseMessage: string
  courierName?: string | null
  sellerNames: string[]
}): string {
  const sellerText =
    params.sellerNames.length > 0 ? params.sellerNames.join(', ') : 'UMKM Pondokrejo'
  const courierText = params.courierName
    ? `${params.courierName} (Giliran Otomatis)`
    : 'Belum ada kurir aktif bertugas'

  return `${params.baseMessage}
*LOG PROGRES OTOMATIS*
Penjual     : ${sellerText}
Kurir       : ${courierText}

Pesanan COD ini sudah otomatis diteruskan ke penjual dan kurir. Admin hanya memantau log transaksi.`
}

/**
 * Pesan WA Verifikasi QRIS ke Admin (1 tautan konfirmasi dana masuk, tanpa pilih kurir manual).
 */
export function buildAdminQrisVerifyMessage(params: {
  baseUrl: string
  orderNumber: string
  baseMessage: string
  totalAmount: number
}): string {
  const confirmUrl = buildOrderActionUrl(params.baseUrl, {
    orderNumber: params.orderNumber,
    role: 'admin',
    status: 'paid',
    label: 'Konfirmasi Pembayaran QRIS Masuk',
  })

  return `${params.baseMessage}
*VERIFIKASI PEMBAYARAN QRIS*
Pembeli memilih pembayaran QRIS sebesar *Rp${params.totalAmount.toLocaleString('id-ID')}*.
Mohon periksa mutasi masuk terlebih dahulu. Jika dana sudah diterima, klik tautan berikut agar pesanan otomatis diteruskan ke penjual dan kurir bergiliran:

[1] Konfirmasi Pembayaran QRIS Masuk:
${confirmUrl}`
}

/**
 * Pesan WA Log progres umum ke Admin (Tanpa simbol/istilah teknis).
 */
export function buildAdminProgressLogMessage(params: {
  orderNumber: string
  customerName: string
  stageLabel: string
  detail: string
  itemsSummary?: string
}): string {
  const itemsBlock = params.itemsSummary ? `\nRincian Barang:\n${params.itemsSummary}` : ''
  return `*PAWON PONDOKREJO - LOG TRANSAKSI*
${LINE}
No. Pesanan : ${params.orderNumber}
Pemesan     : ${params.customerName}
Status      : ${params.stageLabel}
Keterangan  : ${params.detail}${itemsBlock}
${LINE}`
}

/**
 * Pesan WA untuk Penjual (berisi item khusus lapaknya saja + tombol aksi).
 */
export function buildSellerOrderMessage(params: {
  baseUrl: string
  orderNumber: string
  customerName: string
  courierName?: string | null
  items: WaItemSummary[]
}): string {
  const courierText = params.courierName || 'Menunggu penugasan kurir'
  const itemLines = params.items
    .map((i) => `- ${i.name} (x${i.quantity})`)
    .join('\n')

  const shippedUrl = buildOrderActionUrl(params.baseUrl, {
    orderNumber: params.orderNumber,
    role: 'seller',
    status: 'shipped',
    label: 'Pesanan Siap Diambil Kurir',
  })
  const cancelUrl = buildOrderActionUrl(params.baseUrl, {
    orderNumber: params.orderNumber,
    role: 'seller',
    status: 'cancelled',
    label: 'Stok Kosong / Batalkan Pesanan',
  })

  return `*PAWON PONDOKREJO - PESANAN MASUK PENJUAL*
${LINE}
No. Pesanan : ${params.orderNumber}
Pemesan     : ${params.customerName}
Kurir       : ${courierText}
${LINE}
Barang yang perlu disiapkan:
${itemLines}

Pilihan tindakan penjual:
[1] Pesanan Siap / Diserahkan ke Kurir:
${shippedUrl}

[2] Stok Kosong / Batalkan Pesanan:
${cancelUrl}`
}

/**
 * Pesan WA Penawaran Awal untuk Kurir Giliran (Terima Order atau Tolak Order).
 */
export function buildCourierOfferMessage(params: {
  baseUrl: string
  orderNumber: string
  courierId: string
  courierName: string
  customerName: string
  deliveryAddress: string
  paymentMethod: 'cod' | 'qris'
  totalAmount: number
  items: WaItemSummary[]
  notice?: string
}): string {
  const cleanBase = params.baseUrl.replace(/\/+$/, '')
  const billingText =
    params.paymentMethod === 'qris'
      ? 'Lunas via QRIS (Rp 0 - Jangan tagih tunai ke pembeli)'
      : `Rp${params.totalAmount.toLocaleString('id-ID')} (Tagih tunai COD ke pembeli)`

  const itemLines = params.items
    .map((i) => `- ${i.name} (x${i.quantity}) dari ${i.vendorName || 'Penjual'}`)
    .join('\n')

  const acceptUrl = buildOrderActionUrl(params.baseUrl, {
    orderNumber: params.orderNumber,
    role: 'courier',
    status: 'accepted',
    label: 'Terima Tugas Pengantaran',
    courierId: params.courierId,
  })
  const rejectUrl = buildOrderActionUrl(params.baseUrl, {
    orderNumber: params.orderNumber,
    role: 'courier',
    status: 'reject',
    label: 'Tolak Tugas Pengantaran',
    courierId: params.courierId,
  })

  const extraNotice = params.notice ? `\nCatatan: ${params.notice}\n` : ''

  return `*PAWON PONDOKREJO - TUGAS PENGANTARAN BARU*
${LINE}
Halo ${params.courierName}, ada giliran pengantaran pesanan baru untuk Anda.${extraNotice}
No. Pesanan : ${params.orderNumber}
Penerima    : ${params.customerName}
Alamat      : ${params.deliveryAddress}
Tagihan     : ${billingText}
${LINE}
Barang yang diambil:
${itemLines}

Mohon segera pilih tindakan berikut:
[1] Terima Order (Menuju Penjual):
${acceptUrl}

[2] Tolak Order (Alihkan ke Kurir Lain):
${rejectUrl}

Portal Kurir: ${cleanBase}/kurir`
}

/**
 * Pesan WA Tindak Lanjut Bertahap untuk Kurir setelah Terima Order / Ambil / Antar.
 */
export function buildCourierNextStepMessage(params: {
  baseUrl: string
  orderNumber: string
  courierId: string
  courierName: string
  stage: 'accepted' | 'shipped' | 'delivering'
  customerName: string
  deliveryAddress: string
}): string {
  const cleanBase = params.baseUrl.replace(/\/+$/, '')

  if (params.stage === 'accepted') {
    const pickedUrl = buildOrderActionUrl(params.baseUrl, {
      orderNumber: params.orderNumber,
      role: 'courier',
      status: 'shipped',
      label: 'Barang Sudah Diambil dari Penjual',
      courierId: params.courierId,
    })
    const deliverUrl = buildOrderActionUrl(params.baseUrl, {
      orderNumber: params.orderNumber,
      role: 'courier',
      status: 'delivering',
      label: 'Mulai Jalan Antar ke Pembeli',
      courierId: params.courierId,
    })

    return `*PAWON PONDOKREJO - LANGKAH PENGANTARAN*
${LINE}
Tugas pesanan ${params.orderNumber} sudah tercatat atas nama ${params.courierName}.

Tujuan antar : ${params.customerName} (${params.deliveryAddress})

Langkah berikutnya setelah sampai di penjual:
[1] Barang Sudah Diambil dari Penjual:
${pickedUrl}

[2] Langsung Mulai Jalan Antar ke Pembeli:
${deliverUrl}

Portal Kurir: ${cleanBase}/kurir`
  }

  if (params.stage === 'shipped') {
    const deliverUrl = buildOrderActionUrl(params.baseUrl, {
      orderNumber: params.orderNumber,
      role: 'courier',
      status: 'delivering',
      label: 'Mulai Jalan Antar ke Pembeli',
      courierId: params.courierId,
    })
    return `*PAWON PONDOKREJO - BARANG SIAP DIANTAR*
${LINE}
Pesanan ${params.orderNumber} sudah siap dibawa ke alamat ${params.customerName} (${params.deliveryAddress}).

Saat mulai berangkat mengantar, klik tautan berikut:
[1] Mulai Jalan Antar ke Pembeli:
${deliverUrl}`
  }

  // stage === 'delivering'
  const deliveredUrl = buildOrderActionUrl(params.baseUrl, {
    orderNumber: params.orderNumber,
    role: 'courier',
    status: 'delivered',
    label: 'Pesanan Sudah Diserahkan ke Pembeli',
    courierId: params.courierId,
  })
  const problemUrl = buildOrderActionUrl(params.baseUrl, {
    orderNumber: params.orderNumber,
    role: 'courier',
    status: 'problem',
    label: 'Laporkan Kendala Pengiriman',
    courierId: params.courierId,
  })

  return `*PAWON PONDOKREJO - KONFIRMASI PENGANTARAN*
${LINE}
Anda sedang dalam perjalanan mengantar pesanan ${params.orderNumber} ke ${params.customerName}.

Saat pesanan sudah diterima pembeli, klik tautan berikut:
[1] Pesanan Sudah Diserahkan ke Pembeli:
${deliveredUrl}

[2] Laporkan Kendala di Lapangan:
${problemUrl}`
}

/**
 * Pesan WA Pembaruan Status ke Pembeli (termasuk tombol konfirmasi terima saat delivered).
 */
export function buildBuyerStatusMessage(params: {
  baseUrl: string
  orderNumber: string
  customerName: string
  headline: string
  body: string
  items?: WaItemSummary[]
  includeCompletionLinks?: boolean
}): string {
  const cleanBase = params.baseUrl.replace(/\/+$/, '')
  const trackUrl = `${cleanBase}/track/${params.orderNumber}`
  const itemsBlock =
    params.items && params.items.length > 0
      ? `\nDaftar Barang:\n${params.items.map((i) => `- ${i.name} (x${i.quantity})`).join('\n')}\n`
      : ''

  let actionBlock = ''
  if (params.includeCompletionLinks) {
    const completeUrl = buildOrderActionUrl(params.baseUrl, {
      orderNumber: params.orderNumber,
      role: 'buyer',
      status: 'completed',
      label: 'Konfirmasi Pesanan Sudah Diterima',
    })
    const problemUrl = buildOrderActionUrl(params.baseUrl, {
      orderNumber: params.orderNumber,
      role: 'buyer',
      status: 'problem',
      label: 'Laporkan Kendala Pesanan',
    })
    actionBlock = `

Mohon konfirmasi penerimaan pesanan Anda:
[1] Pesanan Sudah Diterima dengan Baik:
${completeUrl}

[2] Laporkan Masalah Pesanan:
${problemUrl}`
  }

  return `*PAWON PONDOKREJO - ${params.headline}*
${LINE}
Halo ${params.customerName},

${params.body}
No. Pesanan : ${params.orderNumber}
${itemsBlock}${actionBlock}

Lacak pesanan Anda di:
${trackUrl}`
}

/**
 * Mengirim pesan WhatsApp menggunakan API Fonnte.
 */
export async function sendWhatsAppNotification(target: string, message: string) {
  const token = process.env.FONNTE_TOKEN || process.env.FONNTE_API_TOKEN

  if (!token) {
    console.warn('FONNTE_TOKEN / FONNTE_API_TOKEN tidak ditemukan di environment variables.')
    return { success: false, error: 'API Token tidak dikonfigurasi.' }
  }

  const cleanTarget = normalizePhoneTo62(target)
  if (!cleanTarget) {
    return { success: false, error: 'Nomor tujuan tidak valid.' }
  }

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: new URLSearchParams({
        target: cleanTarget,
        message: message,
        countryCode: '62',
      }),
    })

    const data = await response.json()
    console.log(`Fonnte API Response (${cleanTarget}):`, data)
    return { success: data.status, data }
  } catch (error) {
    console.error(`Fonnte API Error Detail (${cleanTarget}):`, error)
    return { success: false, error: 'Gagal menghubungi server Fonnte.' }
  }
}
