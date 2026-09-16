# Peta Rute & Middleware PAWON 🗺️
**Pasar Warga Pondokrejo — Navigasi Halaman, API, & Device Routing**

Dokumen ini memetakan seluruh rute aktif pada aplikasi **PAWON**, baik tampilan Desktop, Mobile (Adaptive Subpaths), REST API endpoints, serta rantai pemrosesan middleware.

---

## Frontend Routes (Pages)

### 🖥️ A. Desktop & Universal Views
| Route Path | File Path | Page Title | Auth / Peran | Status |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Beranda Pasar Warga Pondokrejo | Publik | STABLE |
| `/admin` | `src/app/admin/page.tsx` | Pusat Kendali & Dashboard Kalurahan | Admin Kalurahan | STABLE |
| `/cart` | `src/app/cart/page.tsx` | Keranjang Belanja Warga | Publik | STABLE |
| `/categories` | `src/app/categories/page.tsx` | Kategori Produk & Jasa | Publik | STABLE |
| `/checkout` | `src/app/checkout/page.tsx` | Checkout & Konfirmasi Pesanan | Publik / Warga | STABLE |
| `/info` | `src/app/info/page.tsx` | Kabar Kalurahan, Pelatihan & UMKM | Publik | STABLE |
| `/info/[slug]` | `src/app/info/[slug]/page.tsx` | Detail Berita & Panduan | Publik | STABLE |
| `/inkubator` | `src/app/inkubator/page.tsx` | Inkubator Bisnis & Layanan UMKM | Publik | STABLE |
| `/inkubator/[slug]` | `src/app/inkubator/[slug]/page.tsx` | Detail Layanan Inkubator | Publik | STABLE |
| `/kurir` | `src/app/kurir/page.tsx` | Portal Tugas Kurir Kalurahan | Kurir (WA + PIN) | STABLE |
| `/lapak` | `src/app/lapak/page.tsx` | Portal Manajemen Lapak Penjual | Penjual UMKM (WA + PIN) | STABLE |
| `/manual/admin` | `src/app/manual/admin/page.tsx` | Panduan Operasional Petugas Admin | Admin | STABLE |
| `/manual/kurir` | `src/app/manual/kurir/page.tsx` | Panduan Pengantaran Petugas Kurir | Kurir | STABLE |
| `/manual/pembeli` | `src/app/manual/pembeli/page.tsx` | Panduan Belanja Warga Pembeli | Publik | STABLE |
| `/manual/penjual` | `src/app/manual/penjual/page.tsx` | Panduan Kelola Lapak Penjual UMKM | Penjual | STABLE |
| `/order/[orderNumber]/action` | `src/app/order/[orderNumber]/action/page.tsx` | Eksekusi Magic Link Aksi Pesanan | Magic Token / Admin / Kurir | STABLE |
| `/product/[slug]` | `src/app/product/[slug]/page.tsx` | Rincian Produk UMKM | Publik | STABLE |
| `/products` | `src/app/products/page.tsx` | Katalog Lengkap Produk UMKM | Publik | STABLE |
| `/register-courier` | `src/app/register-courier/page.tsx` | Formulir Pendaftaran Kurir Warga | Publik | STABLE |
| `/register-vendor` | `src/app/register-vendor/page.tsx` | Formulir Pendaftaran Lapak UMKM | Publik | STABLE |
| `/service/[slug]` | `src/app/service/[slug]/page.tsx` | Detail Jasa & Booking Tenaga Ahli | Publik | STABLE |
| `/services` | `src/app/services/page.tsx` | Direktori Tenaga Ahli & Jasa Warga | Publik | STABLE |
| `/studio/[[...tool]]` | `src/app/studio/[[...tool]]/page.tsx` | Sanity Studio Dashboard | Admin Kalurahan | STABLE |
| `/track` | `src/app/track/page.tsx` | Lacak Status Pesanan Belanja | Publik | STABLE |
| `/track/[orderNumber]` | `src/app/track/[orderNumber]/page.tsx` | Rincian & Timeline Pengiriman Order | Publik | STABLE |
| `/vendor/[slug]` | `src/app/vendor/[slug]/page.tsx` | Profil Lapak & Etalase UMKM | Publik | STABLE |
| `/vendors` | `src/app/vendors/page.tsx` | Direktori Seluruh UMKM Kalurahan | Publik | STABLE |

### 📱 B. Dedicated Mobile Views (Subpath `/mobile/*`)
*Catatan: Rute di bawah dipanggil otomatis oleh middleware saat pengunjung menggunakan smartphone.*

| Mobile Route | File Path | Fitur Khusus | Status |
|---|---|---|---|
| `/mobile` | `src/app/mobile/page.tsx` | Bottom Navigation Bar, Mobile Banner Carousel | STABLE |
| `/mobile/cart` | `src/app/mobile/cart/page.tsx` | Sticky Checkout Bar bawah layar | STABLE |
| `/mobile/categories` | `src/app/mobile/categories/page.tsx` | Grid kategori 2-kolom ringkas | STABLE |
| `/mobile/checkout` | `src/app/mobile/checkout/page.tsx` | Form satu halaman dioptimalkan jempol (BottomNav otomatis disembunyikan) | STABLE |
| `/mobile/inkubator` | `src/app/mobile/inkubator/page.tsx` | Layanan pendampingan usaha mobile view | STABLE |
| `/mobile/inkubator/[slug]` | `src/app/mobile/inkubator/[slug]/page.tsx` | Detail pendampingan bisnis | STABLE |
| `/mobile/order/[orderNumber]/action` | `src/app/mobile/order/[orderNumber]/action/page.tsx` | Konfirmasi 1-tap via WhatsApp link | STABLE |
| `/mobile/product/[slug]` | `src/app/mobile/product/[slug]/page.tsx` | Sticky "Tambah ke Keranjang" & WA (BottomNav otomatis disembunyikan via cleanPath) | STABLE |
| `/mobile/products` | `src/app/mobile/products/page.tsx` | Pencarian & filter swipeable | STABLE |
| `/mobile/register-courier` | `src/app/mobile/register-courier/page.tsx` | Form registrasi kurir mobile | STABLE |
| `/mobile/register-vendor` | `src/app/mobile/register-vendor/page.tsx` | Form registrasi UMKM mobile | STABLE |
| `/mobile/service/[slug]` | `src/app/mobile/service/[slug]/page.tsx` | Direct WhatsApp Booking Button | STABLE |
| `/mobile/services` | `src/app/mobile/services/page.tsx` | List tenaga ahli dengan quick call/WA | STABLE |
| `/mobile/track` | `src/app/mobile/track/page.tsx` | Input kode pesanan cepat | STABLE |
| `/mobile/track/[orderNumber]` | `src/app/mobile/track/[orderNumber]/page.tsx` | Timeline kurir bergaya aplikasi ojek online | STABLE |
| `/mobile/vendor/[slug]` | `src/app/mobile/vendor/[slug]/page.tsx` | Profil toko & status buka/tutup lapak | STABLE |
| `/mobile/vendors` | `src/app/mobile/vendors/page.tsx` | List UMKM terverifikasi kalurahan | STABLE |

---

## API Routes (Endpoints)

| Method | Route Path | Handler File | Auth | Purpose |
|---|---|---|---|---|
| `GET` | `/api/version` | `src/app/api/version/route.ts` | Publik | Diagnostik anti-cache & pengecekan versi runtime server |
| `GET` | `/api/debug-couriers` | `src/app/api/debug-couriers/route.ts` | Internal Admin | Pengecekan daftar kurir aktif & verifikasi Magic Link COD |

---

## Middleware Chain

| Middleware File | Applied To (Matcher) | Purpose |
|---|---|---|
| `src/middleware.ts` | `/((?!_next/static|_next/image\|favicon.ico).*)` | **Hybrid Device Router**: <br>1. Melewati aset statis, internal `/_next`, `/api`, dan `/studio`.<br>2. Memeriksa `user-agent` header menggunakan regex deteksi mobile.<br>3. Menyematkan header `x-is-mobile: true`.<br>4. Melakukan *invisible rewrite* dari `/[path]` ke `/mobile/[path]` untuk pengguna HP agar mendapatkan UI BottomNav native. |
