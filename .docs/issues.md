# Pelacak Isu & Catatan Teknis (Issues Tracker) 📋
**Pasar Warga Pondokrejo — Pelacakan Masalah, Bug, & Rencana Refactoring**

Dokumen ini mencatat daftar isu teknis aktif (OPEN) serta riwayat masalah yang telah terselesaikan (RESOLVED) dalam pengembangan platform PAWON.

---

## 🟢 OPEN ISSUES (Dalam Pemantauan / Antrean Pengerjaan)

### [ISS-001] Peringatan Konvensi Next.js 16 (`middleware.ts` ➜ `proxy.ts`)
- **Status**: OPEN
- **Prioritas**: Rendah (Non-blocking)
- **Komponen**: `src/middleware.ts`
- **Deskripsi**: Next.js 16 menampilkan deprecation notice: `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`
- **Rencana Solusi**: Merestrukturisasi berkas ke konvensi proxy handler resmi Next.js 16 saat API stabil sepenuhnya dirilis.

### [ISS-002] Deprecation Ekspor Default `@sanity/image-url`
- **Status**: OPEN
- **Prioritas**: Rendah (Non-blocking)
- **Komponen**: `src/sanity/lib/image.ts`
- **Deskripsi**: Terminal menampilkan peringatan deprecation: `The default export of @sanity/image-url has been deprecated. Use the named export createImageUrlBuilder instead.`
- **Rencana Solusi**: Ganti baris import menjadi named import `{ createImageUrlBuilder }`.

### [ISS-003] Migrasi Konfigurasi `themeColor` ke `viewport`
- **Status**: OPEN
- **Prioritas**: Rendah (Non-blocking)
- **Komponen**: `src/app/layout.tsx`
- **Deskripsi**: Ekspor metadata `themeColor` di root layout memicu peringatan browser viewport Next.js.
- **Rencana Solusi**: Pindahkan deklarasi properti `themeColor: '#15803d'` ke dalam objek `export const viewport: Viewport = { ... }`.

### [ISS-004] Penanganan Log Token Live Sanity di Lingkungan Dev
- **Status**: OPEN
- **Prioritas**: Rendah
- **Komponen**: `src/sanity/lib/live.ts`
- **Deskripsi**: `defineLive` mencetak log ketiadaan `serverToken` dan `browserToken` saat mode live preview tidak disetel.
- **Rencana Solusi**: Menambahkan opsi eksplisit `serverToken: false, browserToken: false` jika draft preview independen tidak digunakan.

---

## 🔵 RESOLVED ISSUES (Terselesaikan)

### [RES-001] Pemilihan Port Development Kompatibel Sanity CORS
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Mengalihkan port default Next.js dari port 3000 (blacklisted port) ke port **3333** via perintah `npm run dev -- -p 3333` agar cocok dengan whitelist CORS origin Sanity.io.

### [RES-002] Konfigurasi Awal Lingkungan Sanity Lokal
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Membuat berkas konfigurasi lingkungan lokal [`.env.local`](file:///E:/Project/pawon-pondokrejo-master/.env.local) dengan referensi proyek `NEXT_PUBLIC_SANITY_PROJECT_ID="i5mr5ihx"` dan dataset `"production"` sehingga Turbopack dapat melakukan live query data tanpa error fatal.

### [RES-003] Pembentukan Single Source of Truth Dokumentasi (`/.docs/`)
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Mengindeks seluruh repositori, menyatukan dokumen tercecer ke dalam 9 berkas blueprint `/.docs/` standar Vibes Coding Workflow, dan menyinkronkan [app-context.md](file:///E:/Project/pawon-pondokrejo-master/app-context.md).

### [RES-004] Perbaikan Hardcode Token Fonnte & Normalisasi Nomor HP Buyer
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Mengganti hardcoded token Fonnte lama yang mati (`Mi2V1BEF2o8kkis8FfRF`) pada `src/sanity/lib/whatsapp.ts` agar membaca variabel lingkungan dinamis (`process.env.FONNTE_TOKEN` / `FONNTE_API_TOKEN`) dengan fallback ke token device baru (`W5F7QE2AoyEUwpDGRdME`). Menambahkan sanitasi & normalisasi otomatis nomor target ke format standar internasional (`628...`) sehingga notifikasi WhatsApp ke Buyer, Admin, Penjual, dan Kurir terkirim tanpa kendala format nomor.

### [RES-005] Perbaikan Tumpang Tindih Tombol Tambah ke Keranjang Mobile & Sinkronisasi Cart
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Memperbaiki deteksi rute mobile pada `BottomNav.tsx` dengan `cleanPath` agar menu navigasi bawah otomatis bersembunyi di halaman detail produk (`/mobile/product/*`) dan checkout, menghilangkan tumpang tindih dengan tombol CTA *Tambah ke Keranjang* (`z-50`). Memperbarui `CartContext.tsx` dengan state `isInitialized` untuk mencegah kondisi balapan (*race condition*) penulisan localStorage. Mengubah nama tab navigasi 'Bayar' menjadi 'Keranjang' dan menambahkan `allowedDevOrigins` di `next.config.ts` untuk pengujian via Wi-Fi lokal.

### [RES-006] Sinkronisasi & Pembaruan Menyeluruh Seluruh Dokumentasi Utama
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Memperbarui dan menyelaraskan 9 berkas blueprint `/.docs/`, `app-context.md`, `README.md`, serta panduan pengguna root (`ARCHITECTURE.md`, `PANDUAN_MENYELURUH.md`, `manual-admin.MD`). Memastikan seluruh detail teknis mutakhir (port 3333, integrasi multi-channel Fonnte token `W5F7QE2AoyEUwpDGRdME`, pengujian jaringan Wi-Fi LAN `192.168.1.39`, dan penanganan routing mobile) terdokumentasi rapi tanpa amnesia konteks.

### [RES-007] Perbaikan Duplikasi Deklarasi Variabel pada Server Action `order.ts`
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Menghapus deklarasi ulang identik `const itemsList` pada blok penanganan status `delivering` di `src/app/actions/order.ts` (baris 334) yang sebelumnya memicu error kompilasi Turbopack (*the name itemsList is defined multiple times*). Kini alur mutasi status pesanan kurir dan broadcast notifikasi pengiriman ke Admin kalurahan berjalan mulus.

### [RES-008] Penanganan Resilient Mutasi Profil Pembeli & Diagnostik Sanity Write Token
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Memperbaiki `src/app/actions/customer.ts` agar pembaruan data pembeli lama bersifat non-blocking (tidak menggagalkan transaksi jika hanya update alamat/nama). Memperjelas pesan error pada `customer.ts` dan `order.ts` saat `SANITY_API_WRITE_TOKEN` belum disetel di `.env.local` sehingga pengguna mendapatkan petunjuk konfigurasi yang jelas untuk menambahkan token berizin Editor/Write dari Sanity Manage.

### [RES-009] Keberhasilan Verifikasi Transaksi End-to-End & Dispatch WhatsApp Gateway
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Memasang token `SANITY_API_WRITE_TOKEN` berizin Editor ke dalam `.env.local`. Menguji coba checkout belanja langsung dari perangkat smartphone: dokumen pesanan `ORD-XXXXXX` dan data profil pembeli berhasil tercatat di database Sanity.io secara real-time, dan pesan konfirmasi WhatsApp langsung terkirim dan diterima di nomor HP pembeli serta Admin kalurahan via Fonnte Gateway.




