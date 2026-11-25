# PAWON Architecture 🏛️

Dokumen ini memberikan ikhtisar ringkas pola desain dan struktur teknis platform **PAWON (Pasar Warga Pondokrejo)**.
> 📘 **Dokumentasi Lengkap (Single Source of Truth)**: Silakan merujuk ke [`.docs/architecture.md`](.docs/architecture.md) untuk diagram alur makro, sekuens notifikasi, dan model RBAC terinci.

## 1. Core Framework: Next.js 16+ (App Router & Turbopack)
Aplikasi ini dibangun menggunakan arsitektur modern Next.js 16 dengan pola **Server-First**:
- **Server Components**: Digunakan untuk hampir semua halaman utama (Beranda, Produk, Info, Inkubator) guna memastikan performa maksimal, SEO optimal, dan pengambilan data langsung dari database Sanity.
- **Client Components**: Diisolasi khusus untuk interaktivitas pengguna seperti `CartContext`, `AddToCartButton`, `BottomNav`, dan `PromoBanner`.

## 2. Headless Architecture: Sanity.io
PAWON memisahkan secara penuh antara *Content/Data* dan *Code*:
- **Sanity as Document Store**: Semua data (Produk, Jasa, UMKM, Kurir, Pesanan, Banner) dikelola melalui Sanity Studio.
- **GROQ Queries**: Pengambilan data efisien dengan proyeksi relasional terindeks.
- **Embedded Studio**: Dashboard CMS terintegrasi langsung di `/studio`.

## 3. Adaptive Mobile Strategy & Touch-First UI
- **Hybrid Mobile Detection**: Middleware (`src/middleware.ts`) mendeteksi `user-agent` smartphone dan melakukan *invisible rewrite* ke subpath `/src/app/mobile/*`.
- **Dedicated BottomNav & Stacking Layer**: Navigasi bawah cerdas yang otomatis bersembunyi pada halaman detail (`/product/*`, `/checkout`) via `cleanPath` agar bilah aksi mengambang (*Fixed Bottom Bar* `z-50`) tidak tertutup.

## 4. Multi-Channel WhatsApp Gateway (Fonnte)
- Notifikasi transaksional terkirim otomatis ke 4 pihak: Admin, Penjual (UMKM), Kurir, dan Pembeli.
- Menggunakan endpoint Fonnte API dengan token dinamis (`FONNTE_TOKEN`) dan normalisasi nomor otomatis ke format internasional `628...`.
- Mendukung **Magic Links** untuk pembaruan status pesanan kurir/penjual tanpa login.

## 5. State Management & Data Flow
- **Cart Context**: Pengelolaan keranjang belanja via React Context API dengan pelindung hidrasi `isInitialized` dan persistensi `localStorage`.
- **Server Actions (`src/app/actions/*`)**: Pusat mutasi database yang dieksekusi di sisi server dengan token rahasia `SANITY_API_WRITE_TOKEN`.

---
**PAWON** - *Modern, Terpusat, dan Berbasis Warga.*
© 2026 Pemerintah Kalurahan Pondokrejo.

