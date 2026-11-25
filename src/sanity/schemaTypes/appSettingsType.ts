import { defineField, defineType } from 'sanity'
import { CogIcon } from '@sanity/icons'
import { validateCRC16 } from '@/lib/qrisEngine'

export const appSettingsType = defineType({
  name: 'appSettings',
  title: 'Pengaturan Aplikasi',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'adminPhone',
      title: 'Nomor WhatsApp Admin Pusat',
      type: 'string',
      description: 'Nomor utama yang akan menerima laporan pesanan baru (Format: 08xxx atau 628xxx).',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'defaultShippingFee',
      title: 'Biaya Ongkir Flat',
      type: 'number',
      description: 'Biaya kirim standar untuk wilayah Kalurahan Pondokrejo.',
      initialValue: 5000,
    }),
    defineField({
      name: 'siteName',
      title: 'Nama Aplikasi',
      type: 'string',
      initialValue: 'PAWON PONDOKREJO',
    }),
    defineField({
      name: 'isMaintenance',
      title: 'Mode Perbaikan (Maintenance)',
      type: 'boolean',
      initialValue: false,
      description: 'Aktifkan ini jika ingin menutup akses belanja sementara untuk pemeliharaan sistem.',
    }),
    defineField({
      name: 'adminPin',
      title: 'PIN Akses Dasbor Admin (/admin)',
      type: 'string',
      initialValue: '12341',
      description: 'PIN rahasia untuk login ke Pusat Kendali Admin (/admin).',
    }),
    defineField({
      name: 'isSopAutoEnabled',
      title: 'Aktifkan SOP Pembatalan & Penyelesaian Otomatis',
      type: 'boolean',
      initialValue: true,
      description: 'Menjalankan penutupan otomatis transaksi yang melewati batas SLA di server production.',
    }),
    defineField({
      name: 'sopPendingCancelHours',
      title: 'Batas Batal Otomatis Pending COD/QRIS (Jam)',
      type: 'number',
      initialValue: 24,
      description: 'Pesanan menunggu konfirmasi/pembayaran lebih dari batas jam ini akan dibatalkan otomatis.',
    }),
    defineField({
      name: 'sopStuckWarningHours',
      title: 'Batas Peringatan Pesanan Macet (Jam)',
      type: 'number',
      initialValue: 4,
      description: 'Menampilkan tanda peringatan macet di Dasbor Admin jika pesanan tidak bergerak.',
    }),
    defineField({
      name: 'sopDeliveredCompleteHours',
      title: 'Batas Selesai Otomatis Setelah Diantar (Jam)',
      type: 'number',
      initialValue: 24,
      description: 'Pesanan berstatus delivered otomatis ditandai selesai jika pembeli tidak konfirmasi.',
    }),
    defineField({
      name: 'sopProcessingCancelHours',
      title: 'Batas Batal Otomatis Pesanan Macet (Jam)',
      type: 'number',
      initialValue: 48,
      description: 'Pesanan diproses/dikirim yang macet melebihi batas jam ini ditutup otomatis oleh SOP.',
    }),
    defineField({
      name: 'sopCourierTimeoutMinutes',
      title: 'Batas Waktu Respons Kurir (Menit)',
      type: 'number',
      initialValue: 5,
      description: 'Jika kurir antrean tidak merespons melewati batas menit ini, tugas dialihkan otomatis ke kurir aktif berikutnya.',
    }),
    defineField({
      name: 'sopLastRunAt',
      title: 'Waktu Terakhir Worker SOP Berjalan',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'isQrisEnabled',
      title: 'Aktifkan Pembayaran Dynamic QRIS',
      type: 'boolean',
      initialValue: true,
      description: 'Matikan saklar ini jika pembayaran QRIS sedang dalam masa pengurusan atau pemeliharaan.',
    }),
    defineField({
      name: 'qrisMerchantName',
      title: 'Nama Merchant QRIS',
      type: 'string',
      initialValue: 'PAWON PONDOKREJO',
      description: 'Nama merchant resmi yang ditampilkan di kartu pembayaran QRIS (maks. 25 karakter).',
      validation: (rule) => rule.max(25),
    }),
    defineField({
      name: 'qrisNmid',
      title: 'NMID (National Merchant ID) QRIS',
      type: 'string',
      initialValue: 'ID1026574925990',
      description: 'Nomor NMID yang tertera pada lembar cetak QRIS resmi (contoh: ID1026...).',
    }),
    defineField({
      name: 'qrisStaticPayload',
      title: 'Payload String QRIS Statis (EMVCo)',
      type: 'text',
      rows: 4,
      description:
        'Tempel teks string hasil scan QRIS Statis resmi dari Bank/BPD/BRI/E-Wallet (diawali 000201010211...). Sistem akan otomatis mengubahnya menjadi QRIS Dinamis dengan nominal terkunci sesuai total belanja warga.',
      validation: (rule) =>
        rule.custom((val) => {
          if (!val || !val.trim()) return true
          return validateCRC16(val)
            ? true
            : 'Checksum CRC-16 atau format TLV EMVCo QRIS tidak valid. Pastikan string diawali 000201 dan tidak terpotong.'
        }),
    }),
  ],
  preview: {
    prepare() {
      return {
        title: 'Konfigurasi Global PAWON',
      }
    },
  },
})
