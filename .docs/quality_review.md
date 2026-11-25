# Tinjauan Kualitas Kode & Analisis Deprecation 🔍
**Pasar Warga Pondokrejo — Evaluasi Arsitektur Next.js 16, Testing, & Sanity**

Dokumen ini mencatat status kesehatan kode terkini, cakupan automated testing, temuan deprecation **Next.js 16.2.6**, serta hutang refactoring yang masih perlu ditangani (termasuk alur transaksi multi-pihak).

---

## 1. Ringkasan Status Kesehatan Kode

| Aspek | Status | Catatan Terverifikasi |
|---|---|---|
| **TypeScript Type Checking** | 🟢 Bersih | `npx tsc --noEmit` lulus dengan 0 error; tipe entitas terdefinisi di `src/types/index.ts`. |
| **Server-First Architecture** | 🟢 Baik | Pemisahan tegas antara Server Components, Client Components, dan Server Actions (`src/app/actions/` — 13 modul). |
| **Admin Zero-Draft Architecture** | 🟢 Baik | Seluruh CRUD admin (`/admin`) menargetkan dokumen published langsung (mengeliminasi `drafts.*` trap). |
| **Dynamic QRIS & SOP Engines** | 🟢 Teruji | Logika TLV EMVCo (`qrisEngine.ts`) dan klasifikasi SLA (`orderSopEngine.ts`) dipisahkan sebagai pure functions teruji. |
| **Automated Testing (Vitest)** | 🟢 Baik | **7 file test** (total **22 test case** di `courierFinance`, `qrisEngine`, `orderSopEngine`, `workflowSync`, `cart`, `order`, dan `AddToCartButton`) menggunakan Vitest v4 + RTL. |
| **Alur Transaksi Multi-Pihak & Keuangan** | 🟢 Selesai & Teruji | Round-Robin kurir (`isSettlementBlocked` filter & `isCourierConfirmedForOrder` guard), auto-skip atomic `_rev` lock, 1-link `Ambil & Mulai Antar`, COD otomatis, Hybrid QRIS, kas awal/setoran kurir (`16:00 WIB` & blokir `48 jam`), serta Peta UMKM Pondokrejo (`ISS-005` s.d. `ISS-015`). |
| **Next.js 16 Conventions** | 🟡 Perlu Modernisasi | Peringatan deprecation runtime (`middleware.ts`, `themeColor`, `@sanity/image-url`, `defineLive`) masih berlaku untuk roadmap cleanup berikutnya. |

---

## 2. Temuan Deprecation & Modernisasi (Next.js 16 & Sanity v5)

### A. Konvensi `middleware.ts` ➜ `proxy.ts`
- **Lokasi**: `src/middleware.ts`
- **Catatan**: Next.js 16 menyarankan migrasi ke konvensi `proxy.ts`. Dipertahankan sementara sampai seluruh adapter/matcher diuji penuh pada rilis produksi.

### B. Ekspor Default `@sanity/image-url`
- **Lokasi**: `src/sanity/lib/image.ts`
- **Solusi**: Gunakan named export `import { createImageUrlBuilder } from '@sanity/image-url'`.

### C. Pemisahan `themeColor` ke `viewport` Export
- **Lokasi**: `src/app/layout.tsx`
- **Solusi**: Pindahkan `themeColor` dari `metadata` ke ekspor `export const viewport: Viewport`.

### D. Token `defineLive` pada Mode Publik
- **Lokasi**: `src/sanity/lib/live.ts`
- **Catatan**: Dapat diset `serverToken: false, browserToken: false` jika preview draft luar Studio tidak dipakai.

---

## 3. Analisis Kompleksitas & Code Smells

1. **`src/app/actions/order.ts` & `src/app/actions/admin.ts`**:
   - Menangani checkout COD/QRIS, snapshot finansial (`courierFinanceEngine`), validasi HMAC action token, mutasi status multi-peran, serta Zero-Draft CRUD 8-tab Admin dan tutup buku kas harian. Ke depan dapat dipecah per domain bila bertumbuh.
2. **Duplikasi Layout Desktop vs Mobile**:
   - Halaman di `src/app/mobile/*` masih mengulang beberapa pemanggilan query dan komponen form serupa dengan desktop. Disarankan menyatukan *shared data fetchers* secara bertahap.
3. **Konsistensi Visual Token (`globals.css`)**:
   - Token `:root` `--vibe-*` sudah tersedia di `src/app/globals.css` dan dipakai di seluruh panel baru (`AdminFinanceTab`, `AdminMapTab`, `AdminSettingsQrisTab`), sementara beberapa halaman publik lama memakai utilitas warna Tailwind langsung.

---

## 4. Keamanan Kode & Validasi Input

- **Sanitasi Nomor WhatsApp**: Otomatis menormalisasi `08...` menjadi format `628...` sebelum dikirim ke Fonnte maupun tautan `wa.me`.
- **Anti-XSS Popup Peta**: Konten HTML popup marker `Leaflet` di `AdminMapTab.tsx` selalu melewati sanitasi `escapeHtml()` sebelum dirender.
- **PIN Server-Side & Proteksi Mutasi**: Validasi PIN Admin, Penjual, Kurir, dan Pembeli dijalankan melalui Server Actions menggunakan `SANITY_API_WRITE_TOKEN` yang tidak pernah diekspos ke browser client.
- **Supply Chain Dependency Gate**: Paket eksternal (`leaflet`) diverifikasi lewat `check-deps` (0 kerentanan OSV) dan diinstal dengan `--ignore-scripts`.
- **Proteksi Cron & Zero-Draft**: `/api/cron/order-sop` mendukung otorisasi `CRON_SECRET`; mutasi admin dan order berjalan tanpa draft tertinggal; repo dijaga bersih dari kebocoran token (SP-032/033).
