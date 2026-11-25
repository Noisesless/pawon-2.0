'use server'

import { createClient } from 'next-sanity'

const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2026-02-01',
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
})

export async function registerCourier(formData: { name: string, phone: string }) {
  try {
    const doc = {
      _type: 'courier',
      name: formData.name,
      phone: formData.phone,
      pin: '123456',
      isActive: false,
      status: 'inactive', // Default to inactive until verified by admin
    }

    const result = await writeClient.create(doc)

    try {
      const { APP_SETTINGS_QUERY } = await import('@/sanity/lib/queries')
      const { sendWhatsAppNotification } = await import('@/sanity/lib/whatsapp')
      const settings = await writeClient.fetch(APP_SETTINGS_QUERY, {}, { cache: 'no-store' })
      const adminPhone = settings?.adminPhone || '+62895325586281'
      await sendWhatsAppNotification(
        adminPhone,
        `*PAWON PONDOKREJO - PENDAFTARAN KURIR BARU*\n--------------------------------\nNama     : ${formData.name}\nWhatsApp : ${formData.phone}\n\nSilakan buka menu Mitra & Warga pada Pusat Kendali Admin untuk mengaktifkan kurir ini.`
      )
    } catch (waErr) {
      console.warn('WA notification for new courier skipped:', waErr)
    }

    return { success: true, courierId: result._id }
  } catch (error) {
    console.error('Courier registration failed:', error)
    return { success: false, error: 'Gagal mengirim pendaftaran kurir.' }
  }
}
