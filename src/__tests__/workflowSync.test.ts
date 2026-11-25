import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DEFAULT_PAWON_STATIC_QRIS, generateDynamicQRIS, parseQRIS, validateCRC16 } from '@/lib/qrisEngine'

// In-memory Sanity database & WhatsApp outbox for factual E2E simulation
const mockDb = new Map<string, any>()
const waOutbox: Array<{ target: string; message: string }> = []

function resetSimulationState() {
  mockDb.clear()
  waOutbox.length = 0

  // Seed initial state
  mockDb.set('appSettings', {
    _id: 'appSettings',
    _type: 'appSettings',
    siteName: 'PAWON PONDOKREJO',
    adminPhone: '081328128315',
    adminPin: '12341',
    defaultShippingFee: 5000,
    isMaintenance: false,
    isQrisEnabled: true,
    qrisMerchantName: 'PAWON PONDOKREJO',
    qrisNmid: 'ID1026574925990',
    qrisStaticPayload: DEFAULT_PAWON_STATIC_QRIS,
  })

  mockDb.set('vendor-1', {
    _id: 'vendor-1',
    _type: 'vendor',
    name: 'Warung Mak Mur',
    phone: '085611112222',
    pin: '1122',
    isOpen: true,
    isVerified: true,
    businessType: 'product',
  })

  mockDb.set('product-1', {
    _id: 'product-1',
    _type: 'product',
    name: 'Lanting Singkong Super Gurih',
    price: 18000,
    stock: 25,
    vendor: { _type: 'reference', _ref: 'vendor-1' },
  })

  mockDb.set('courier-active', {
    _id: 'courier-active',
    _type: 'courier',
    name: 'Mas Bagus Kurir',
    phone: '087733334444',
    pin: '3344',
    isActive: true,
    status: 'active',
  })

  mockDb.set('courier-resting', {
    _id: 'courier-resting',
    _type: 'courier',
    name: 'Mas Budi Libur',
    phone: '087799990000',
    pin: '9900',
    isActive: true,
    status: 'active',
  })

  mockDb.set('customer-1', {
    _id: 'customer-1',
    _type: 'customer',
    name: 'Ibu Siti Warga',
    phone: '081277778888',
    address: 'Dusun Glagahmalang RT 01 RW 02',
    pin: '123456',
    isVerified: true,
    successfulOrders: 0,
    failedOrders: 0,
  })
}

vi.mock('@/sanity/lib/whatsapp', async () => {
  const actual = await vi.importActual<typeof import('@/sanity/lib/whatsapp')>(
    '@/sanity/lib/whatsapp'
  )
  return {
    ...actual,
    sendWhatsAppNotification: vi.fn(async (target: string, message: string) => {
      let clean = target.replace(/\D/g, '')
      if (clean.startsWith('0')) clean = '62' + clean.slice(1)
      waOutbox.push({ target: clean, message })
      return { success: true }
    }),
  }
})

vi.mock('next-sanity', () => ({
  defineQuery: (q: string) => q,
  createClient: () => ({
    fetch: vi.fn(async (query: string, params: Record<string, any> = {}) => {
      const docs = Array.from(mockDb.values())

      if (query.includes('_type == "appSettings"')) {
        const allSettings = docs.filter((d) => d._type === 'appSettings')
        if (query.includes('[0]')) {
          return allSettings.find((d) => !d._id.startsWith('drafts.')) || null
        }
        return allSettings
      }

      if (query.includes('_type == "product" && _id in $productIds')) {
        const ids: string[] = params.productIds || []
        return docs
          .filter((d) => d._type === 'product' && ids.includes(d._id))
          .map((p) => {
            const v = mockDb.get(p.vendor?._ref)
            return {
              _id: p._id,
              name: p.name,
              stock: p.stock,
              vendor: v
                ? {
                    _id: v._id,
                    name: v.name,
                    phone: v.phone,
                    isOpen: v.isOpen,
                    closingMessage: v.closingMessage,
                  }
                : null,
            }
          })
      }

      if (
        query.includes('_type == "order" && defined(courierOfferedAt)') ||
        query.includes('defined(courierOfferedAt)')
      ) {
        const list = docs.filter(
          (d) =>
            d._type === 'order' &&
            !d._id.startsWith('drafts.') &&
            (d.status === 'processing' || d.status === 'shipped') &&
            Boolean(d.courierOfferedAt)
        )
        return list.map((ord) => {
          const c = ord.courier?._ref ? mockDb.get(ord.courier._ref) : null
          return {
            ...ord,
            courier: c ? { _id: c._id, name: c.name, phone: c.phone } : null,
            items: (ord.items || []).map((it: any) => {
              const prod = mockDb.get(it.product?._ref)
              const vend = prod?.vendor?._ref ? mockDb.get(prod.vendor._ref) : null
              return {
                quantity: it.quantity,
                product: prod ? { name: prod.name, vendor: vend ? { name: vend.name } : null } : null,
              }
            }),
          }
        })
      }

      if (query.includes('_type == "vendor" && !(_id in path("drafts.**")) && phone in $variants')) {
        const variants: string[] = params.variants || []
        const found = docs.find(
          (d) => d._type === 'vendor' && !d._id.startsWith('drafts.') && variants.includes(d.phone)
        )
        return found ? { ...found } : null
      }

      if (query.includes('_type == "courier" && !(_id in path("drafts.**")) && phone in $variants')) {
        const variants: string[] = params.variants || []
        const found = docs.find(
          (d) => d._type === 'courier' && !d._id.startsWith('drafts.') && variants.includes(d.phone)
        )
        return found ? { ...found } : null
      }

      if (query.includes('!(status in ["completed", "cancelled"])')) {
        return docs
          .filter(
            (d) =>
              d._type === 'order' &&
              !d._id.startsWith('drafts.') &&
              d.status !== 'completed' &&
              d.status !== 'cancelled'
          )
          .map((ord) => ({
            ...ord,
            items: (ord.items || []).map((it: any) => {
              const prod = mockDb.get(it.product?._ref)
              return {
                quantity: it.quantity,
                price: it.price,
                product: prod
                  ? { _id: prod._id, name: prod.name, vendorId: prod.vendor?._ref }
                  : null,
              }
            }),
          }))
      }

      if (query.includes('_type == "courier"')) {
        return docs
          .filter((d) => d._type === 'courier' && !d._id.startsWith('drafts.'))
          .map((d) => ({ ...d }))
      }

      if (query.includes('_type == "order" && orderNumber == $orderNumber')) {
        const ord = docs.find(
          (d) => d._type === 'order' && d.orderNumber === params.orderNumber
        )
        if (!ord) return null
        const c = ord.courier?._ref ? mockDb.get(ord.courier._ref) : null
        const hydratedItems = (ord.items || []).map((it: any) => {
          const prod = mockDb.get(it.product?._ref)
          const vend = prod?.vendor?._ref ? mockDb.get(prod.vendor._ref) : null
          return {
            quantity: it.quantity,
            price: it.price,
            product: prod
              ? {
                  _id: prod._id,
                  name: prod.name,
                  stock: prod.stock,
                  vendorName: vend?.name,
                  vendor: vend ? { _id: vend._id, name: vend.name, phone: vend.phone } : null,
                }
              : null,
          }
        })
        return {
          ...ord,
          customerId: ord.customer?._ref,
          courier: c ? { _id: c._id, name: c.name, phone: c.phone } : null,
          items: hydratedItems,
        }
      }

      if (query.includes('_type == "order" && _id == $cleanId')) {
        return mockDb.get(params.cleanId) || null
      }

      if (query.includes('_type == "vendor" && _id in path("drafts.**")')) {
        return docs.filter((d) => d._type === 'vendor' && d._id.startsWith('drafts.'))
      }

      return docs
    }),
    create: vi.fn(async (doc: any) => {
      const id = doc._id || `${doc._type}-${Math.random().toString(36).slice(2, 8)}`
      const created = { ...doc, _id: id, _createdAt: new Date().toISOString() }
      mockDb.set(id, created)
      return created
    }),
    createOrReplace: vi.fn(async (doc: any) => {
      mockDb.set(doc._id, { ...doc, _updatedAt: new Date().toISOString() })
      return doc
    }),
    createIfNotExists: vi.fn(async (doc: any) => {
      if (!mockDb.has(doc._id)) {
        mockDb.set(doc._id, doc)
      }
      return doc
    }),
    delete: vi.fn(async (id: string) => {
      mockDb.delete(id)
      return { _id: id }
    }),
    patch: vi.fn((id: string) => {
      const pendingSet: Record<string, any> = {}
      const pendingInc: Record<string, number> = {}
      const pendingUnset: string[] = []
      const chain = {
        set: (fields: Record<string, any>) => {
          Object.assign(pendingSet, fields)
          return chain
        },
        ifRevisionId: () => chain,
        unset: (fields: string[]) => {
          pendingUnset.push(...fields)
          return chain
        },
        setIfMissing: (fields: Record<string, any>) => {
          const existing = mockDb.get(id) || {}
          for (const [k, v] of Object.entries(fields)) {
            if (existing[k] === undefined) pendingSet[k] = v
          }
          return chain
        },
        inc: (fields: Record<string, number>) => {
          Object.assign(pendingInc, fields)
          return chain
        },
        commit: async () => {
          const existing = mockDb.get(id) || { _id: id }
          const updated = { ...existing, ...pendingSet }
          for (const key of pendingUnset) {
            delete updated[key]
          }
          for (const [k, delta] of Object.entries(pendingInc)) {
            updated[k] = (Number(updated[k]) || 0) + delta
          }
          mockDb.set(id, updated)
          return updated
        },
      }
      return chain
    }),
  }),
}))

process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'sim-project'
process.env.NEXT_PUBLIC_SANITY_DATASET = 'production'
process.env.SANITY_API_WRITE_TOKEN = 'sim-write-token'

import {
  saveAppSettings,
  verifyAdminPin,
  adminConfirmAndAssignOrder,
} from '@/app/actions/admin'
import { createOrder, getPublicPaymentSettings, updateOrderStatus } from '@/app/actions/order'
import { updateCourierStatus, getCourierByPhone } from '@/app/actions/courier-portal'
import { getVendorByPhone, getVendorOrders } from '@/app/actions/vendor-portal'
import { registerVendor } from '@/app/actions/vendor'
import { registerCourier } from '@/app/actions/courier'
import { completeOrder } from '@/app/actions/buyer-order'
import { runCourierTimeoutCheck } from '@/lib/orderSopEngine'

describe('Factual E2E Simulation: Admin Center, Dynamic QRIS, Courier Sync & WhatsApp Dynamics', () => {
  beforeEach(() => {
    resetSimulationState()
  })

  it('1. Syncs Admin Settings (Admin Phone, PIN, Shipping Fee & Dynamic QRIS) with Zero-Drafts', async () => {
    // Simulate a leftover draft in Sanity Studio
    mockDb.set('drafts.appSettings', {
      _id: 'drafts.appSettings',
      _type: 'appSettings',
      adminPhone: '0800000000',
    })

    const saveRes = await saveAppSettings({
      siteName: 'PAWON PONDOKREJO',
      adminPhone: '081199988877',
      adminPin: '77889',
      defaultShippingFee: 6000,
      isMaintenance: false,
      isQrisEnabled: true,
      qrisMerchantName: 'BUMKAL PONDOKREJO',
      qrisNmid: 'ID1026574925990',
      qrisStaticPayload: DEFAULT_PAWON_STATIC_QRIS,
    })

    expect(saveRes.success).toBe(true)
    // Draft must be purged automatically
    expect(mockDb.has('drafts.appSettings')).toBe(false)

    // Dynamic PIN verification reflects new PIN immediately
    const oldPinCheck = await verifyAdminPin('12341')
    const newPinCheck = await verifyAdminPin('77889')
    expect(oldPinCheck.success).toBe(false)
    expect(newPinCheck.success).toBe(true)

    // Public payment settings reflect new shipping fee & merchant name
    const pubSettings = await getPublicPaymentSettings()
    expect(pubSettings.data.defaultShippingFee).toBe(6000)
    expect(pubSettings.data.qrisMerchantName).toBe('BUMKAL PONDOKREJO')

    // Dynamic QRIS payload locks exact transaction nominal
    const lockedPayload = generateDynamicQRIS(
      pubSettings.data.qrisStaticPayload,
      24000,
      { merchantNameOverride: pubSettings.data.qrisMerchantName }
    )
    expect(validateCRC16(lockedPayload)).toBe(true)
    const parsed = parseQRIS(lockedPayload)
    expect(parsed.summary?.amount).toBe(24000)
    expect(parsed.summary?.merchantName).toBe('BUMKAL PONDOKREJO')
  })

  it('2. Registers new UMKM & Courier without drafts.* trap and syncs Courier resting status', async () => {
    // Update adminPhone first to confirm notifications use dynamic phone
    await saveAppSettings({
      siteName: 'PAWON PONDOKREJO',
      adminPhone: '081199988877',
      adminPin: '12341',
      defaultShippingFee: 5000,
      isMaintenance: false,
      isQrisEnabled: true,
      qrisMerchantName: 'PAWON PONDOKREJO',
      qrisNmid: 'ID1026574925990',
      qrisStaticPayload: DEFAULT_PAWON_STATIC_QRIS,
    })

    const fd = new FormData()
    fd.append('name', 'Bakpia Mbak Sri')
    fd.append('phone', '085712341234')
    fd.append('address', 'Dusun Banjarharjo')
    fd.append('description', 'Bakpia hangat setiap pagi')
    fd.append('businessType', 'product')

    const vRes = await registerVendor(fd)
    expect(vRes.success).toBe(true)
    // Must NOT be created as a hidden draft
    expect(vRes.vendorId?.startsWith('drafts.')).toBe(false)
    const savedVendor = mockDb.get(vRes.vendorId!)
    expect(savedVendor.isVerified).toBe(false)
    expect(savedVendor.pin).toBe('123456')

    const cRes = await registerCourier({ name: 'Kang Joko', phone: '087811112222' })
    expect(cRes.success).toBe(true)
    const savedCourier = mockDb.get(cRes.courierId!)
    expect(savedCourier.isActive).toBe(false)
    expect(savedCourier.status).toBe('inactive')

    // Both registrations notified the dynamic Admin WA (6281199988877)
    expect(waOutbox.some((m) => m.target === '6281199988877' && m.message.includes('Bakpia Mbak Sri'))).toBe(true)
    expect(waOutbox.some((m) => m.target === '6281199988877' && m.message.includes('Kang Joko'))).toBe(true)

    // When courier-resting toggles off in Courier Portal, both isActive and status become inactive
    await updateCourierStatus('courier-resting', {
      isActive: false,
      statusMessage: 'Sedang istirahat makan siang',
    })
    expect(mockDb.get('courier-resting').isActive).toBe(false)
    expect(mockDb.get('courier-resting').status).toBe('inactive')
  })

  it('3. Executes full Dynamic QRIS Order Lifecycle: Checkout -> Admin Confirm -> Seller/Courier WA -> Delivery -> Buyer Completion', async () => {
    // 1. Set dynamic Admin phone & turn off courier-resting
    await saveAppSettings({
      siteName: 'PAWON PONDOKREJO',
      adminPhone: '081199988877',
      adminPin: '12341',
      defaultShippingFee: 5000,
      isMaintenance: false,
      isQrisEnabled: true,
      qrisMerchantName: 'PAWON PONDOKREJO',
      qrisNmid: 'ID1026574925990',
      qrisStaticPayload: DEFAULT_PAWON_STATIC_QRIS,
    })
    await updateCourierStatus('courier-resting', { isActive: false })

    // 2. Buyer checks out with QRIS (Rp 18.000 + Rp 5.000 ongkir = Rp 23.000)
    const checkoutRes = await createOrder(
      {
        name: 'Ibu Siti Warga',
        phone: '081277778888',
        address: 'Dusun Glagahmalang RT 01 RW 02',
        paymentMethod: 'qris',
      },
      [
        {
          _id: 'product-1',
          name: 'Lanting Singkong Super Gurih',
          price: 18000,
          quantity: 1,
          image: {} as any,
          vendorName: 'Warung Mak Mur',
        },
      ],
      23000,
      5000,
      'customer-1'
    )

    expect(checkoutRes.success).toBe(true)
    const orderId = checkoutRes.orderId!
    const orderNumber = checkoutRes.orderNumber!

    // Check Admin WA notification:
    // - Sent to dynamic admin phone 6281199988877
    // - Contains Hybrid QRIS verification link (without manual courier selection spam)
    const adminCheckoutMsg = waOutbox.find(
      (m) => m.target === '6281199988877' && m.message.includes(orderNumber)
    )
    expect(adminCheckoutMsg).toBeDefined()
    expect(adminCheckoutMsg?.message).toContain('VERIFIKASI PEMBAYARAN QRIS')
    expect(adminCheckoutMsg?.message).toContain('Konfirmasi Pembayaran QRIS Masuk')

    waOutbox.length = 0

    // 3. Admin confirms QRIS payment & assigns Mas Bagus Kurir via Admin Dashboard
    const confirmRes = await adminConfirmAndAssignOrder({
      orderId,
      orderNumber,
      actionMode: 'paid',
      courierId: 'courier-active',
      courierNotes: 'Titip di teras rumah cat hijau',
    })
    expect(confirmRes.success).toBe(true)

    const orderAfterConfirm = mockDb.get(orderId)
    expect(orderAfterConfirm.paymentStatus).toBe('paid')
    expect(orderAfterConfirm.status).toBe('processing')
    expect(orderAfterConfirm.courierNotes).toBe('Titip di teras rumah cat hijau')

    // Verify 3 WhatsApp broadcasts fired accurately without any hardcoded fallback phones or emojis:
    // a) Buyer (6281277778888) - nama kurir belum ditampilkan sebelum kurir klik Terima Order
    const buyerPaidWa = waOutbox.find((m) => m.target === '6281277778888')
    expect(buyerPaidWa?.message).toContain('Pembayaran QRIS Anda sudah diterima')
    expect(buyerPaidWa?.message).not.toContain('Mas Bagus Kurir')

    // b) Seller UMKM Warung Mak Mur (6285611112222)
    const sellerWa = waOutbox.find((m) => m.target === '6285611112222')
    expect(sellerWa?.message).toContain('PESANAN MASUK PENJUAL')
    expect(sellerWa?.message).toContain('Lanting Singkong Super Gurih')
    expect(sellerWa?.message).not.toContain('Mas Bagus Kurir')

    // c) Courier Mas Bagus (6287733334444) -> Explicitly states Lunas via QRIS + Accept/Reject buttons
    const courierWa = waOutbox.find((m) => m.target === '6287733334444')
    expect(courierWa?.message).toContain('Lunas via QRIS (Rp 0 - Jangan tagih tunai ke pembeli)')
    expect(courierWa?.message).toContain('Terima Order')
    expect(courierWa?.message).toContain('Tolak Order')

    waOutbox.length = 0

    // 4. Courier starts delivery ('delivering')
    const delivRes = await updateOrderStatus(orderNumber, 'delivering')
    expect(delivRes.success).toBe(true)
    const buyerDelivWa = waOutbox.find((m) => m.target === '6281277778888')
    expect(buyerDelivWa?.message).toContain('SUDAH LUNAS VIA QRIS')
    expect(buyerDelivWa?.message).not.toContain('Harap siapkan uang tunai')

    waOutbox.length = 0

    // 5. Buyer clicks Complete Order on Web Tracking Page -> stock decrements & clean log sent
    const completeRes = await completeOrder(orderId)
    expect(completeRes.success).toBe(true)
    expect(mockDb.get(orderId).status).toBe('completed')
    expect(mockDb.get('product-1').stock).toBe(24)
    expect(mockDb.get('customer-1').successfulOrders).toBe(1)
    expect(
      waOutbox.some(
        (m) => m.target === '6281199988877' && m.message.includes('Pesanan Selesai')
      )
    ).toBe(true)
  })

  it('4. Executes COD Automatic Flow (Admin Log-Only), Round-Robin Rotation, Courier Reject/Auto-Skip, & Zero Raw Emojis', async () => {
    // Both couriers active: courier-active (Mas Bagus) and courier-resting (Mas Budi -> active now)
    // Phone normalization test: login via 628... or 08...
    const vLogin = await getVendorByPhone('6285611112222', '1122')
    const cLogin = await getCourierByPhone('6287733334444', '3344')
    expect(vLogin.success).toBe(true)
    expect(cLogin.success).toBe(true)

    const checkoutRes = await createOrder(
      {
        name: 'Ibu Siti Warga',
        phone: '081277778888',
        address: 'Dusun Glagahmalang RT 01 RW 02',
        paymentMethod: 'cod',
      },
      [
        {
          _id: 'product-1',
          name: 'Lanting Singkong Super Gurih',
          price: 18000,
          quantity: 2,
          image: {} as any,
          vendorName: 'Warung Mak Mur',
        },
      ],
      41000,
      5000,
      'customer-1'
    )

    expect(checkoutRes.success).toBe(true)
    const ordId = checkoutRes.orderId!
    const ordNum = checkoutRes.orderNumber!
    const savedOrder = mockDb.get(ordId)

    // COD jumps directly to processing with Round-Robin courier #1 assigned
    expect(savedOrder.status).toBe('processing')
    expect(savedOrder.courier._ref).toBe('courier-active')

    // Admin received pure LOG message without any action link
    const adminCodLog = waOutbox.find((m) => m.target === '6281328128315')
    expect(adminCodLog).toBeDefined()
    expect(adminCodLog?.message).toContain('LOG PROGRES OTOMATIS')
    expect(adminCodLog?.message).not.toContain('/action?')

    // Seller received ONLY seller notification on Warung Mak Mur phone (6285611112222)
    const sellerCodWa = waOutbox.find((m) => m.target === '6285611112222')
    expect(sellerCodWa?.message).toContain('PESANAN MASUK PENJUAL')
    expect(sellerCodWa?.message).toContain('Lanting Singkong Super Gurih')

    // Vendor portal can list the active order
    const vendorOrdersRes = await getVendorOrders('vendor-1')
    expect(vendorOrdersRes.success).toBe(true)
    expect(vendorOrdersRes.data?.some((o: any) => o.orderNumber === ordNum)).toBe(true)

    // Even if seller marks 'shipped' before courier accepts, courierOfferedAt stays active for auto-skip
    // AND buyer/seller WA & track page MUST NOT display queued courier until accepted
    const { isCourierConfirmedForOrder } = await import('@/lib/courierAssigner')
    expect(isCourierConfirmedForOrder(mockDb.get(ordId))).toBe(false)

    waOutbox.length = 0
    await updateOrderStatus(ordNum, 'shipped', 'Penjual siap', undefined, undefined, {
      role: 'seller',
      token: (await import('@/lib/actionToken')).createOrderActionToken(ordNum, 'seller', 'shipped'),
    })
    expect(mockDb.get(ordId).status).toBe('shipped')
    expect(mockDb.get(ordId).courierOfferedAt).toBeTruthy()
    expect(isCourierConfirmedForOrder(mockDb.get(ordId))).toBe(false)
    const buyerWaitWa = waOutbox.find((m) => m.target === '6281277778888')
    expect(buyerWaitWa?.message).toContain('menunggu konfirmasi kurir')
    expect(buyerWaitWa?.message).not.toContain('Mas Bagus')

    // Courier #1 rejects -> auto-rotates to Courier #2 (courier-resting)
    const rejectRes = await updateOrderStatus(ordNum, 'reject', 'Ban bocor', 'courier-active')
    expect(rejectRes.success).toBe(true)
    expect(mockDb.get(ordId).courier._ref).toBe('courier-resting')
    expect(mockDb.get(ordId).rejectedCourierIds).toContain('courier-active')

    // If Courier #2 doesn't respond past timeout (e.g. +10 mins) -> Auto-Skip alerts Admin when no pool left
    mockDb.set(ordId, {
      ...mockDb.get(ordId),
      courierOfferedAt: new Date(Date.now() - 10 * 60000).toISOString(),
    })
    const skipRes = await runCourierTimeoutCheck({ dryRun: false })
    expect(skipRes.skippedCount).toBe(1)
    expect(mockDb.get(ordId).courier).toBeUndefined()

    // Ensure ZERO raw emoji symbols across all WhatsApp messages sent during E2E
    const rawEmojiPattern = /[📦🛍️🆔👤📞📍💰📝⚠️✅❌🔔🛵🚚👍🏁🔄🤖🕒🍳✨🛠️🗓️💼🏃🏪]/u
    for (const msg of waOutbox) {
      expect(rawEmojiPattern.test(msg.message)).toBe(false)
    }
  })
})
