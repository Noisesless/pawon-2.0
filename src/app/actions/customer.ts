'use server'

import { createClient } from 'next-sanity'

const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2026-02-01',
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
})

export async function getOrCreateCustomer(formData: { name: string, phone: string, address: string }) {
  try {
    // 1. Search for existing customer by phone number
    const existing = await writeClient.fetch(
      `*[_type == "customer" && phone == $phone][0]`,
      { phone: formData.phone }
    )

    if (existing) {
      // Update address if it changed (non-blocking agar tidak menggagalkan checkout jika write token terbatas)
      if (existing.address !== formData.address || existing.name !== formData.name) {
        try {
          await writeClient.patch(existing._id).set({
            name: formData.name,
            address: formData.address
          }).commit()
        } catch (patchErr) {
          console.warn('[Customer] Gagal memperbarui data alamat/nama customer lama (melanjutkan dengan data eksis):', patchErr)
        }
      }
      return { success: true, customerId: existing._id }
    }

    // 2. Create new customer if not found
    if (!process.env.SANITY_API_WRITE_TOKEN) {
      console.error('[Sanity] SANITY_API_WRITE_TOKEN belum disetel di .env.local')
      return { 
        success: false, 
        error: 'SANITY_API_WRITE_TOKEN belum disetel di .env.local. Diperlukan token Sanity berizin Editor/Write untuk membuat profil pembeli baru.' 
      }
    }

    const doc = {
      _type: 'customer',
      name: formData.name,
      phone: formData.phone,
      address: formData.address,
      isVerified: false,
      successfulOrders: 0,
      failedOrders: 0,
    }

    const result = await writeClient.create(doc)
    return { success: true, customerId: result._id }
  } catch (error: any) {
    console.error('Customer lookup/creation failed:', error)
    const detailMsg = error?.details?.description || error?.message || ''
    if (detailMsg.includes('Insufficient permissions') || !process.env.SANITY_API_WRITE_TOKEN) {
      return { 
        success: false, 
        error: 'SANITY_API_WRITE_TOKEN belum disetel di .env.local atau tidak memiliki izin Write di Sanity.io.' 
      }
    }
    return { success: false, error: 'Gagal memproses profil pembeli: ' + (detailMsg || 'Terjadi kendala koneksi ke database.') }
  }
}

export async function getCustomerById(id: string) {
  try {
    const customer = await writeClient.fetch(
      `*[_type == "customer" && _id == $id][0]`,
      { id }
    )
    return { success: true, data: customer }
  } catch (error) {
    console.error('Fetch customer failed:', error)
    return { success: false, error: 'Gagal mengambil data profil.' }
  }
}
