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

### [ISS-005] Celah Tombol Aksi pada Portal Kurir (`/kurir`)
- **Status**: RESOLVED (2026-11-25)
- **Komponen**: `src/app/kurir/_components/CourierDashboard.tsx`
- **Solusi**: Ditambahkan tombol `Terima Order` / `Tolak Order` saat status `processing`, `Barang Diambil` / `Mulai Antar` saat `accepted`, dan `Barang Diserahkan` (`delivered`) terpisah sebelum selesai; emoji UI diganti `lucide-react`.

### [ISS-006] Tombol Konfirmasi Terima Pembeli Hilang Saat Status `delivered` (`/track`)
- **Status**: RESOLVED (2026-11-25)
- **Komponen**: `src/app/track/[orderNumber]/page.tsx`, `src/app/mobile/track/[orderNumber]/page.tsx`
- **Solusi**: Menyertakan `delivered` pada render `CompleteOrderButton` di desktop & mobile, menyamakan seluruh mapping status mobile/desktop, dan menghapus seluruh emoji pada timeline desktop diganti `lucide-react`.

### [ISS-007] Portal Penjual (`/lapak`) Belum Memiliki Daftar Pesanan Masuk
- **Status**: RESOLVED (2026-11-25)
- **Komponen**: `src/app/lapak/_components/VendorDashboard.tsx`, `src/app/actions/vendor-portal.ts`
- **Solusi**: Ditambahkan tab `Pesanan` di `/lapak` dengan action `getVendorOrders` & `vendorOrderTransition` (tombol *Siap Diambil Kurir* / *Batalkan*).

### [ISS-008] Login Portal `/lapak` & `/kurir` Sensitif Format Nomor (`08...` vs `628...`)
- **Status**: RESOLVED (2026-11-25)
- **Komponen**: `src/app/actions/vendor-portal.ts`, `src/app/actions/courier-portal.ts`, `src/lib/actionToken.ts`
- **Solusi**: Pencocokan login kini memakai `getPhoneLookupVariants(phone)` (`phone in $variants`) untuk `08...`, `628...`, dan `+628...`.

### [ISS-009] Notifikasi & Keamanan Magic Link WA (`accepted`/`shipped` & `NEXT_PUBLIC_BASE_URL`)
- **Status**: RESOLVED (2026-11-25)
- **Komponen**: `src/app/actions/order.ts`, `src/app/order/[orderNumber]/action/page.tsx`, `src/lib/actionToken.ts`
- **Solusi**: Ditambahkan validasi HMAC token `k` pada link aksi, resolver URL berbasis header host pada mode dev LAN, notifikasi penuh untuk tiap transisi status, serta pengurangan `product.stock` otomatis saat `completed`.

### [ISS-010] Arsitektur WA Bersih, Round-Robin Kurir + Auto-Skip Timeout, & Hybrid COD/QRIS
- **Status**: RESOLVED (2026-11-25)
- **Komponen**: `src/sanity/lib/whatsapp.ts`, `src/lib/courierAssigner.ts`, `src/app/actions/order.ts`, `src/lib/orderSopEngine.ts`, `src/instrumentation.ts`
- **Solusi**:
  1. Seluruh pesan WA terpusat di `whatsapp.ts` tanpa emoji mentah maupun istilah teknis/database/production.
  2. Checkout COD 100% otomatis (WA Admin log-only 0 link); QRIS memakai verifikasi mutasi 1-klik Admin sebelum diteruskan otomatis.
  3. Kurir memakai Round-Robin (`courier.lastAssignedAt`), tombol WA `Terima Order` / `Tolak Order`, serta auto-skip otomatis via `courierOfferedAt` + `sopCourierTimeoutMinutes` (`runCourierTimeoutCheck()` setiap 1 menit di production dengan atomic `_rev` lock + pelestarian `courierOfferedAt` saat Penjual klik `shipped` lebih awal).

### [ISS-011] Penyederhanaan 1 Tautan Simpel Kurir (`Ambil & Mulai Antar`)
- **Status**: RESOLVED (2026-11-25)
- **Komponen**: `src/sanity/lib/whatsapp.ts`, `src/app/kurir/_components/CourierDashboard.tsx`
- **Solusi**: Setelah kurir klik `Terima Order`, WA dan Portal `/kurir` cukup menampilkan **1 tombol/tautan tunggal** `Ambil & Mulai Antar ke Pembeli` (`delivering`), baru di langkah berikutnya `Pesanan Sudah Diserahkan` (`delivered`).

### [ISS-012] Sistem Keuangan Kas Kurir (Rp100.000, Split 6000=4000:2000, Cutoff 16.00 & Blokir 2x24 Jam)
- **Status**: RESOLVED (2026-11-25)
- **Komponen**: `src/lib/courierFinanceEngine.ts`, `src/sanity/schemaTypes/courierSettlementType.ts`, `src/app/admin/_components/AdminFinanceTab.tsx`, `src/app/kurir/_components/CourierDashboard.tsx`
- **Solusi**:
  1. Menambah pengaturan ongkir `6000` (upah kurir `4000` + kas Kalurahan `2000`), kas awal kurir `100000`, cutoff harian `16:00 WIB`, serta dukungan dana talangan pribadi bila belanja ke penjual melebihi kas awal.
  2. Kurir telat setor `> 24 jam` menerima WA pengingat, dan telat `> 48 jam` dibekukan otomatis dari antrean Round-Robin sampai Admin mengonfirmasi setoran/refill.
  3. Menambah pengaman `financeLedgerStartedAt` & tombol **Reset Rekap Kas** agar transaksi historis tidak ikut tertarik saat buku kas direset.

### [ISS-013] Identitas Kurir Antrean Bocor di Lacak Pesanan Sebelum `Terima Order`
- **Status**: RESOLVED (2026-11-25)
- **Komponen**: `src/lib/courierAssigner.ts`, `src/sanity/lib/queries.ts`, `src/app/track/[orderNumber]/page.tsx`, `src/app/mobile/track/[orderNumber]/page.tsx`, `src/app/lapak/_components/VendorDashboard.tsx`, `src/app/actions/order.ts`
- **Solusi**: Menambahkan `isCourierConfirmedForOrder()` agar nama dan WA kurir hanya muncul di halaman lacak, portal penjual, dan WA pembeli setelah kurir benar-benar mengklik `Terima Order` (`courierOfferedAt == null`).

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
- **Solusi**: Mengganti token hardcoded lama pada `src/sanity/lib/whatsapp.ts` agar membaca variabel lingkungan dinamis (`process.env.FONNTE_TOKEN` / `FONNTE_API_TOKEN`). Menambahkan sanitasi & normalisasi otomatis nomor target ke format standar internasional (`628...`) sehingga notifikasi WhatsApp ke Buyer, Admin, Penjual, dan Kurir terkirim tanpa kendala format nomor.

### [RES-005] Perbaikan Tumpang Tindih Tombol Tambah ke Keranjang Mobile & Sinkronisasi Cart
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Memperbaiki deteksi rute mobile pada `BottomNav.tsx` dengan `cleanPath` agar menu navigasi bawah otomatis bersembunyi di halaman detail produk (`/mobile/product/*`) dan checkout, menghilangkan tumpang tindih dengan tombol CTA *Tambah ke Keranjang* (`z-50`). Memperbarui `CartContext.tsx` dengan state `isInitialized` untuk mencegah kondisi balapan (*race condition*) penulisan localStorage. Mengubah nama tab navigasi 'Bayar' menjadi 'Keranjang' dan menambahkan `allowedDevOrigins` di `next.config.ts` untuk pengujian via Wi-Fi lokal.

### [RES-006] Sinkronisasi & Pembaruan Menyeluruh Seluruh Dokumentasi Utama
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Memperbarui dan menyelaraskan 9 berkas blueprint `/.docs/`, `app-context.md`, `README.md`, serta panduan pengguna root (`ARCHITECTURE.md`, `PANDUAN_MENYELURUH.md`, `manual-admin.MD`). Memastikan seluruh detail teknis mutakhir (port 3333, integrasi multi-channel Fonnte token via env, pengujian jaringan Wi-Fi LAN `192.168.1.39`, dan penanganan routing mobile) terdokumentasi rapi tanpa amnesia konteks.


### [RES-007] Perbaikan Duplikasi Deklarasi Variabel pada Server Action `order.ts`
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Menghapus deklarasi ulang identik `const itemsList` pada blok penanganan status `delivering` di `src/app/actions/order.ts` (baris 334) yang sebelumnya memicu error kompilasi Turbopack (*the name itemsList is defined multiple times*). Kini alur mutasi status pesanan kurir dan broadcast notifikasi pengiriman ke Admin kalurahan berjalan mulus.

### [RES-008] Penanganan Resilient Mutasi Profil Pembeli & Diagnostik Sanity Write Token
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Memperbaiki `src/app/actions/customer.ts` agar pembaruan data pembeli lama bersifat non-blocking (tidak menggagalkan transaksi jika hanya update alamat/nama). Memperjelas pesan error pada `customer.ts` dan `order.ts` saat `SANITY_API_WRITE_TOKEN` belum disetel di `.env.local` sehingga pengguna mendapatkan petunjuk konfigurasi yang jelas untuk menambahkan token berizin Editor/Write dari Sanity Manage.

### [RES-009] Keberhasilan Verifikasi Transaksi End-to-End & Dispatch WhatsApp Gateway
- **Tanggal Selesai**: 2026-09-16
- **Solusi**: Memasang token `SANITY_API_WRITE_TOKEN` berizin Editor ke dalam `.env.local`. Menguji coba checkout belanja langsung dari perangkat smartphone: dokumen pesanan `ORD-XXXXXX` dan data profil pembeli berhasil tercatat di database Sanity.io secara real-time, dan pesan konfirmasi WhatsApp langsung terkirim dan diterima di nomor HP pembeli serta Admin kalurahan via Fonnte Gateway.




