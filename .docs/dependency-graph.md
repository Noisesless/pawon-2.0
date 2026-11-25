# Graf Dependensi & Analisis Dampak 🕸️
**Pasar Warga Pondokrejo — Peta Ketergantungan Modul & Komponen**

Dokumen ini memetakan derajat keterikatan (*coupling*) antar berkas dalam basis kode **PAWON**. Panduan ini membantu mengantisipasi efek domino sebelum melakukan refactoring atau perbaikan alur transaksi.

---

## 🔴 Critical Files (Pondasi Inti — Ubah dengan Hati-Hati)

| File Path | Tipe Modul | Dampak Jika Berubah |
|---|---|---|
| `src/types/index.ts` | TypeScript Core Contracts | Mengubah `Product`, `Vendor`, `Service`, atau `Order` memengaruhi halaman, admin tabs, dan server actions. |
| `src/sanity/lib/client.ts` | Sanity Client Gateway | Koneksi read/query ke dataset Sanity (`i5mr5ihx` / `production`). |
| `src/sanity/lib/queries.ts` | GROQ Query Library | Proyeksi field yang dikonsumsi Server Components, portal, admin, dan inkubator. |
| `src/sanity/lib/whatsapp.ts` | Notification Formatter & Fonnte Client | Format pesan WA multi-channel dan pengiriman ke `https://api.fonnte.com/send`. |
| `src/context/CartContext.tsx` | Global State Management | State keranjang (`localStorage`), guard hidrasi, dan biaya ongkir dinamis dari `appSettings`. |
| `src/sanity/lib/image.ts` | Sanity Image Asset Builder | Generator URL CDN gambar responsif untuk card, banner, dan admin preview. |

---

## 🟡 High-Impact Files (Alur Transaksi, Pembayaran, Admin, & Routing)

| File Path | Depends On | Used By | Impact Level | Catatan Khusus |
|---|---|---|---|---|
| `src/middleware.ts` | Next.js Engine, User-Agent | Seluruh perutean HTTP | **Tinggi** | Mengontrol rewrite mobile (`/mobile/*`) dan pengecualian `/admin`, `/api`, `/studio`. |
| `src/app/actions/order.ts` | `client.ts`, `whatsapp.ts`, `qrisEngine.ts`, `courierFinanceEngine.ts`, `courierAssigner.ts`, `actionToken.ts`, `queries.ts` | `/checkout`, `/mobile/checkout`, `/cart`, `/order/action` | **Tinggi** | Checkout barang, setting QRIS publik, snapshot finansial order, validasi toko tutup, broadcast WA, dan transisi status. |
| `src/app/actions/admin.ts` | `next-sanity`, `orderSopEngine.ts`, `courierFinanceEngine.ts`, `queries.ts` | `/admin` (semua 7 tab) | **Tinggi** | Auth PIN admin, batch data loader, Zero-Draft CRUD semua entitas, rekonsiliasi/reset kas kurir, SOP trigger. |
| `src/lib/qrisEngine.ts` | Pure TS (no external deps) | `DynamicQrisCard.tsx`, `order.ts`, `appSettingsType.ts`, `AdminSettingsQrisTab.tsx` | **Tinggi** | Parser TLV EMVCo, validasi CRC-16, injeksi Tag 54 nominal dinamis. |
| `src/lib/actionToken.ts` | Node `crypto` (Pure utility) | `whatsapp.ts`, `order.ts`, `service-order.ts`, `vendor-portal.ts`, `courier-portal.ts`, `courierAssigner.ts` | **Tinggi** | HMAC action-link guard (`?k=...`) + normalisasi nomor telepon `08`/`628`/`+628`. |
| `src/lib/courierAssigner.ts` | `actionToken.ts` | `order.ts`, `orderSopEngine.ts`, `/track`, `/mobile/track`, `VendorDashboard.tsx` | **Tinggi** | Selektor kurir Round-Robin (`lastAssignedAt`, skip `isSettlementBlocked` & `rejectedCourierIds`) + guard `isCourierConfirmedForOrder`. |
| `src/lib/courierFinanceEngine.ts` | `whatsapp.ts`, `queries.ts` | `order.ts`, `admin.ts`, `courier-portal.ts`, `orderSopEngine.ts`, `instrumentation.ts`, `AdminFinanceTab.tsx` | **Tinggi** | Hitung kas awal kurir (`100rb`), split ongkir (`6000=4000+2000`), talangan, cutoff `16:00 WIB`, blokir `> 48 jam`, filter `financeLedgerStartedAt`. |
| `src/lib/orderSopEngine.ts` | `next-sanity`, `whatsapp.ts`, `courierAssigner.ts`, `courierFinanceEngine.ts` | `instrumentation.ts`, `/api/cron/order-sop`, `admin.ts` | **Tinggi** | Evaluasi & eksekusi auto-cancel/auto-complete, auto-skip kurir dengan atomic `_rev` lock, & pemicu sinkronisasi setoran harian. |
| `src/instrumentation.ts` | `orderSopEngine.ts`, `courierFinanceEngine.ts` | Next.js Runtime Startup | **Sedang** | Menjalankan background interval SOP (10m), auto-skip kurir (1m), dan setoran kas harian (5m) saat `NODE_ENV=production`. |
| `src/components/DynamicQrisCard.tsx` | `qrisEngine.ts`, `qrcode.react` | `/checkout`, `/mobile/checkout` | **Sedang** | Render QR Code dinamis + ekspor gambar kartu PNG Canvas untuk pembeli. |
| `src/app/admin/page.tsx` & `src/app/admin/_components/*` | `actions/admin.ts`, `qrisEngine.ts`, `courierFinanceEngine.ts`, `leaflet`, `lucide-react` | Petugas Admin Kalurahan | **Sedang** | 8 modul tab manajemen (Orders/SOP, Keuangan Kurir, Partners, Peta UMKM, Catalog, Content, Incubator, Settings/QRIS). |
| `src/app/layout.tsx` & `src/app/mobile/layout.tsx` | `Navbar.tsx`, `BottomNav.tsx`, `CartContext.tsx` | Root Shell Desktop & Mobile | **Tinggi** | Shell aplikasi utama, metadata, CSS tokens `globals.css`, dan navigasi. |

---

## 🟢 Leaf & Verification Files (Minimal Regression Risk)

| File Path | Purpose | Catatan |
|---|---|---|
| `src/app/api/version/route.ts` | Endpoint diagnostik versi | Mengembalikan JSON versi server. |
| `src/app/api/debug-couriers/route.ts` | Diagnostik daftar kurir & link | Read-only helper debugging admin. |
| `src/app/manual/*` | Halaman panduan peran | Dokumentasi in-app statis (`admin`, `kurir`, `pembeli`, `penjual`). |
| `src/app/info/page.tsx` & `[slug]` | Kabar & artikel kalurahan | Read-only artikel Sanity. |
| `src/__tests__/*.test.ts` | Test suite Vitest | Unit & contract test untuk `qrisEngine`, `orderSopEngine`, `CartContext`, `workflowSync`, dan `AddToCartButton` / `order.ts`. |
| `scripts/sync-categories.ts` & `upload-covers.ts` | Skrip migrasi/upload CLI | Dijalankan manual saat setup aset awal. |
