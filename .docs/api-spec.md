# Spesifikasi API & Server Actions PAWON 🔌
**Pasar Warga Pondokrejo — Integrasi Endpoint, Engine, & Logika Server**

Aplikasi PAWON mengombinasikan **REST Route Handlers** (diagnostik & cron worker eksternal), **Core Library Engines** (`qrisEngine`, `orderSopEngine`), dan **Next.js Server Actions** (`'use server'`) sebagai saluran utama logika bisnis, mutasi Sanity, serta komunikasi WhatsApp.

---

## 1. REST Route Handlers (`src/app/api/*`)

### A. Diagnostik Versi Sistem
- **Route**: `GET /api/version`
- **File**: `src/app/api/version/route.ts`
- **Akses**: Publik
- **Deskripsi**: Memeriksa status hidup aplikasi, versi runtime, dan timestamp anti-cache.

### B. Diagnostik Data Kurir
- **Route**: `GET /api/debug-couriers`
- **File**: `src/app/api/debug-couriers/route.ts`
- **Akses**: Diagnostik Internal Admin
- **Deskripsi**: Membaca daftar kurir terdaftar di Sanity beserta format Magic Link uji coba alur COD.

### C. Cron Webhook SOP Pesanan Otomatis
- **Route**: `GET /api/cron/order-sop`
- **File**: `src/app/api/cron/order-sop/route.ts`
- **Akses**: Terproteksi `CRON_SECRET` (opsional jika env diset; mendukung header `Authorization: Bearer <secret>` atau query `?secret=<secret>`)
- **Query Params Opsional**:
  - `dryRun=true`: Hanya mengklasifikasi kandidat pesanan melewati batas SLA tanpa memodifikasi database atau mengirim WA.
  - `force=true`: Memaksa evaluasi meskipun `appSettings.isSopAutoEnabled === false`.
- **Deskripsi**: Memicu `runOrderSopEvaluation()` untuk menutup pesanan kadaluwarsa (`pending`/`processing` → `cancelled`, `delivered` → `completed`) secara aman via external cron/systemd/crontab.

---

## 2. Core Business & Payment Engines (`src/lib/*`)

### A. Dynamic QRIS EMVCo Engine (`src/lib/qrisEngine.ts`)
| Simbol | Parameter | Deskripsi |
|---|---|---|
| `calculateCRC16` | `data: string \| Uint8Array` | Menghitung checksum CRC-16/CCITT-FALSE (polynomial `0x1021`, init `0xFFFF`). |
| `validateCRC16` | `payload: string` | Memvalidasi keutuhan 4-hex digit Tag `63` pada string QRIS statis. |
| `parseTLVString` / `parseQRIS` | `payload: string` | Mengurai TLV EMVCo dan mengekstrak `merchantName` (Tag 59), `nmid` (Tag 26/51), dll. |
| `getDefaultPawonStaticQris` / `DEFAULT_PAWON_STATIC_QRIS` | `-` | Generator payload QRIS statis fallback ber-checksum valid untuk demo/default PAWON. |
| `generateDynamicQRIS` | `staticPayload, amount, feeAmount?` | Mengubah Tag `01` menjadi `12` (dynamic), menyuntikkan Tag `54` (nominal terkunci), dan menghitung ulang CRC-16 Tag `63`. |

### B. Order SOP, Round-Robin & Action Token (`src/lib/*`)
| File | Simbol | Deskripsi |
|---|---|---|
| `src/lib/courierAssigner.ts` | `pickNextRoundRobinCourier` | Memilih kurir aktif (`isActive === true && status !== 'inactive'`) berdasarkan `lastAssignedAt` terlama/kosong, mengecualikan `rejectedCourierIds`, lalu memperbarui timestamp giliran. |
| `src/lib/actionToken.ts` | `createOrderActionToken`, `verifyOrderActionToken`, `buildOrderActionUrl`, `normalizePhoneTo62`, `getPhoneLookupVariants` | Generator/verifikator token HMAC `?k=...` untuk tautan aksi WA dan normalisasi nomor telepon (`08`/`628`/`+628`). |
| `src/lib/orderSopEngine.ts` | `classifyOrderForSop`, `runCourierTimeoutCheck`, `runOrderSopEvaluation` | Klasifikasi kedaluwarsa, pengecekan auto-skip antrean kurir tidak merespons (`courierOfferedAt`), dan penutupan pesanan otomatis + ringkasan WA bersih. |

---

## 3. Katalog Server Actions (`src/app/actions/*`)

Semua mutasi menulis langsung dokumen *published* di Sanity via `SANITY_API_WRITE_TOKEN`.

### 📦 A. Pesanan Barang & Konfigurasi QRIS Publik (`order.ts`)
| Fungsi | Parameter | Deskripsi |
|---|---|---|
| `getPublicPaymentSettings` | `-` | Mengambil status aktif QRIS (`isQrisEnabled`), merchant name, NMID, `qrisStaticPayload` (fallback demo jika invalid/kosong), dan `defaultShippingFee` untuk halaman checkout & cart. |
| `createOrder` | `formData, items, totalAmount, shippingFee, customerId?` | Validasi buka/tutup lapak, untuk COD langsung tugaskan kurir Round-Robin (`processing`) + notif WA ke Penjual/Kurir/Pembeli & log Admin; untuk QRIS (`pending`) kirim 1 tautan verifikasi Admin. |
| `updateOrderStatus` | `orderNumber, newStatus, note?, courierId?, courierPhoneParam?, actionGuard?` | Validasi token `?k=...`, eksekusi perpindahan status (`paid`, `processing_cod`, `reject`, `accepted`, `shipped`, `delivering`, `delivered`, `completed`, `cancelled`), pengalihan kurir saat ditolak, pengurangan stok saat selesai, serta WA bersih. |

### 🛠️ B. Pemesanan Jasa Warga (`service-order.ts`)
| Fungsi | Parameter | Deskripsi |
|---|---|---|
| `createServiceOrder` | `{ serviceId, customerName, customerPhone, deliveryAddress, serviceDate, notes? }` | Mencatat pesanan layanan jasa warga (`orderCategory: 'service'`) beserta kontak dinamis penyedia & admin. |

### 🛡️ C. Pusat Kendali Admin Zero-Draft (`admin.ts`)
| Fungsi | Kategori | Deskripsi |
|---|---|---|
| `verifyAdminPin` | Auth | Memvalidasi PIN admin terhadap `appSettings.adminPin` di Sanity. |
| `fetchAllOrders` | Orders | Mengambil daftar pesanan lengkap beserta info kurir & daftar kurir aktif. |
| `fetchAdminDashboardData` | Dashboard | Batch fetch seluruh entitas (`orders`, `vendors`, `couriers`, `customers`, `products`, `services`, `categories`, `banners`, `articles`, `incubatorServices`, `incubatorSettings`, `appSettings`) untuk 6 tab admin. |
| `adminConfirmAndAssignOrder` | Orders | Konfirmasi pesanan masuk, update pembayaran QRIS jika perlu, dan tugaskan kurir. |
| `adminUpdateOrderDirect` | Orders | Ubah status pesanan, status bayar, kurir, dan catatan secara langsung dari tabel/kartu admin. |
| `adminQuickOrderTransition` | Orders | Transisi cepat status per tahap pesanan (`processing`, `shipped`, `delivering`, `delivered`, `completed`, `cancelled`). |
| `previewOrderSopAction` | SOP Worker | Menjalankan `runOrderSopEvaluation({ dryRun: true, force: true })` untuk pratinjau kandidat order sebelum eksekusi. |
| `executeOrderSopAction` | SOP Worker | Mengeksekusi `runOrderSopEvaluation({ dryRun: false, force: true, sendWaForRecent })` langsung dari modal admin. |
| `uploadAdminImage` | Media | Mengunggah aset gambar dari form admin langsung ke Sanity Image Asset Pipeline. |
| `adminDeleteDocument` | Utility | Menghapus dokumen published maupun sisa draft secara bersih. |
| `saveAppSettings` | Settings & QRIS | Menyimpan konfigurasi global WA admin, ongkir, PIN admin, pengaturan QRIS (`isQrisEnabled`, `qrisMerchantName`, `qrisNmid`, `qrisStaticPayload`), dan ambang batas SOP SLA. |
| `saveVendor`, `saveCourier`, `saveCustomer`, `saveProduct`, `saveService`, `saveCategory`, `saveBanner`, `saveArticle`, `saveIncubatorService`, `saveIncubatorSettings` | Full CRUD | Create/Update dokumen langsung berstatus *published* untuk seluruh entitas marketplace, konten, dan inkubator UMKM. |

### 🏪 D. Portal Penjual / Lapak UMKM (`vendor.ts`, `vendor-portal.ts`, `vendor-products.ts`, `vendor-services.ts`)
- `registerVendor(formData)`: Registrasi mandiri lapak UMKM baru.
- `getVendorByPhone(phone, pin)`, `updateVendorProfile(vendorId, data)`: Autentikasi (tahan format `08`/`628`/`+628`) & saklar buka/tutup toko.
- `getVendorOrders(vendorId)`, `vendorOrderTransition(orderNumber, nextStatus, note)`: Daftar pesanan masuk milik toko & tombol siap ambil/batalkan.
- `getVendorProducts`, `uploadImageToSanity`, `createVendorProduct`, `updateVendorProduct`, `deleteVendorProduct`: Pengelolaan produk oleh UMKM.
- `getVendorServices`, `createVendorService`, `updateVendorService`, `deleteVendorService`: Pengelolaan layanan jasa oleh UMKM.

### 🚚 E. Portal Kurir Kalurahan (`courier.ts`, `courier-portal.ts`)
- `registerCourier`, `getCourierByPhone(phone, pin)` *(mendukung varian `08`/`628`/`+628`)*, `updateCourierStatus(courierId, data)`, `getCourierOrders(courierId)`.

### 👤 F. Warga & Pembeli (`customer.ts`, `buyer.ts`, `buyer-order.ts`)
- `getOrCreateCustomer`, `getCustomerById`
- `loginBuyer`, `getBuyerOrders`, `changeBuyerPin`
- `completeOrder`

---

## 4. Layanan Gateway WhatsApp Fonnte (`src/sanity/lib/whatsapp.ts`)

| Fungsi | Deskripsi |
|---|---|
| `sendWhatsAppNotification(target, message)` | Mengirim pesan via `https://api.fonnte.com/send` memakai `process.env.FONNTE_TOKEN` (atau `FONNTE_API_TOKEN`) dengan normalisasi nomor tujuan ke `628...`. |
| `formatOrderMessage` | Membentuk template pesan ringkas/lengkap untuk notifikasi pesanan barang. |
| `formatServiceOrderMessage` | Membentuk format pesan notifikasi pemesanan jasa warga. |
