'use server'

import { createClient } from 'next-sanity'
import { getPhoneLookupVariants } from '@/lib/actionToken'
import { updateOrderStatus } from './order'

const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2026-02-01',
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
})

/**
 * Mencari vendor berdasarkan nomor WhatsApp (08 / 628 / +628) dan PIN untuk login portal.
 */
export async function getVendorByPhone(phone: string, pin: string) {
  try {
    const variants = getPhoneLookupVariants(phone)
    const query = `*[_type == "vendor" && !(_id in path("drafts.**")) && phone in $variants][0]{
      _id,
      name,
      phone,
      pin,
      description,
      isOpen,
      closingMessage,
      businessType,
      "slug": slug.current
    }`
    const vendor = await writeClient.fetch(query, { variants }, { cache: 'no-store' })

    if (!vendor) {
      return { success: false, error: 'Nomor WhatsApp tidak terdaftar sebagai penjual.' }
    }

    if (vendor.pin !== pin.trim()) {
      return { success: false, error: 'PIN yang Anda masukkan salah.' }
    }

    delete vendor.pin
    return { success: true, data: vendor }
  } catch (error) {
    console.error('Fetch vendor failed:', error)
    return { success: false, error: 'Terjadi kesalahan sistem.' }
  }
}

/**
 * Update profil operasional vendor (Buka/Tutup & Deskripsi)
 */
export async function updateVendorProfile(
  vendorId: string,
  data: { isOpen: boolean; closingMessage?: string; description?: string }
) {
  try {
    const cleanId = vendorId.replace(/^drafts\./, '')
    await writeClient
      .patch(cleanId)
      .set({
        isOpen: data.isOpen,
        closingMessage: data.closingMessage || '',
        description: data.description || '',
      })
      .commit()

    return { success: true }
  } catch (error) {
    console.error('Update vendor failed:', error)
    return { success: false, error: 'Gagal memperbarui profil toko.' }
  }
}

/**
 * Mengambil daftar pesanan aktif yang memiliki produk/jasa milik vendor ini.
 */
export async function getVendorOrders(vendorId: string) {
  try {
    const cleanVendorId = vendorId.replace(/^drafts\./, '')
    const rawOrders: any[] =
      (await writeClient.fetch(
        `*[_type == "order" && !(_id in path("drafts.**")) && !(status in ["completed", "cancelled"])] | order(_createdAt desc) {
          _id,
          orderNumber,
          orderCategory,
          customerName,
          customerPhone,
          deliveryAddress,
          paymentMethod,
          paymentStatus,
          status,
          serviceDate,
          _createdAt,
          "serviceItem": serviceItem->{ name, price, "vendorId": vendor._ref },
          "courier": courier->{ name, phone },
          items[]{
            quantity,
            price,
            "product": product->{ _id, name, "vendorId": vendor._ref }
          }
        }`,
        {},
        { cache: 'no-store' }
      )) || []

    const matchingOrders = rawOrders
      .map((ord) => {
        if (ord.orderCategory === 'service') {
          if (ord.serviceItem?.vendorId?.replace(/^drafts\./, '') === cleanVendorId) {
            return ord
          }
          return null
        }

        const vendorItems = (ord.items || []).filter(
          (i: any) => i?.product?.vendorId?.replace(/^drafts\./, '') === cleanVendorId
        )
        if (vendorItems.length === 0) return null
        return { ...ord, items: vendorItems }
      })
      .filter(Boolean)

    return { success: true, data: matchingOrders }
  } catch (error) {
    console.error('Fetch vendor orders failed:', error)
    return { success: false, error: 'Gagal memuat pesanan masuk toko.' }
  }
}

/**
 * Aksi Penjual dari Portal Lapak (Siap Diambil Kurir / Mulai Kerjakan Jasa / Batalkan).
 */
export async function vendorOrderTransition(
  orderNumber: string,
  nextStatus: 'shipped' | 'delivering' | 'cancelled',
  note: string
) {
  return await updateOrderStatus(orderNumber, nextStatus, note)
}
