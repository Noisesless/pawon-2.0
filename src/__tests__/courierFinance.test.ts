import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DEFAULT_FINANCE_CONFIG,
  assignOrderSettlementPeriodKey,
  isCutoffPassedForPeriod,
  computeOrderFinanceSnapshot,
  computeCourierLedgerSummary,
  syncDailyCourierSettlements,
} from '@/lib/courierFinanceEngine'
import { buildCourierNextStepMessage } from '@/sanity/lib/whatsapp'
import { pickNextRoundRobinCourier } from '@/lib/courierAssigner'

const mockOutbox: Array<{ target: string; message: string }> = []

vi.mock('@/sanity/lib/whatsapp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/sanity/lib/whatsapp')>()
  return {
    ...actual,
    sendWhatsAppNotification: vi.fn(async (target: string, message: string) => {
      mockOutbox.push({ target, message })
      return { success: true }
    }),
  }
})

describe('Courier 1-Link & Finance Kas Engine (6000 = 4000 Kurir + 2000 Kalurahan)', () => {
  beforeEach(() => {
    mockOutbox.length = 0
  })

  it('1. Mengirim tepat 1 tautan Ambil & Mulai Antar setelah kurir Terima Order', () => {
    const msg = buildCourierNextStepMessage({
      baseUrl: 'https://pawon.pondokrejo.id',
      orderNumber: 'ORD-TEST01',
      courierId: 'cour-1',
      courierName: 'Rangga',
      stage: 'accepted',
      customerName: 'Ibu Ani',
      deliveryAddress: 'Dusun Glagah',
    })
    const actionMatches = msg.match(/\/order\/ORD-TEST01\/action\?/g) || []
    expect(actionMatches.length).toBe(1)
    expect(msg).toContain('status=delivering')
    expect(msg).not.toContain('status=shipped')
    expect(msg).toContain('Barang Diambil & Mulai Jalan Antar ke Pembeli')
  })

  it('2. Menghitung COD normal & COD besar dengan dana talangan kurir secara akurat', () => {
    const normalOrder = {
      orderNumber: 'ORD-COD1',
      orderCategory: 'product',
      paymentMethod: 'cod',
      totalAmount: 46000,
      shippingFee: 6000,
      items: [{ price: 40000, quantity: 1 }],
    }
    const ledgerNormal = computeCourierLedgerSummary([normalOrder], 100000, DEFAULT_FINANCE_CONFIG)
    expect(ledgerNormal.sellerCashPaid).toBe(40000)
    expect(ledgerNormal.codOrderTotal).toBe(46000)
    expect(ledgerNormal.courierCommissionTotal).toBe(4000)
    expect(ledgerNormal.kalurahanFeeTotal).toBe(2000)
    expect(ledgerNormal.endingCashInHand).toBe(106000)
    expect(ledgerNormal.netContinueNextDay).toBe(2000)
    expect(ledgerNormal.netFullClose).toBe(102000)
    expect(ledgerNormal.hasTalanganOrder).toBe(false)

    // COD melebihi kas 100rb (barang 150rb + ongkir 6rb = 156rb)
    const bigCodOrder = {
      orderNumber: 'ORD-COD-BIG',
      orderCategory: 'product',
      paymentMethod: 'cod',
      totalAmount: 156000,
      shippingFee: 6000,
      items: [{ price: 150000, quantity: 1 }],
    }
    const snapBig = computeOrderFinanceSnapshot(bigCodOrder, DEFAULT_FINANCE_CONFIG, 100000)
    expect(snapBig.exceededFloatCash).toBe(true)

    const ledgerBig = computeCourierLedgerSummary([bigCodOrder], 100000, DEFAULT_FINANCE_CONFIG)
    expect(ledgerBig.hasTalanganOrder).toBe(true)
    expect(ledgerBig.netContinueNextDay).toBe(2000)
    expect(ledgerBig.netFullClose).toBe(102000)
  })

  it('3. Menghitung QRIS + kurir bayar vendor pakai kas & dana talangan pribadi', () => {
    const qrisOrders = [
      {
        orderNumber: 'ORD-Q1',
        orderCategory: 'product',
        paymentMethod: 'qris',
        totalAmount: 86000,
        shippingFee: 6000,
        items: [{ price: 80000, quantity: 1 }],
      },
      {
        orderNumber: 'ORD-Q2',
        orderCategory: 'product',
        paymentMethod: 'qris',
        totalAmount: 76000,
        shippingFee: 6000,
        items: [{ price: 70000, quantity: 1 }],
      },
    ]

    const ledger = computeCourierLedgerSummary(qrisOrders, 100000, DEFAULT_FINANCE_CONFIG)
    expect(ledger.sellerCashPaid).toBe(150000)
    expect(ledger.qrisOrderTotal).toBe(162000)
    expect(ledger.codOrderTotal).toBe(0)
    expect(ledger.courierCommissionTotal).toBe(8000)
    expect(ledger.kalurahanFeeTotal).toBe(4000)
    // Kas 100rb habis + talangan pribadi 50rb -> endingCashInHand = -50000
    expect(ledger.endingCashInHand).toBe(-50000)
    expect(ledger.kurirOutOfPocket).toBe(50000)
    // Refill lanjut kas besok: Admin bayar 158rb (100rb kas + 50rb ganti talangan + 8rb upah)
    expect(ledger.netContinueNextDay).toBe(-158000)
    // Tutup kas penuh: Admin ganti talangan + upah = 58rb
    expect(ledger.netFullClose).toBe(-58000)
  })

  it('4. Cutoff harian 16.00 WIB memisahkan order sebelum vs sesudah 16.00 WIB', () => {
    // 25 Nov 2026 15:59 WIB = 08:59 UTC -> periode 2026-11-25
    expect(assignOrderSettlementPeriodKey('2026-11-25T08:59:00.000Z', 16)).toBe('2026-11-25')
    // 25 Nov 2026 16:00 WIB = 09:00 UTC -> periode 2026-11-26
    expect(assignOrderSettlementPeriodKey('2026-11-25T09:00:00.000Z', 16)).toBe('2026-11-26')

    expect(
      isCutoffPassedForPeriod('2026-11-25', new Date('2026-11-25T08:59:59.000Z').getTime(), 16)
    ).toBe(false)
    expect(
      isCutoffPassedForPeriod('2026-11-25', new Date('2026-11-25T09:00:00.000Z').getTime(), 16)
    ).toBe(true)
  })

  it('5. Otomatis buat rekap 16.00, kirim peringatan 24j, dan blokir antrean kurir > 48j (2x24 jam)', async () => {
    const db = new Map<string, any>([
      [
        'appSettings',
        {
          _id: 'appSettings',
          _type: 'appSettings',
          adminPhone: '+62895325586281',
          defaultShippingFee: 6000,
          courierCommissionAmount: 4000,
          kalurahanFeeAmount: 2000,
          defaultCourierFloatCash: 100000,
          dailySettlementCutoffHour: 16,
          maxSettlementDelayHours: 48,
        },
      ],
      [
        'courier-telat',
        {
          _id: 'courier-telat',
          _type: 'courier',
          name: 'Kurir Telat',
          phone: '628111111111',
          isActive: true,
          status: 'active',
          isSettlementBlocked: false,
          lastAssignedAt: '2026-11-20T00:00:00.000Z',
        },
      ],
      [
        'courier-tertib',
        {
          _id: 'courier-tertib',
          _type: 'courier',
          name: 'Kurir Tertib',
          phone: '628222222222',
          isActive: true,
          status: 'active',
          isSettlementBlocked: false,
          lastAssignedAt: '2026-11-24T00:00:00.000Z',
        },
      ],
      [
        'ord-1',
        {
          _id: 'ord-1',
          _type: 'order',
          orderNumber: 'ORD-HARI1',
          orderCategory: 'product',
          status: 'completed',
          paymentMethod: 'cod',
          totalAmount: 46000,
          shippingFee: 6000,
          productSubtotal: 40000,
          courierCommissionAmount: 4000,
          kalurahanFeeAmount: 2000,
          completedAt: '2026-11-25T06:00:00.000Z', // 13:00 WIB -> periode 2026-11-25
          courier: { _type: 'reference', _ref: 'courier-telat' },
          items: [{ price: 40000, quantity: 1 }],
        },
      ],
    ])

    const mockClient: any = {
      fetch: vi.fn(async (query: string) => {
        const docs = Array.from(db.values())
        if (query.includes('_type == "appSettings"')) {
          return db.get('appSettings')
        }
        if (query.includes('_type == "courier"')) {
          return docs.filter((d) => d._type === 'courier')
        }
        if (query.includes('_type == "order"')) {
          return docs
            .filter(
              (d) =>
                d._type === 'order' &&
                d.status === 'completed' &&
                !d.settlementId &&
                d.courier?._ref
            )
            .map((d) => ({ ...d, courierId: d.courier._ref }))
        }
        if (query.includes('_type == "courierSettlement"')) {
          return docs
            .filter((d) => d._type === 'courierSettlement' && d.status !== 'settled')
            .map((d) => ({ ...d, courierId: d.courier?._ref }))
        }
        return []
      }),
      createIfNotExists: vi.fn(async (doc: any) => {
        if (!db.has(doc._id)) db.set(doc._id, doc)
        return doc
      }),
      patch: vi.fn((id: string) => ({
        set: (updates: any) => ({
          commit: async () => {
            const cur = db.get(id) || { _id: id }
            db.set(id, { ...cur, ...updates })
            return db.get(id)
          },
        }),
      })),
    }

    // T0 = 25 Nov 2026 16:05 WIB -> buat rekap
    const res1 = await syncDailyCourierSettlements({
      nowMs: new Date('2026-11-25T09:05:00.000Z').getTime(),
      dryRun: false,
      clientOverride: mockClient,
    })
    expect(res1.createdCount).toBe(1)
    expect(db.get('settlement-courier-telat-2026-11-25').netContinueNextDay).toBe(2000)

    // T + 25 jam (26 Nov 17:00 WIB) -> overdue_warning (>24 jam)
    const res2 = await syncDailyCourierSettlements({
      nowMs: new Date('2026-11-26T10:00:00.000Z').getTime(),
      dryRun: false,
      clientOverride: mockClient,
    })
    expect(res2.warnedCount).toBe(1)
    expect(db.get('settlement-courier-telat-2026-11-25').status).toBe('overdue_warning')

    // T + 49 jam (27 Nov 17:00 WIB) -> blocked_overdue (>48 jam / 2x24 jam)
    const res3 = await syncDailyCourierSettlements({
      nowMs: new Date('2026-11-27T10:00:00.000Z').getTime(),
      dryRun: false,
      clientOverride: mockClient,
    })
    expect(res3.blockedCount).toBe(1)
    expect(db.get('courier-telat').isSettlementBlocked).toBe(true)

    // Round-Robin WAJIB melewati Kurir Telat dan memilih Kurir Tertib
    const rr = await pickNextRoundRobinCourier(mockClient, [])
    expect(rr.courier?._id).toBe('courier-tertib')
  })
})
