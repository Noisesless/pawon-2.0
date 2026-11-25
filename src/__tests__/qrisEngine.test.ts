import { describe, it, expect } from 'vitest'
import {
  calculateCRC16,
  validateCRC16,
  parseQRIS,
  generateDynamicQRIS,
  DEFAULT_PAWON_STATIC_QRIS,
} from '@/lib/qrisEngine'

const SAMPLE_STATIC_QRIS =
  '00020101021126610016ID.CO.SHOPEE.WWW01189360091800235458010208235458010303UMI51440014ID.CO.QRIS.WWW0215ID10265749259900303UMI5204597153033605802ID5915Typehand Studio6008SEMARANG61055027662070703A0163043A82'

describe('qrisEngine EMVCo Dynamic QRIS', () => {
  it('validates CRC-16 checksum on sample static QRIS and default PAWON static QRIS', () => {
    expect(validateCRC16(SAMPLE_STATIC_QRIS)).toBe(true)
    expect(validateCRC16(DEFAULT_PAWON_STATIC_QRIS)).toBe(true)
    expect(validateCRC16(SAMPLE_STATIC_QRIS.slice(0, -1) + '0')).toBe(false)
  })

  it('parses static QRIS metadata and nested NMID accurately', () => {
    const parsed = parseQRIS(DEFAULT_PAWON_STATIC_QRIS)
    expect(parsed.isValid).toBe(true)
    expect(parsed.isValidCRC).toBe(true)
    expect(parsed.summary?.merchantName).toBe('PAWON PONDOKREJO')
    expect(parsed.summary?.merchantCity).toBe('SLEMAN')
    expect(parsed.summary?.nmid).toBe('ID1026574925990')
    expect(parsed.summary?.isStatic).toBe(true)
    expect(parsed.summary?.amount).toBeNull()
  })

  it('converts static QRIS to dynamic QRIS with locked amount (Tag 01=12, Tag 54=nominal, valid Tag 63 CRC)', () => {
    const nominal = 47500
    const dynamicPayload = generateDynamicQRIS(DEFAULT_PAWON_STATIC_QRIS, nominal)

    expect(validateCRC16(dynamicPayload)).toBe(true)

    const parsedDynamic = parseQRIS(dynamicPayload)
    expect(parsedDynamic.isValid).toBe(true)
    expect(parsedDynamic.summary?.isStatic).toBe(false)
    expect(parsedDynamic.data?.['01']?.value).toBe('12')
    expect(parsedDynamic.data?.['54']?.value).toBe('47500')
    expect(parsedDynamic.summary?.amount).toBe(47500)
  })

  it('throws error when nominal is below minimum Rp 500', () => {
    expect(() => generateDynamicQRIS(DEFAULT_PAWON_STATIC_QRIS, 100)).toThrow(
      'Nominal pembayaran minimal adalah Rp 500'
    )
  })

  it('calculates deterministic CRC-16/CCITT-FALSE checksum', () => {
    const prefix = SAMPLE_STATIC_QRIS.slice(0, -4)
    expect(calculateCRC16(prefix)).toBe('3A82')
  })
})
