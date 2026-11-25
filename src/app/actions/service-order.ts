'use server'

import { createClient } from 'next-sanity'
import { headers } from 'next/headers'
import { buildOrderActionUrl } from '@/lib/actionToken'

const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2026-02-01',
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
})

async function resolveBaseUrl(): Promise<string> {
  const configured = (process.env.NEXT_PUBLIC_BASE_URL || '').trim()
  if (process.env.NODE_ENV !== 'production') {
    try {
      const h = await headers()
      const host = h.get('x-forwarded-host') || h.get('host') || ''
      const proto = h.get('x-forwarded-proto') || 'http'
      if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
        return `${proto}://${host}`
      }
    } catch {
      // Ignore outside request context
    }
  }
  return configured || 'https://pawon.pondokrejo.id'
}

export async function createServiceOrder(data: {
  customerName: string
  customerPhone: string
  deliveryAddress: string
  serviceId: string
  serviceDate: string
  customerId: string
}) {
  try {
    const service = await writeClient.fetch(
      `*[_type == "service" && _id == $serviceId][0]{
        name, price, "vendor": vendor->{_id, name, phone}
      }`,
      { serviceId: data.serviceId }
    )

    if (!service) {
      return { success: false, error: 'Layanan jasa tidak ditemukan.' }
    }

    const publishDraft = async (id: string) => {
      if (id.startsWith('drafts.')) {
        const draft = await writeClient.fetch(`*[_id == $id][0]`, { id })
        if (draft) {
          const publishedId = id.replace('drafts.', '')
          const publishedDoc = { ...draft, _id: publishedId }
          await writeClient.createOrReplace(publishedDoc)
          await writeClient.delete(id)
          return publishedId
        }
      }
      return id.replace('drafts.', '')
    }

    const finalCustomerId = await publishDraft(data.customerId)
    const finalServiceId = await publishDraft(data.serviceId)
    const orderNumber = `SVC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`

    const doc = {
      _type: 'order',
      orderNumber,
      orderCategory: 'service',
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      deliveryAddress: data.deliveryAddress,
      customer: {
        _type: 'reference',
        _ref: finalCustomerId,
      },
      serviceItem: {
        _type: 'reference',
        _ref: finalServiceId,
      },
      serviceDate: data.serviceDate,
      totalAmount: service.price,
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
      status: 'pending',
      vendorId_for_query_only: service.vendor?._id,
    }

    const result = await writeClient.create(doc)

    if (result._id) {
      try {
        const { formatServiceOrderMessage, sendWhatsAppNotification } = await import(
          '@/sanity/lib/whatsapp'
        )
        const { APP_SETTINGS_QUERY } = await import('@/sanity/lib/queries')

        const settings = await writeClient.fetch(APP_SETTINGS_QUERY, {}, { cache: 'no-store' })
        const adminPhone = settings?.adminPhone || '+62895325586281'
        const baseUrl = await resolveBaseUrl()

        const waMessage = formatServiceOrderMessage(
          orderNumber,
          data.customerName,
          data.customerPhone,
          data.deliveryAddress,
          service.name,
          data.serviceDate,
          service.price
        )

        // Log bersih untuk Admin (tanpa emoji)
        await sendWhatsAppNotification(
          adminPhone,
          `${waMessage}\n*LOG PEMESANAN JASA*\nPemesanan jasa ini sudah diteruskan langsung ke penyedia jasa (${service.vendor?.name || 'Mitra Jasa'}).`
        )

        // Kirim tombol Sanggup / Tolak ke Penyedia Jasa
        if (service.vendor?.phone) {
          const acceptUrl = buildOrderActionUrl(baseUrl, {
            orderNumber,
            role: 'seller',
            status: 'delivering',
            label: 'Sanggup Mengerjakan Jasa',
          })
          const rejectUrl = buildOrderActionUrl(baseUrl, {
            orderNumber,
            role: 'seller',
            status: 'cancelled',
            label: 'Jadwal Bentrok / Tolak Jasa',
          })
          const sellerMsg = `*PAWON PONDOKREJO - PESANAN JASA BARU*
--------------------------------
Halo ${service.vendor.name},
Ada pemesanan layanan jasa untuk Anda:

No. Pesanan : ${orderNumber}
Pemesan     : ${data.customerName}
WhatsApp    : ${data.customerPhone}
Alamat      : ${data.deliveryAddress}
Jadwal      : ${new Date(data.serviceDate).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
Layanan     : ${service.name}
--------------------------------
Pilihan tindakan penyedia jasa:
[1] Sanggup Mengerjakan:
${acceptUrl}

[2] Belum Bisa Menerima (Batalkan):
${rejectUrl}`
          await sendWhatsAppNotification(service.vendor.phone, sellerMsg)
        }

        // Kirim konfirmasi bersih ke Pembeli
        await sendWhatsAppNotification(
          data.customerPhone,
          `*PAWON PONDOKREJO - PEMESANAN JASA DITERIMA*
--------------------------------
Halo ${data.customerName},

Pemesanan jasa *${service.name}* Anda telah tercatat dengan nomor ${orderNumber}.
Penyedia jasa akan segera menghubungi Anda untuk konfirmasi jadwal kedatangan.

Lacak status pesanan di:
${baseUrl}/track/${orderNumber}`
        )
      } catch (err) {
        console.error('Failed to send WA notification for service:', err)
      }
    }

    return { success: true, orderId: result._id, orderNumber }
  } catch (error: any) {
    console.error('Create service order failed:', error)
    return { success: false, error: error.message || 'Gagal memproses pesanan jasa.' }
  }
}
