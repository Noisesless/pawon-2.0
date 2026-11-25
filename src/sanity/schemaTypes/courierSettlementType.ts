import { defineField, defineType } from 'sanity'
import { CreditCardIcon } from '@sanity/icons'

export const courierSettlementType = defineType({
  name: 'courierSettlement',
  title: 'Setoran Kas Kurir',
  type: 'document',
  icon: CreditCardIcon,
  fields: [
    defineField({
      name: 'periodKey',
      title: 'Kode Periode Harian (WIB)',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'courier',
      title: 'Kurir',
      type: 'reference',
      to: [{ type: 'courier' }],
    }),
    defineField({
      name: 'courierName',
      title: 'Nama Kurir',
      type: 'string',
    }),
    defineField({
      name: 'courierPhone',
      title: 'WhatsApp Kurir',
      type: 'string',
    }),
    defineField({
      name: 'cutoffAt',
      title: 'Waktu Tutup Buku (16:00 WIB)',
      type: 'datetime',
    }),
    defineField({
      name: 'dueAt',
      title: 'Batas Akhir Setoran (2x24 Jam)',
      type: 'datetime',
    }),
    defineField({
      name: 'openingFloatCash',
      title: 'Kas Awal Kurir (Rp)',
      type: 'number',
    }),
    defineField({
      name: 'orderCount',
      title: 'Jumlah Pesanan Selesai',
      type: 'number',
    }),
    defineField({
      name: 'orderNumbers',
      title: 'Daftar Nomor Pesanan',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'codOrderTotal',
      title: 'Total Tagihan COD Diterima Kurir (Rp)',
      type: 'number',
    }),
    defineField({
      name: 'qrisOrderTotal',
      title: 'Total Pesanan QRIS via Admin (Rp)',
      type: 'number',
    }),
    defineField({
      name: 'sellerCashPaid',
      title: 'Total Bayar Tunai ke Penjual (Rp)',
      type: 'number',
    }),
    defineField({
      name: 'courierCommissionTotal',
      title: 'Total Hak Upah Kurir (Rp)',
      type: 'number',
    }),
    defineField({
      name: 'kalurahanFeeTotal',
      title: 'Total Porsi Kas Kalurahan (Rp)',
      type: 'number',
    }),
    defineField({
      name: 'endingCashInHand',
      title: 'Posisi Kas Fisik di Kurir (Rp)',
      type: 'number',
    }),
    defineField({
      name: 'kurirOutOfPocket',
      title: 'Estimasi Dana Talangan Kurir (Rp)',
      type: 'number',
    }),
    defineField({
      name: 'netContinueNextDay',
      title: 'Neto Lanjut Kas Besok (+ Setor / - Refill Admin)',
      type: 'number',
    }),
    defineField({
      name: 'netFullClose',
      title: 'Neto Tutup Kas Penuh (+ Setor / - Ganti Talangan)',
      type: 'number',
    }),
    defineField({
      name: 'settlementMode',
      title: 'Mode Penyelesaian',
      type: 'string',
      options: {
        list: [
          { title: 'Lanjut Kas Awal Besok (Refill)', value: 'continue_float' },
          { title: 'Kembalikan Kas Penuh (Tutup)', value: 'full_return' },
        ],
      },
    }),
    defineField({
      name: 'status',
      title: 'Status Laporan Setoran',
      type: 'string',
      options: {
        list: [
          { title: 'Menunggu Setor / Refill', value: 'waiting_settlement' },
          { title: 'Peringatan Terlambat (>24 Jam)', value: 'overdue_warning' },
          { title: 'Dibekukan Terlambat (>48 Jam)', value: 'blocked_overdue' },
          { title: 'Lunas / Selesai Rekonsiliasi', value: 'settled' },
        ],
      },
      initialValue: 'waiting_settlement',
    }),
    defineField({
      name: 'warning24SentAt',
      title: 'Waktu Kirim Peringatan 24 Jam',
      type: 'datetime',
    }),
    defineField({
      name: 'blocked48SentAt',
      title: 'Waktu Kirim Pembekuan 48 Jam',
      type: 'datetime',
    }),
    defineField({
      name: 'settledAt',
      title: 'Waktu Diselesaikan Admin',
      type: 'datetime',
    }),
    defineField({
      name: 'settledAmount',
      title: 'Nominal Disetor / Direfill (Rp)',
      type: 'number',
    }),
    defineField({
      name: 'notes',
      title: 'Catatan Admin',
      type: 'string',
    }),
  ],
  preview: {
    select: {
      courierName: 'courierName',
      periodKey: 'periodKey',
      status: 'status',
      orderCount: 'orderCount',
    },
    prepare({ courierName, periodKey, status, orderCount }) {
      return {
        title: `${courierName || 'Kurir'} (${periodKey || '-'})`,
        subtitle: `${orderCount || 0} order • ${status || 'waiting_settlement'}`,
      }
    },
  },
})
