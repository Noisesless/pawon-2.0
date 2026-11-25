import { defineField, defineType } from 'sanity'
import { RocketIcon } from '@sanity/icons'

export const courierType = defineType({
  name: 'courier',
  title: 'Kurir Kalurahan',
  type: 'document',
  icon: RocketIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'phone',
      title: 'Nomor WhatsApp',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'pin',
      title: 'PIN Akses Portal',
      type: 'string',
      description: 'PIN rahasia (4-6 digit) untuk login ke portal kurir.',
      validation: (rule) => rule.min(4).max(6),
    }),
    defineField({
      name: 'isActive',
      title: 'Status Kurir Aktif',
      type: 'boolean',
      initialValue: true,
      description: 'Matikan ini jika kurir sedang tidak bertugas atau libur.',
    }),
    defineField({
      name: 'statusMessage',
      title: 'Pesan Status',
      type: 'string',
      description: 'Contoh: "Sedang di luar kota" atau "Hanya melayani sore hari".',
      hidden: ({ document }) => !!document?.isActive,
    }),
    defineField({
      name: 'status',
      type: 'string',
      options: {
        list: [
          { title: 'Aktif', value: 'active' },
          { title: 'Tidak Aktif', value: 'inactive' },
        ],
        layout: 'radio',
      },
      initialValue: 'active',
    }),
    defineField({
      name: 'lastAssignedAt',
      title: 'Terakhir Mendapat Giliran',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'customFloatCash',
      title: 'Kas Awal Khusus Kurir (Opsional)',
      type: 'number',
      description: 'Kosongkan untuk memakai nominal Kas Awal default di Pengaturan Global (Rp100.000).',
    }),
    defineField({
      name: 'isSettlementBlocked',
      title: 'Dibekukan Karena Telat Setor (>2x24 Jam)',
      type: 'boolean',
      initialValue: false,
      readOnly: true,
    }),
    defineField({
      name: 'settlementBlockedReason',
      title: 'Catatan Pembekuan Setoran',
      type: 'string',
      readOnly: true,
    }),
    defineField({
      name: 'lastSettledAt',
      title: 'Waktu Terakhir Setoran / Refill Kas',
      type: 'datetime',
      readOnly: true,
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'phone',
    },
  },
})
