# Tinjauan Kualitas Kode & Analisis Deprecation 🔍
**Pasar Warga Pondokrejo — Evaluasi Arsitektur Next.js 16 & Sanity**

Dokumen ini memuat temuan analisis kualitas kode, metrik kompleksitas, status kepatuhan tipe data TypeScript, serta daftar rekomendasi refactoring terkait fitur-fitur baru dan deprecations pada **Next.js 16.2.6** dan **Sanity v5**.

---

## 1. Ringkasan Status Kesehatan Kode

| Aspek | Status | Catatan |
|---|---|---|
| **TypeScript Type Checking** | 🟢 Baik | Seluruh model entitas terdefinisi di `src/types/index.ts`. Penggunaan tipe data GROQ terstruktur. |
| **Server-First Architecture** | 🟢 Sangat Baik | Pemisahan tegas antara Server Components dan Client Components (`'use client'`). |
| **Pemisahan Logika Bisnis** | 🟢 Sangat Baik | Mutasi database terpusat pada 12 file Server Actions di `src/app/actions/`. |
| **Styling & Design System** | 🟢 Baik | Tailwind CSS v4 terintegrasi penuh dengan variabel CSS root dan glassmorphism utility. |
| **Automated Testing** | 🟡 Moderat | Vitest & React Testing Library telah dikonfigurasi. Terdapat test unit untuk `AddToCartButton` dan `order.ts`. |
| **Next.js 16 Breaking Conventions** | 🟡 Perlu Perhatian | Terdapat 4 peringatan deprecation resmi dari Next.js 16 runtime yang siap dimodernisasi. |

---

## 2. Temuan Deprecation & Rekomendasi Modernisasi (Next.js 16)

### A. Deprecation Konvensi `middleware.ts` ➜ `proxy.ts`
- **Pesan Runtime**:
  ```text
  ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
  Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
  ```
- **Lokasi**: `src/middleware.ts`
- **Dampak**: Pada Next.js 16+, konvensi middleware penanganan perutean jaringan bertransisi ke antarmuka Proxy yang lebih efisien.
- **Rencana Tindakan**: Siapkan migrasi penamaan dan struktur handler ke format Proxy saat framework sepenuhnya menghapus kompatibilitas backward.

### B. Deprecation Ekspor Default `@sanity/image-url`
- **Pesan Runtime**:
  ```text
  The default export of @sanity/image-url has been deprecated. Use the named export createImageUrlBuilder instead.
  ```
- **Lokasi**: `src/sanity/lib/image.ts`
- **Solusi Rekomendasi**:
  ```diff
  - import createImageUrlBuilder from '@sanity/image-url'
  + import { createImageUrlBuilder } from '@sanity/image-url'
  ```

### C. Pemisahan `themeColor` ke `viewport` Export
- **Pesan Runtime**:
  ```text
  ⚠ Unsupported metadata themeColor is configured in metadata export in /. Please move it to viewport export instead.
  Read more: https://nextjs.org/docs/app/api-reference/functions/generate-viewport
  ```
- **Lokasi**: `src/app/layout.tsx` / `src/app/page.tsx`
- **Solusi Rekomendasi**:
  Pindahkan properti `themeColor` dari objek `metadata` ke ekspor `viewport`:
  ```typescript
  import type { Viewport } from 'next'
  
  export const viewport: Viewport = {
    themeColor: '#15803d',
  }
  ```

### D. Konfigurasi Token `defineLive` pada Lingkungan Produksi
- **Pesan Runtime**:
  ```text
  No serverToken provided to defineLive. This means that only published content will be fetched and respond to live events.
  No browserToken provided to defineLive.
  ```
- **Lokasi**: `src/sanity/lib/live.ts`
- **Rekomendasi**: Tambahkan opsi `serverToken: false` dan `browserToken: false` pada mode publik jika draft preview tidak dibutuhkan secara langsung di luar Sanity Studio untuk meredam log peringatan.

---

## 3. Analisis Kompleksitas & Code Smells

### 1. File `src/app/actions/order.ts` (393 Baris)
- **Observasi**: File ini menangani kalkulasi keranjang, pengecekan toko tutup, publikasi dokumen draft, pembentukan format pesan WhatsApp multi-stakeholder, dan penulisan transaksi Sanity.
- **Rekomendasi**: Ekstraksi logika pemformatan pesan WA dan resolusi draft Sanity ke modul helper terpisah agar unit testing fungsi checkout lebih modular.

### 2. Duplikasi Layout Desktop vs Mobile
- **Observasi**: Antarmuka mobile di `src/app/mobile/*` mereplikasi beberapa query data yang mirip dengan halaman desktop.
- **Rekomendasi**: Berbagi fungsi helper pengambilan data (Shared Data Fetchers) antara desktop dan mobile untuk meminimalkan redundansi definisi query GROQ.

---

## 4. Keamanan Kode & Validasi Input

- **Sanitasi Nomor WhatsApp**: Format nomor dinormalisasi secara otomatis (mengubah awalan `08` menjadi kode negara `628`) sebelum diteruskan ke WhatsApp Web atau API Fonnte.
- **Validasi PIN Sisi Server**: Pengecekan PIN lapak (`/lapak`) dan kurir (`/kurir`) dilakukan melalui Server Action dengan `SANITY_API_WRITE_TOKEN` yang tidak pernah bocor ke client browser.
- **Injeksi Parameter GROQ**: Semua query GROQ menggunakan parameterisasi (`$search`, `$slug`, `$id`) untuk mencegah kerentanan injection pada Sanity query engine.
- **Otorisasi Mutasi Terproteksi**: Seluruh mutasi transaksi dan pembuatan profil pelanggan diamankan di sisi server via `SANITY_API_WRITE_TOKEN` berizin Editor, mencegah modifikasi dokumen tanpa hak akses dari sisi client.

