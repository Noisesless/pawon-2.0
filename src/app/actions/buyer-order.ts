'use server'

import { createClient } from 'next-sanity'
import { updateOrderStatus } from './order'

const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2026-02-01',
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
})

export async function completeOrder(orderId: string) {
  try {
    const cleanId = orderId.replace(/^drafts\./, '')
    const order = await writeClient.fetch(
      `*[_type == "order" && _id == $cleanId][0]{orderNumber}`,
      { cleanId },
      { cache: 'no-store' }
    )

    if (order?.orderNumber) {
      return await updateOrderStatus(
        order.orderNumber,
        'completed',
        'Dikonfirmasi selesai oleh Pembeli melalui halaman Lacak Pesanan'
      )
    }

    await writeClient.patch(cleanId).set({ status: 'completed' }).commit()
    return { success: true }
  } catch (error: any) {
    console.error('Failed to complete order:', error)
    return { success: false, error: 'Gagal menyelesaikan pesanan.' }
  }
}
