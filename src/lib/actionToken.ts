import crypto from 'crypto'

/**
 * Normalisasi nomor telepon ke format internasional 628...
 */
export function normalizePhoneTo62(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '')
  if (!clean) return ''
  if (clean.startsWith('0')) return '62' + clean.slice(1)
  if (clean.startsWith('8')) return '62' + clean
  return clean
}

/**
 * Menghasilkan varian format nomor HP (08..., 628..., +628...) agar login portal tahan perbedaan format penyimpanan.
 */
export function getPhoneLookupVariants(phone: string): string[] {
  const raw = (phone || '').trim()
  const as62 = normalizePhoneTo62(raw)
  if (!as62) return raw ? [raw] : []
  const as08 = as62.startsWith('62') ? '0' + as62.slice(2) : as62
  const asPlus62 = '+' + as62
  return Array.from(new Set([raw, as62, as08, asPlus62].filter(Boolean)))
}

function getSigningSecret(): string {
  return (
    process.env.CRON_SECRET ||
    process.env.SANITY_API_WRITE_TOKEN ||
    'pawon-action-guard'
  )
}

/**
 * Membuat token HMAC ringkas untuk mengamankan tautan aksi pada pesan WhatsApp.
 */
export function createOrderActionToken(
  orderNumber: string,
  role: string,
  status: string,
  courierId?: string
): string {
  const payload = `${orderNumber}|${role}|${status}|${courierId || ''}`
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('hex')
    .slice(0, 16)
}

/**
 * Memverifikasi keaslian token tautan aksi WhatsApp (constant-time comparison).
 */
export function verifyOrderActionToken(
  token: string | undefined | null,
  orderNumber: string,
  role: string,
  status: string,
  courierId?: string
): boolean {
  if (!token) return false
  const expected = createOrderActionToken(orderNumber, role, status, courierId)
  if (token.length !== expected.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}

/**
 * Membangun URL tautan aksi WhatsApp lengkap beserta token verifikasi.
 */
export function buildOrderActionUrl(
  baseUrl: string,
  params: {
    orderNumber: string
    role: string
    status: string
    label: string
    courierId?: string
  }
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '')
  const search = new URLSearchParams({
    role: params.role,
    status: params.status,
    label: params.label,
  })
  if (params.courierId) {
    search.set('courierId', params.courierId)
  }
  const token = createOrderActionToken(
    params.orderNumber,
    params.role,
    params.status,
    params.courierId
  )
  search.set('k', token)
  return `${cleanBase}/order/${params.orderNumber}/action?${search.toString()}`
}
