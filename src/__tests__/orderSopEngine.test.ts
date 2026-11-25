import { describe, it, expect, vi, beforeEach } from 'vitest'
import { classifyOrderForSop, SopConfig } from '@/lib/orderSopEngine'

const baseConfig: SopConfig = {
  isSopAutoEnabled: true,
  sopPendingCancelHours: 24,
  sopStuckWarningHours: 4,
  sopDeliveredCompleteHours: 24,
  sopProcessingCancelHours: 48,
}

describe('orderSopEngine SLA Classification', () => {
  const nowMs = new Date('2026-11-25T10:00:00Z').getTime()

  it('auto-cancels pending COD/QRIS orders exceeding 24h and flags >7d as silent archive', () => {
    const recentPending = {
      _id: 'ord-1',
      orderNumber: 'ORD-RECENT',
      customerName: 'Warga Baru',
      paymentMethod: 'qris',
      status: 'pending',
      _createdAt: new Date(nowMs - 26 * 3600000).toISOString(),
      _updatedAt: new Date(nowMs - 26 * 3600000).toISOString(),
    }
    const oldPending = {
      _id: 'ord-2',
      orderNumber: 'ORD-OLD',
      customerName: 'Warga Lama',
      paymentMethod: 'cod',
      status: 'pending',
      _createdAt: new Date(nowMs - 200 * 3600000).toISOString(),
      _updatedAt: new Date(nowMs - 200 * 3600000).toISOString(),
    }
    const freshPending = {
      _id: 'ord-3',
      orderNumber: 'ORD-FRESH',
      customerName: 'Warga Fresh',
      paymentMethod: 'cod',
      status: 'pending',
      _createdAt: new Date(nowMs - 2 * 3600000).toISOString(),
      _updatedAt: new Date(nowMs - 2 * 3600000).toISOString(),
    }

    const r1 = classifyOrderForSop(recentPending, baseConfig, nowMs)
    const r2 = classifyOrderForSop(oldPending, baseConfig, nowMs)
    const r3 = classifyOrderForSop(freshPending, baseConfig, nowMs)

    expect(r1?.action).toBe('auto_cancel_pending')
    expect(r1?.isLegacySilent).toBe(false)
    expect(r2?.action).toBe('auto_cancel_pending')
    expect(r2?.isLegacySilent).toBe(true)
    expect(r3).toBeNull()
  })

  it('auto-completes delivered orders exceeding 24h without buyer click', () => {
    const deliveredOld = {
      _id: 'ord-4',
      orderNumber: 'ORD-DELIV',
      customerName: 'Ibu Ani',
      paymentMethod: 'cod',
      status: 'delivered',
      _createdAt: new Date(nowMs - 30 * 3600000).toISOString(),
      _updatedAt: new Date(nowMs - 25 * 3600000).toISOString(),
    }

    const res = classifyOrderForSop(deliveredOld, baseConfig, nowMs)
    expect(res?.action).toBe('auto_complete_delivered')
    expect(res?.isLegacySilent).toBe(false)
  })

  it('auto-cancels stuck processing/shipped orders exceeding 48h', () => {
    const stuckOrder = {
      _id: 'ord-5',
      orderNumber: 'ORD-STUCK',
      customerName: 'Pak Budi',
      paymentMethod: 'cod',
      status: 'processing',
      _createdAt: new Date(nowMs - 55 * 3600000).toISOString(),
      _updatedAt: new Date(nowMs - 50 * 3600000).toISOString(),
    }

    const res = classifyOrderForSop(stuckOrder, baseConfig, nowMs)
    expect(res?.action).toBe('auto_cancel_stuck')
  })
})
