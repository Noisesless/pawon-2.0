/**
 * QRIS Dynamic Engine — PAWON Pondokrejo
 * EMVCo MPM Specification compliant for QRIS (Quick Response Code Indonesian Standard)
 *
 * Adapted from Typehand qrisEngine with TypeScript strict typing & nested NMID extraction:
 * - Computes CRC-16/CCITT-FALSE (poly: 0x1021, init: 0xFFFF, xorOut: 0x0000)
 * - Parses TLV (Tag-Length-Value) root and nested merchant structures (Tag 26 & 51)
 * - Injects Point of Initiation Method (Tag 01 = '12' Dynamic)
 * - Injects/updates Transaction Amount (Tag 54 = integer IDR nominal)
 * - Recalculates Tag 63 checksum ensuring exact payment amount locked for buyers
 */

export interface TLVNode {
  tag: string
  length: number
  value: string
  name: string
}

export interface ParsedQRIS {
  isValid: boolean
  isValidCRC?: boolean
  error?: string
  data?: Record<string, TLVNode>
  summary?: {
    merchantName: string
    merchantCity: string
    countryCode: string
    nmid: string
    amount: number | null
    isStatic: boolean
    currency: string
  }
}

export const TAG_NAMES: Record<string, string> = {
  '00': 'Payload Format Indicator',
  '01': 'Point of Initiation Method', // 11 = Static, 12 = Dynamic
  '26': 'Merchant Account Information (National / GPN)',
  '51': 'Merchant Account Information (Domestic GPN)',
  '52': 'Merchant Category Code (MCC)',
  '53': 'Transaction Currency (360 = IDR)',
  '54': 'Transaction Amount',
  '55': 'Tip Indicator',
  '56': 'Value of Convenience Fee Fixed',
  '57': 'Value of Convenience Fee Percentage',
  '58': 'Country Code (ID)',
  '59': 'Merchant Name',
  '60': 'Merchant City',
  '61': 'Postal Code',
  '62': 'Additional Data Field Template',
  '63': 'CRC Checksum',
}

/**
 * Calculates CRC-16/CCITT-FALSE checksum for EMVCo/QRIS payload
 * @param data Input string or Uint8Array up to and including '6304'
 * @returns 4-character uppercase hexadecimal (e.g. "3A82")
 */
export function calculateCRC16(data: string | Uint8Array): string {
  let crc = 0xffff
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : new Uint8Array(data)

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]
    crc ^= byte << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc = crc << 1
      }
      crc &= 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Validates if the checksum in Tag 63 matches the payload
 */
export function validateCRC16(payload: string): boolean {
  if (!payload || payload.length < 8) return false

  const clean = payload.trim()
  const tag63Index = clean.lastIndexOf('6304')
  if (tag63Index === -1 || tag63Index !== clean.length - 8) return false

  const dataToCalculate = clean.substring(0, tag63Index + 4)
  const expectedCRC = clean.substring(tag63Index + 4)
  const calculatedCRC = calculateCRC16(dataToCalculate)

  return calculatedCRC === expectedCRC.toUpperCase()
}

/**
 * Parses low-level TLV string into key-value map
 */
export function parseTLVString(tlvString: string): Record<string, TLVNode> | null {
  if (!tlvString || typeof tlvString !== 'string') return null
  const result: Record<string, TLVNode> = {}
  let idx = 0

  while (idx < tlvString.length) {
    if (idx + 4 > tlvString.length) return null

    const tag = tlvString.substring(idx, idx + 2)
    const lengthStr = tlvString.substring(idx + 2, idx + 4)
    const length = parseInt(lengthStr, 10)

    if (isNaN(length) || length < 0) return null

    idx += 4
    if (idx + length > tlvString.length) return null

    const value = tlvString.substring(idx, idx + length)
    idx += length

    result[tag] = {
      tag,
      length,
      value,
      name: TAG_NAMES[tag] || 'Reserved / Merchant Specific',
    }
  }

  return result
}

/**
 * Extracts NMID from nested Tag 51 or Tag 26 TLV structure
 */
function extractNmid(rootData: Record<string, TLVNode>): string {
  const tag51 = rootData['51']?.value ? parseTLVString(rootData['51'].value) : null
  if (tag51?.['02']?.value) return tag51['02'].value

  const tag26 = rootData['26']?.value ? parseTLVString(rootData['26'].value) : null
  if (tag26?.['02']?.value) return tag26['02'].value
  if (tag26?.['01']?.value) return tag26['01'].value

  return 'ID1026000000000'
}

/**
 * Parses complete QRIS payload and extracts high-level metadata
 */
export function parseQRIS(payload: string): ParsedQRIS {
  if (!payload || !payload.trim()) {
    return { isValid: false, error: 'Payload kosong' }
  }

  const cleanPayload = payload.trim()
  const isValidCRC = validateCRC16(cleanPayload)
  const rootData = parseTLVString(cleanPayload)

  if (!rootData || !rootData['00'] || !rootData['58']) {
    return { isValid: false, error: 'Format TLV QRIS tidak valid.' }
  }

  const merchantName = rootData['59']?.value || 'PAWON PONDOKREJO'
  const merchantCity = rootData['60']?.value || 'SLEMAN'
  const countryCode = rootData['58']?.value || 'ID'
  const nmid = extractNmid(rootData)
  const amount = rootData['54']?.value ? parseFloat(rootData['54'].value) : null
  const isStatic = rootData['01']?.value === '11'

  return {
    isValid: isValidCRC,
    isValidCRC,
    data: rootData,
    summary: {
      merchantName,
      merchantCity,
      countryCode,
      nmid,
      amount,
      isStatic,
      currency: rootData['53']?.value === '360' ? 'IDR' : rootData['53']?.value || 'IDR',
    },
  }
}

/**
 * Default valid EMVCo Static QRIS payload for local dev / staging testing
 * before Kalurahan Pondokrejo's official bank QRIS string is entered in Sanity Studio.
 */
export function getDefaultPawonStaticQris(): string {
  const bodyWithoutCrc =
    '000201' +
    '010211' +
    '26610016ID.CO.SHOPEE.WWW01189360091800235458010208235458010303UMI' +
    '51440014ID.CO.QRIS.WWW0215ID10265749259900303UMI' +
    '52045971' +
    '5303360' +
    '5802ID' +
    '5916PAWON PONDOKREJO' +
    '6006SLEMAN' +
    '610555512' +
    '62070703A01' +
    '6304'
  return bodyWithoutCrc + calculateCRC16(bodyWithoutCrc)
}

export const DEFAULT_PAWON_STATIC_QRIS = getDefaultPawonStaticQris()

/**
 * Generates dynamic QRIS string with locked nominal amount from static QRIS payload
 * @param staticPayload Raw static QRIS string from bank/e-wallet merchant
 * @param nominal Amount in IDR (integer, min 500)
 * @returns Dynamic QRIS payload ready for QR rendering
 */
export function generateDynamicQRIS(
  staticPayload: string,
  nominal: number | string,
  options: { pointOfInitiation?: '11' | '12'; merchantNameOverride?: string } = {}
): string {
  const { pointOfInitiation = '12', merchantNameOverride } = options
  if (!staticPayload || typeof staticPayload !== 'string') {
    throw new Error('Payload QRIS statis tidak boleh kosong')
  }

  const cleanPayload = staticPayload.trim()
  const amount = typeof nominal === 'number' ? nominal : parseFloat(nominal)
  if (isNaN(amount) || amount < 500) {
    throw new Error('Nominal pembayaran minimal adalah Rp 500')
  }
  const amountStr = Math.round(amount).toString()

  // Extract all tags preserving appearance sequence
  const tagsList: Array<{ tag: string; value: string }> = []
  let idx = 0
  while (idx < cleanPayload.length) {
    if (idx + 4 > cleanPayload.length) break
    const tag = cleanPayload.substring(idx, idx + 2)
    const len = parseInt(cleanPayload.substring(idx + 2, idx + 4), 10)
    if (isNaN(len) || idx + 4 + len > cleanPayload.length) break
    const value = cleanPayload.substring(idx + 4, idx + 4 + len)
    tagsList.push({ tag, value })
    idx += 4 + len
  }

  if (tagsList.length === 0) {
    throw new Error('Format QRIS tidak valid')
  }

  // Strip Tag 63 (CRC) so it can be recalculated cleanly
  const tags = tagsList.filter((t) => t.tag !== '63')

  // Point of Initiation Method: 11 (Static) -> 12 (Dynamic)
  const tag01 = tags.find((t) => t.tag === '01')
  if (tag01) {
    tag01.value = pointOfInitiation
  } else {
    const idx00 = tags.findIndex((t) => t.tag === '00')
    if (idx00 !== -1) tags.splice(idx00 + 1, 0, { tag: '01', value: pointOfInitiation })
    else tags.unshift({ tag: '01', value: pointOfInitiation })
  }

  // Transaction Amount: Tag 54
  const tag54 = tags.find((t) => t.tag === '54')
  if (tag54) {
    tag54.value = amountStr
  } else {
    const idx53 = tags.findIndex((t) => t.tag === '53')
    if (idx53 !== -1) {
      tags.splice(idx53 + 1, 0, { tag: '54', value: amountStr })
    } else {
      const idx58 = tags.findIndex((t) => t.tag === '58')
      if (idx58 !== -1) {
        tags.splice(idx58, 0, { tag: '54', value: amountStr })
      } else {
        tags.push({ tag: '54', value: amountStr })
      }
    }
  }

  // Optional merchant name override (max 25 chars per EMVCo spec)
  if (merchantNameOverride && merchantNameOverride.trim()) {
    const cleanName = merchantNameOverride.trim().slice(0, 25)
    const tag59 = tags.find((t) => t.tag === '59')
    if (tag59) {
      tag59.value = cleanName
    }
  }

  // Rebuild string before CRC
  let rebuilt = ''
  for (const t of tags) {
    const lenStr = t.value.length.toString().padStart(2, '0')
    rebuilt += t.tag + lenStr + t.value
  }

  // Append Tag 63 and compute CRC-16
  rebuilt += '6304'
  const newCrc = calculateCRC16(rebuilt)
  rebuilt += newCrc

  return rebuilt
}
