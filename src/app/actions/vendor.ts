'use server'

import { createClient } from 'next-sanity'

const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2026-02-01',
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
})

export async function registerVendor(formData: FormData) {
  try {
    const name = formData.get('name') as string
    const phone = formData.get('phone') as string
    const address = formData.get('address') as string
    const description = formData.get('description') as string
    const businessType = formData.get('businessType') as string
    const logoFile = formData.get('logo') as File | null

    if (!name || !phone || !businessType) {
      return { success: false, error: 'Data wajib tidak lengkap.' }
    }

    const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
    
    let logoAssetId = null

    // Upload Logo jika ada
    if (logoFile && logoFile.size > 0) {
      const buffer = Buffer.from(await logoFile.arrayBuffer())
      const asset = await writeClient.assets.upload('image', buffer, {
        filename: logoFile.name,
        contentType: logoFile.type
      })
      logoAssetId = asset._id
    }

    const doc: any = {
      _type: 'vendor',
      name,
      slug: { _type: 'slug', current: slug },
      phone,
      pin: '123456',
      address,
      description,
      businessType,
      isOpen: true,
      isVerified: false, // Default pending verification in /admin
    }

    if (logoAssetId) {
      doc.logo = {
        _type: 'image',
        asset: {
          _type: 'reference',
          _ref: logoAssetId
        }
      }
    }

    const result = await writeClient.create(doc)

    // Kirim notifikasi WA ke Admin Pusat bahwa ada pendaftaran UMKM baru
    try {
      const { APP_SETTINGS_QUERY } = await import('@/sanity/lib/queries')
      const { sendWhatsAppNotification } = await import('@/sanity/lib/whatsapp')
      const settings = await writeClient.fetch(APP_SETTINGS_QUERY, {}, { cache: 'no-store' })
      const adminPhone = settings?.adminPhone || '+62895325586281'
      await sendWhatsAppNotification(
        adminPhone,
        `*PAWON PONDOKREJO - PENDAFTARAN UMKM BARU*\n--------------------------------\nNama Usaha : ${name}\nWhatsApp   : ${phone}\nJenis      : ${businessType === 'service' ? 'Jasa & Layanan' : 'Produk Barang'}\nAlamat     : ${address || '-'}\n\nSilakan buka menu Mitra & Warga pada Pusat Kendali Admin untuk verifikasi toko ini.`
      )
    } catch (waErr) {
      console.warn('WA notification for new vendor skipped:', waErr)
    }

    return { success: true, vendorId: result._id }
  } catch (error: any) {
    console.error('Vendor registration failed (FULL ERROR):', error)
    return { success: false, error: `Gagal mengirim pendaftaran. Detail: ${error.message}` }
  }
}
