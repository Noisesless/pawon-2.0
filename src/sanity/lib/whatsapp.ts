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

  if (params.stage === 'accepted' || params.stage === 'shipped') {
    const deliverUrl = buildOrderActionUrl(params.baseUrl, {
      orderNumber: params.orderNumber,
      role: 'courier',
      status: 'delivering',
      label: 'Barang Diambil dan Mulai Jalan Antar ke Pembeli',
      courierId: params.courierId,
    })

    return `*PAWON PONDOKREJO - LANGKAH PENGANTARAN*
${LINE}
Tugas pesanan ${params.orderNumber} tercatat atas nama ${params.courierName}.

Tujuan antar : ${params.customerName} (${params.deliveryAddress})

Saat barang sudah diambil dari penjual dan mulai berangkat mengantar, klik tautan berikut:
[1] Barang Diambil & Mulai Jalan Antar ke Pembeli:
${deliverUrl}

Portal Kurir: ${cleanBase}/kurir`
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

export function buildSettlementNotificationMessage(params: {
  kind:
    | 'daily_cutoff'
    | 'admin_daily_summary'
    | 'warning_24h'
    | 'blocked_48h'
    | 'admin_blocked_48h'
  courierName: string
  periodKey: string
  orderCount: number
  codOrderTotal: number
  qrisOrderTotal: number
  sellerCashPaid: number
  courierCommissionTotal: number
  netContinueNextDay: number
  netFullClose: number
  maxDelayHours: number
}): string {
  const fmt = (n: number) => `Rp${Math.abs(Math.round(n)).toLocaleString('id-ID')}`
  const actionLine =
    params.netContinueNextDay >= 0
      ? `Setor ke Admin (Lanjut Kas Besok) : ${fmt(params.netContinueNextDay)}`
      : `Refill dari Admin (Lanjut Kas)     : ${fmt(params.netContinueNextDay)}`
  const fullCloseLine =
    params.netFullClose >= 0
      ? `Setor Penuh (Tutup Kas)            : ${fmt(params.netFullClose)}`
      : `Ganti Talangan + Upah dari Admin   : ${fmt(params.netFullClose)}`

  if (params.kind === 'daily_cutoff') {
    return `*PAWON PONDOKREJO - REKAP KAS HARIAN (16.00 WIB)*
${LINE}
Kurir       : ${params.courierName}
Periode     : ${params.periodKey}
Order Selesai: ${params.orderCount} pesanan
${LINE}
Bayar ke Penjual : ${fmt(params.sellerCashPaid)}
Tagihan COD      : ${fmt(params.codOrderTotal)}
Pesanan QRIS     : ${fmt(params.qrisOrderTotal)}
Hak Upah Kurir   : ${fmt(params.courierCommissionTotal)}
${LINE}
${actionLine}
${fullCloseLine}

Mohon lakukan penyelesaian kas dengan Admin Kalurahan sebelum batas ${params.maxDelayHours} jam agar giliran pengantaran tetap aktif.`
  }

  if (params.kind === 'warning_24h') {
    return `*PAWON PONDOKREJO - PENGINGAT SETORAN KAS*
${LINE}
Halo ${params.courierName}, laporan kas harian periode ${params.periodKey} belum diselesaikan dengan Admin Kalurahan (> 24 jam).

${actionLine}

Mohon segera selesaikan sebelum batas maksimal ${params.maxDelayHours} jam agar akun tidak dibekukan sementara dari antrean.`
  }

  if (params.kind === 'blocked_48h') {
    return `*PAWON PONDOKREJO - GILIRAN KURIR DIBEKUKAN SEMENTARA*
${LINE}
Halo ${params.courierName}, laporan kas harian periode ${params.periodKey} telah melewati batas ${params.maxDelayHours} jam.

Penugasan order baru untuk Anda dihentikan sementara. Silakan selesaikan rekap kas dengan Admin Kalurahan untuk mengaktifkan kembali giliran Anda.`
  }

  if (params.kind === 'admin_blocked_48h') {
    return `*PAWON PONDOKREJO - KURIR MELEWATI BATAS ${params.maxDelayHours} JAM*
${LINE}
Kurir   : ${params.courierName}
Periode : ${params.periodKey}
${actionLine}

Kurir ini otomatis dibekukan dari antrean pengantaran sampai Admin mengonfirmasi setoran/refill di menu Keuangan Kurir.`
  }

  return `*PAWON PONDOKREJO - REKAP KAS KURIR PERIODE ${params.periodKey}*
${LINE}
Kurir        : ${params.courierName}
Order Selesai: ${params.orderCount}
Hak Upah     : ${fmt(params.courierCommissionTotal)}
${actionLine}`
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
