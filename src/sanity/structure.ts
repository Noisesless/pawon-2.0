import type { StructureResolver } from 'sanity/structure'
import {
  BasketIcon,
  UserIcon,
  TagIcon,
  RocketIcon,
  MenuIcon,
  CogIcon,
  PresentationIcon,
  ImageIcon,
  InfoOutlineIcon,
} from '@sanity/icons'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Manajemen Pasar Pondokrejo')
    .items([
      // 1. Singleton Global Settings & Dynamic QRIS
      S.listItem()
        .title('Pengaturan Aplikasi & QRIS')
        .icon(CogIcon)
        .child(
          S.document()
            .schemaType('appSettings')
            .documentId('appSettings')
            .title('Konfigurasi Global & Dynamic QRIS')
        ),
      S.divider(),

      // 2. Orders Group
      S.listItem()
        .title('Pesanan Masuk')
        .icon(BasketIcon)
        .child(
          S.list()
            .title('Filter Pesanan')
            .items([
              S.listItem()
                .title('Semua Pesanan')
                .child(S.documentTypeList('order').title('Semua Pesanan')),
              S.divider(),
              S.listItem()
                .title('Menunggu Mutasi QRIS')
                .child(
                  S.documentList()
                    .title('Verifikasi Pembayaran QRIS')
                    .filter(
                      '_type == "order" && paymentMethod == "qris" && paymentStatus == "unpaid" && status != "cancelled"'
                    )
                ),
              S.listItem()
                .title('Menunggu Konfirmasi COD')
                .child(
                  S.documentList()
                    .title('Konfirmasi Pesanan COD')
                    .filter(
                      '_type == "order" && paymentMethod != "qris" && status == "pending"'
                    )
                ),
              S.listItem()
                .title('Disiapkan Penjual / Kurir')
                .child(
                  S.documentList()
                    .title('Sedang Diproses')
                    .filter(
                      '_type == "order" && status in ["accepted", "processing", "shipped"]'
                    )
                ),
              S.listItem()
                .title('Sedang Diantar Kurir')
                .child(
                  S.documentList()
                    .title('Dalam Pengiriman')
                    .filter('_type == "order" && status in ["delivering", "delivered"]')
                ),
              S.listItem()
                .title('Pesanan Selesai')
                .child(
                  S.documentList()
                    .title('Pesanan Selesai')
                    .filter('_type == "order" && status == "completed"')
                ),
              S.listItem()
                .title('Bermasalah / Dibatalkan')
                .child(
                  S.documentList()
                    .title('Bermasalah / Dibatalkan')
                    .filter('_type == "order" && status in ["problem", "cancelled"]')
                ),
            ])
        ),
      S.divider(),

      // 3. Catalog Group
      S.listItem()
        .title('Produk Barang')
        .icon(TagIcon)
        .child(S.documentTypeList('product').title('Produk UMKM')),
      S.listItem()
        .title('Jasa & Layanan')
        .icon(PresentationIcon)
        .child(S.documentTypeList('service').title('Jasa & Layanan Warga')),
      S.listItem()
        .title('Kategori Katalog')
        .icon(MenuIcon)
        .child(S.documentTypeList('category').title('Kategori Produk & Jasa')),
      S.divider(),

      // 4. Partners & Customers Group
      S.listItem()
        .title('Penjual (UMKM)')
        .icon(UserIcon)
        .child(
          S.list()
            .title('Manajemen Penjual')
            .items([
              S.listItem()
                .title('Semua Penjual')
                .child(S.documentTypeList('vendor').title('Semua Penjual')),
              S.divider(),
              S.listItem()
                .title('Perlu Verifikasi')
                .child(
                  S.documentList()
                    .title('Pendaftaran UMKM Baru')
                    .filter('_type == "vendor" && isVerified == false')
                ),
            ])
        ),
      S.listItem()
        .title('Kurir Kalurahan')
        .icon(RocketIcon)
        .child(S.documentTypeList('courier').title('Tim Kurir Logistik')),
      S.listItem()
        .title('Data Warga (Pembeli)')
        .icon(UserIcon)
        .child(S.documentTypeList('customer').title('Data Warga Pembeli')),
      S.divider(),

      // 5. Content & Incubator Group
      S.listItem()
        .title('Banner Promosi')
        .icon(ImageIcon)
        .child(S.documentTypeList('banner').title('Banner Beranda')),
      S.listItem()
        .title('Info & Pengumuman')
        .icon(InfoOutlineIcon)
        .child(S.documentTypeList('article').title('Kabar & Panduan Kalurahan')),
      S.listItem()
        .title('Layanan Inkubator UMKM')
        .icon(RocketIcon)
        .child(
          S.documentTypeList('incubatorService').title('Program Layanan Inkubator')
        ),
      S.listItem()
        .title('Pengaturan Hero Inkubator')
        .icon(CogIcon)
        .child(
          S.document()
            .schemaType('incubatorSettings')
            .documentId('incubatorSettings')
            .title('Pengaturan Halaman Inkubator')
        ),
    ])
