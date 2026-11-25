# PAWON (Pasar Warga Pondokrejo) 🍲⚡

**PAWON** adalah platform marketplace digital resmi milik **Kalurahan Pondokrejo** yang dirancang untuk memperkuat ekonomi warga. Nama **PAWON** (*Pasar Warga Pondokrejo*) melambangkan kehangatan dapur sebagai pusat aktivitas ekonomi lokal yang menghubungkan produk UMKM, hasil bumi, dan layanan jasa profesional warga langsung ke pembeli.

---

## 🚀 Fitur Utama

### 🛒 Marketplace Produk UMKM & Jasa Warga
- **Katalog Produk & Jasa Terverifikasi**: Produk UMKM, layanan jasa tenaga ahli lokal, serta layanan pendampingan **Inkubator Bisnis UMKM**.
- **Checkout COD & Dynamic QRIS (EMVCo)**: Pembayaran tunai di tempat (COD) atau **Dynamic QRIS** dengan injeksi nominal tagihan tepat (TLV Tag `54` + validasi checksum CRC-16) dan opsi unduh kartu QRIS PNG siap scan.

### 🛡️ Pusat Kendali Admin Zero-Draft (`/admin`)
- **7-Tab Manajemen Langsung**: Kelola **Pesanan**, **Keuangan Kurir** (kas awal `Rp100.000`, rekap setor/refill jam `16:00 WIB`, dana talangan, & blokir `> 2x24 jam`), **Mitra & Warga**, **Katalog & Kategori**, **Konten & Banner**, **Inkubator UMKM**, serta **Pengaturan & QRIS** tanpa hambatan dokumen `drafts.*`.
- **Analitik & Pengelompokan Transaksi**: KPI interaktif, grup pesanan berjenjang (**Bulan > Minggu > Hari**) dengan *auto-collapse* akordeon, mode tampilan Tabel/Kartu, rincian subtotal + ongkir (`Rp6.000` = `Rp4.000` kurir + `Rp2.000` Kalurahan), tautan koordinasi WhatsApp 3-arah, serta ekspor CSV.
- **Kurir Round-Robin & Auto-Skip**: Penugasan kurir bergiliran adil (`lastAssignedAt`), opsi **Terima/Tolak Order** langsung di WA & `/kurir`, pengalihan otomatis jika melewati batas waktu respons, serta privasi identitas kurir antrean hingga kurir menyanggupi tugas.
- **Order SOP & Settlement Worker**: Penutupan otomatis pesanan kedaluwarsa (10m), auto-skip kurir (1m), serta tutup buku kas harian `16:00 WIB` & pembekuan tunggakan `> 48 jam` (5m) melalui `src/instrumentation.ts` dan `/api/cron/order-sop`.

### 🚚 Portal Mandiri & Notifikasi Multi-Channel
- **Portal Penjual (`/lapak`)**: Autentikasi WA (`08`/`628`) + PIN untuk kelola **Pesanan Masuk**, buka/tutup toko, serta kelola produk/jasa.
- **Portal Kurir (`/kurir`)**: Autentikasi WA (`08`/`628`) + PIN dengan **1 tombol/tautan simpel `Ambil & Mulai Antar`**, kartu **Kas Awal & Upah Harian**, serta status aktif bertugas.
- **WhatsApp Gateway (Fonnte)**: Notifikasi otomatis bebas emoji dengan tautan konfirmasi bertanda tangan HMAC; transaksi COD berjalan otomatis penuh (**Admin log-only**) dan QRIS memakai konfirmasi mutasi 1-klik Admin.

### 📱 Adaptive Mobile Experience (PWA)
- **Invisible Mobile Rewrite**: Middleware (`src/middleware.ts`) mendeteksi perangkat mobile dan mengarahkan secara transparan ke antarmuka `/mobile/*` dengan *Bottom Navigation Bar*.
- **PWA Ready**: Dapat dipasang di layar utama smartphone Android tanpa Play Store.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router + Turbopack, TypeScript)
- **Headless CMS & Data Store**: [Sanity.io v5](https://www.sanity.io/) (`next-sanity`)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons & QR**: [Lucide React](https://lucide.dev/), [`qrcode.react`](https://www.npmjs.com/package/qrcode.react)
- **Testing**: [Vitest](https://vitest.dev/) & React Testing Library
- **WhatsApp Gateway**: Fonnte API
- **Deployment Target**: Ubuntu VPS (CloudPanel + Nginx Reverse Proxy + PM2)

---

## 📚 Dokumentasi Lengkap (Single Source of Truth)

Seluruh spesifikasi teknis terpusat di direktori [`.docs/`](.docs/architecture.md):

1. [Arsitektur Sistem](.docs/architecture.md) — Aliran data makro, mobile rewrite, Pusat Kendali Admin `/admin`, dan SOP Worker.
2. [Spesifikasi API & Server Actions](.docs/api-spec.md) — Endpoint REST (`/api/*`), Core Engines (`qrisEngine`, `orderSopEngine`), dan Server Actions.
3. [Skema Database & Sanity Model](.docs/database.md) — ERD dokumen, skema `order` & `appSettings` terbaru, dan GROQ queries.
4. [Peta Rute & Middleware](.docs/routes.md) — Rute desktop, subpath `/mobile/*`, cron endpoint, dan `instrumentation.ts`.
5. [Tinjauan Kualitas Kode](.docs/quality_review.md) — Status TypeScript, Vitest, code smells, dan deprecation Next.js 16.
6. [Graf Dependensi](.docs/dependency-graph.md) — Peta ketergantungan modul kritis dan analisis dampak perubahan.
7. [Panduan Deployment](.docs/deployment.md) — Environment mapping, aktivasi worker production, dan rollback plan.
8. [Pelacak Isu Teknis](.docs/issues.md) — Isu aktif (`ISS-*`) dan riwayat perbaikan (`RES-*`).
9. [Sistem Desain Visual](.docs/design-system.md) — Token CSS `:root`, tipografi, ikonografi, dan ritme UI.

*(Dokumen operasional lawas yang tidak lagi dipakai diarsipkan di folder `temp/`.)*

---

## 📦 Instalasi & Pengembangan Lokal

1. **Clone Repository**:
   ```bash
   git clone https://github.com/Noisesless/pawon-2.0.git
   cd pawon-2.0
   ```

2. **Instal Dependensi**:
   ```bash
   npm install
   ```

3. **Konfigurasi `.env.local`**:
   Buat file `.env.local` pada root proyek (jangan pernah commit `.env*`):
   ```env
   NEXT_PUBLIC_SANITY_PROJECT_ID="<SANITY_PROJECT_ID>"
   NEXT_PUBLIC_SANITY_DATASET="production"
   SANITY_API_WRITE_TOKEN="<SANITY_WRITE_TOKEN>"
   NEXT_PUBLIC_BASE_URL="http://localhost:3333"
   FONNTE_TOKEN="<FONNTE_TOKEN>"
   CRON_SECRET="<CRON_SECRET_OPSIONAL>"
   ENABLE_ORDER_SOP_WORKER="false"
   ```
   > Catatan: Worker background SOP otomatis nonaktif pada `NODE_ENV=development` (`ENABLE_ORDER_SOP_WORKER=false`) agar pengujian lokal tidak memicu penutupan order atau notifikasi WA ganda terhadap server produksi.

4. **Jalankan Server Pengembangan (Port `3333`)**:
   ```bash
   npx next dev -p 3333
   ```
   - Akses desktop: `http://localhost:3333`
   - Akses pengujian HP (Wi-Fi LAN yang sama): `http://192.168.1.39:3333`
   - Pusat Kendali Admin: `http://localhost:3333/admin`

5. **Jalankan Pemeriksaan Tipe & Pengujian**:
   ```bash
   npx tsc --noEmit
   npx vitest run
   ```

---

## 🌐 Deployment Singkat (Ubuntu + CloudPanel)

1. Konfigurasi seluruh environment variable produksi (termasuk `CRON_SECRET` dan `NODE_ENV=production`) di CloudPanel.
2. Build & jalankan melalui PM2:
   ```bash
   npm ci && npm run build
   pm2 restart pawon-app || pm2 start npm --name "pawon-app" -- start -- -p 3000
   ```
3. Lihat checklist & opsi crontab cadangan selengkapnya di [Panduan Deployment](.docs/deployment.md).

---
**PAWON** — *Membangun Kalurahan dari Tetangga.*  
© 2026 Pemerintah Kalurahan Pondokrejo.
