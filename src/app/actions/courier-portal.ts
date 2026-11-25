'use server'

import { createClient } from 'next-sanity'
import { getPhoneLookupVariants } from '@/lib/actionToken'
import { APP_SETTINGS_QUERY } from '@/sanity/lib/queries'
import {
  resolveFinanceConfig,
  computeCourierLedgerSummary,
  assignOrderSettlementPeriodKey,
} from '@/lib/courierFinanceEngine'

const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2026-02-01',
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
})

/**
 * Mencari kurir berdasarkan nomor WhatsApp (08 / 628 / +628) dan PIN untuk login portal.
 */
export async function getCourierByPhone(phone: string, pin: string) {
  try {
    const variants = getPhoneLookupVariants(phone)
    const query = `*[_type == "courier" && !(_id in path("drafts.**")) && phone in $variants][0]{
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
    }`
    const courier = await writeClient.fetch(query, { variants }, { cache: 'no-store' })

    if (!courier) {
      return { success: false, error: 'Nomor WhatsApp tidak terdaftar sebagai kurir.' }
    }

    if (courier.pin !== pin.trim()) {
      return { success: false, error: 'PIN yang Anda masukkan salah.' }
    }

    delete courier.pin
    return { success: true, data: courier }
  } catch (error) {
    console.error('Fetch courier failed:', error)
    return { success: false, error: 'Terjadi kesalahan sistem.' }
  }
}

/**
 * Update status operasional kurir
 */
export async function updateCourierStatus(
  courierId: string,
  data: { isActive: boolean; statusMessage?: string }
) {
  try {
    const cleanId = courierId.replace(/^drafts\./, '')
    await writeClient
      .patch(cleanId)
      .set({
        isActive: data.isActive,
        status: data.isActive ? 'active' : 'inactive',
        statusMessage: data.statusMessage || '',
      })
      .commit()

    await writeClient.delete(`drafts.${cleanId}`).catch(() => {})

    return { success: true }
  } catch (error) {
    console.error('Update courier failed:', error)
    return { success: false, error: 'Gagal memperbarui status kurir.' }
  }
}

/**
 * Mengambil daftar pesanan aktif yang ditugaskan ke kurir ini
 */
export async function getCourierOrders(courierId: string) {
  try {
    const cleanId = courierId.replace(/^drafts\./, '')
    const query = `*[_type == "order" && !(_id in path("drafts.**")) && courier._ref == $courierId && status != "completed" && status != "cancelled"] | order(_createdAt desc) {
      _id,
      orderNumber,
      customerName,
      customerPhone,
      deliveryAddress,
      totalAmount,
      paymentMethod,
      paymentStatus,
      status,
      courierOfferedAt,
      _createdAt,
      items[]{
        quantity,
        "product": product->{
          name,
          "vendorName": vendor->name
        }
      }
    }`
    const orders = await writeClient.fetch(query, { courierId: cleanId }, { cache: 'no-store' })
    return { success: true, data: orders }
  } catch (error) {
    console.error('Fetch courier orders failed:', error)
    return { success: false, error: 'Gagal memuat tugas pengantaran.' }
  }
}

/**
 * Mengambil ringkasan kas awal, upah, dan kewajiban setoran/refill jam 16.00 untuk kurir login
 */
export async function getCourierFinanceSummary(courierId: string) {
  try {
    const cleanId = courierId.replace(/^drafts\./, '')
    const [rawSettings, courier, openOrders, openSettlements] = await Promise.all([
      writeClient.fetch(APP_SETTINGS_QUERY, {}, { cache: 'no-store' }),
      writeClient.fetch(
        `*[_type == "courier" && _id == $cid][0]{
          _id, customFloatCash, isSettlementBlocked, settlementBlockedReason
        }`,
        { cid: cleanId },
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "order" && !(_id in path("drafts.**")) && courier._ref == $cid && status == "completed" && orderCategory != "service" && !defined(settlementId)]{
          _id, orderNumber, paymentMethod, totalAmount, shippingFee,
          productSubtotal, courierCommissionAmount, kalurahanFeeAmount, exceededFloatCash,
          completedAt, _updatedAt, _createdAt, items[]{ quantity, price }
        }`,
        { cid: cleanId },
        { cache: 'no-store' }
      ),
      writeClient.fetch(
        `*[_type == "courierSettlement" && !(_id in path("drafts.**")) && courier._ref == $cid && status != "settled"] | order(cutoffAt asc){
          _id, periodKey, cutoffAt, dueAt, openingFloatCash, orderCount,
          codOrderTotal, qrisOrderTotal, sellerCashPaid, courierCommissionTotal,
          endingCashInHand, kurirOutOfPocket, netContinueNextDay, netFullClose, status
        }`,
        { cid: cleanId },
        { cache: 'no-store' }
      ),
    ])

    const finConfig = resolveFinanceConfig(rawSettings)
    const openingFloatCash =
      typeof courier?.customFloatCash === 'number'
        ? Math.max(0, courier.customFloatCash)
        : finConfig.defaultCourierFloatCash
    const liveSummary = computeCourierLedgerSummary(
      openOrders || [],
      openingFloatCash,
      finConfig
    )
    const currentPeriodKey = assignOrderSettlementPeriodKey(
      new Date().toISOString(),
      finConfig.dailySettlementCutoffHour
    )

    return {
      success: true,
      data: {
        openingFloatCash,
        cutoffHour: finConfig.dailySettlementCutoffHour,
        maxDelayHours: finConfig.maxSettlementDelayHours,
        commissionPerOrder: finConfig.courierCommissionAmount,
        isSettlementBlocked: Boolean(courier?.isSettlementBlocked),
        settlementBlockedReason: courier?.settlementBlockedReason || '',
        currentPeriodKey,
        liveSummary,
        openSettlements: openSettlements || [],
      },
    }
  } catch (error) {
    console.error('Fetch courier finance summary failed:', error)
    return { success: false, error: 'Gagal memuat ringkasan kas kurir.' }
  }
}
