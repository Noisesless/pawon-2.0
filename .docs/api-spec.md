# Spesifikasi API & Server Actions PAWON 🔌
**Pasar Warga Pondokrejo — Integrasi Endpoint & Logika Server**

Aplikasi PAWON mengombinasikan **REST Route Handlers** (untuk kebutuhan diagnostik publik/eksternal) dan **Next.js Server Actions** (`'use server'`) sebagai saluran utama logika bisnis, transaksi database, dan komunikasi WhatsApp yang aman.

---

## 1. REST Route Handlers (API Routes)

### A. Diagnostik Versi Sistem
- **Route**: `GET /api/version`
- **File**: `src/app/api/version/route.ts`
- **Akses**: Publik
- **Deskripsi**: Memeriksa status hidup aplikasi, versi saat ini, dan timestamp anti-cache.
- **Contoh Respons (JSON)**:
  ```json
  {
    "version": "4.1",
    "message": "System is running the ULTIMATE anti-cache fallback diagnostic.",
    "time": "2026-09-16T05:40:00.000Z"
  }
  ```

### B. Diagnostik Data Kurir
- **Route**: `GET /api/debug-couriers`
- **File**: `src/app/api/debug-couriers/route.ts`
- **Akses**: Diagnostik Admin (Internal)
- **Deskripsi**: Mengambil daftar kurir terdaftar di Sanity secara langsung dan menghasilkan Magic Link pengujian untuk alur status COD.
- **Contoh Respons (JSON)**:
  ```json
  {
    "message": "Ini adalah daftar 100% akurat dari database Sanity yang terbaca oleh sistem saat ini.",
    "totalCouriersFound": 2,
    "couriers": {
      "Pak Agus": {
        "phone": "08123456789",
        "isActive": true,
        "status": "active",
        "adminClickLink_COD": "https://pawon.pondokrejo.id/order/TEST-123/action?role=admin&status=processing_cod&courierId=...&courierPhone=08123456789&label=Kirim+Tugas+ke+Pak+Agus"
      }
    }
  }
  ```

---

## 2. Katalog Server Actions (`src/app/actions/*`)

Semua mutasi database mengeksekusi Sanity Write Client dengan otorisasi `SANITY_API_WRITE_TOKEN`.

### 📦 A. Manajemen Pesanan Barang (`order.ts`)
| Fungsi | Parameter | Tipe Kembalian | Deskripsi |
|---|---|---|---|
| `createOrder` | `formData: OrderFormData`, `items: CartItem[]`, `totalAmount: number`, `shippingFee: number`, `customerId?: string` | `Promise<{ success: boolean, orderId?: string, orderNumber?: string, error?: string }>` | Validasi status buka toko, resolusi draft item, generate nomor pesanan `ORD-XXXXXX`, simpan pesanan ke Sanity, dan picu broadcast WA ke Admin, Penjual, Kurir, & Pembeli. |
| `updateOrderStatus` | `orderNumber: string`, `newStatus: string`, `note?: string`, `courierId?: string`, `courierPhoneParam?: string` | `Promise<{ success: boolean, message?: string, error?: string }>` | Eksekusi perpindahan status pesanan (pending → accepted → processing → shipped → delivering → delivered → completed / cancelled), integrasi Magic Link, dan pengiriman notifikasi WA otomatis. |

### 🛠️ B. Pemesanan Jasa Warga (`service-order.ts`)
| Fungsi | Parameter | Tipe Kembalian | Deskripsi |
|---|---|---|---|
| `createServiceOrder` | `data: { serviceId: string, customerName: string, customerPhone: string, deliveryAddress: string, serviceDate: string, notes?: string }` | `Promise<{ success: boolean, orderId?: string, orderNumber?: string, error?: string }>` | Mencatat pesanan jasa warga ke database Sanity dan mengirimkan notifikasi penugasan via WhatsApp kepada penyedia jasa bersangkutan. |

### 🏪 C. Portal Penjual / Lapak UMKM (`vendor-portal.ts`, `vendor-products.ts`, `vendor-services.ts`, `vendor.ts`)
| File | Fungsi | Parameter | Deskripsi |
|---|---|---|---|
| `vendor.ts` | `registerVendor` | `formData: FormData` | Pendaftaran mandiri pelaku UMKM baru dengan upload logo dan data kontak. |
| `vendor-portal.ts` | `getVendorByPhone` | `phone: string, pin: string` | Autentikasi portal UMKM dengan memverifikasi nomor WA dan validasi PIN (initial: 123456). |
| `vendor-portal.ts` | `updateVendorProfile` | `vendorId: string, data: { isOpen, closingMessage?, description? }` | Saklar buka/tutup toko dan deskripsi lapak secara real-time. |
| `vendor-products.ts` | `getVendorProducts` | `vendorId: string` | Mengambil seluruh produk yang dimiliki oleh UMKM bersangkutan. |
| `vendor-products.ts` | `uploadImageToSanity` | `formData: FormData` | Upload aset foto produk langsung ke Sanity Asset Pipeline. |
| `vendor-products.ts` | `createVendorProduct` | `vendorId: string, data: { name, price, stock, imageAssetId, categoryId?, ... }` | Menambahkan produk baru ke katalog lapak. |
| `vendor-products.ts` | `updateVendorProduct` | `productId: string, vendorId: string, data: { ... }` | Memperbarui detail, harga, atau stok produk. |
| `vendor-products.ts` | `deleteVendorProduct` | `productId: string, vendorId: string` | Menghapus dokumen produk dari katalog. |
| `vendor-services.ts` | `getVendorServices` | `vendorId: string` | Mengambil daftar jasa yang ditawarkan oleh penyedia jasa. |
| `vendor-services.ts` | `createVendorService` | `vendorId: string, data: { ... }` | Mendaftarkan layanan jasa baru. |
| `vendor-services.ts` | `updateVendorService` | `serviceId: string, vendorId: string, data: { ... }` | Mengubah detail jasa atau tarif. |
| `vendor-services.ts` | `deleteVendorService` | `serviceId: string, vendorId: string` | Menghapus layanan jasa. |

### 🚚 D. Portal Kurir Kalurahan (`courier.ts`, `courier-portal.ts`)
| File | Fungsi | Parameter | Deskripsi |
|---|---|---|---|
| `courier.ts` | `registerCourier` | `formData: { name: string, phone: string }` | Pendaftaran kurir baru oleh admin kalurahan. |
| `courier-portal.ts` | `getCourierByPhone` | `phone: string, pin: string` | Autentikasi petugas kurir via nomor WA dan PIN akses. |
| `courier-portal.ts` | `updateCourierStatus` | `courierId: string, data: { isActive: boolean, statusMessage? }` | Set status aktif/libur kurir dan catatan ketersediaan tugas. |
| `courier-portal.ts` | `getCourierOrders` | `courierId: string` | Menampilkan seluruh daftar tugas pengantaran yang ditugaskan ke kurir. |

### 👤 E. Warga & Pembeli (`buyer.ts`, `customer.ts`, `buyer-order.ts`)
| File | Fungsi | Parameter | Deskripsi |
|---|---|---|---|
| `customer.ts` | `getOrCreateCustomer` | `formData: { name, phone, address }` | Menemukan profil warga berdasarkan nomor WA, memperbarui data alamat/nama secara non-blocking jika ada perubahan, atau membuat dokumen customer baru dengan otorisasi `SANITY_API_WRITE_TOKEN`. |
| `customer.ts` | `getCustomerById` | `id: string` | Mengambil profil warga beserta riwayat transaksi COD sukses dan gagal. |

| `buyer.ts` | `loginBuyer` | `phone: string, pin: string` | Login akun warga untuk mengakses riwayat pesanan. |
| `buyer.ts` | `getBuyerOrders` | `phone: string` | Riwayat seluruh pesanan barang dan jasa warga. |
| `buyer.ts` | `changeBuyerPin` | `phone: string, oldPin: string, newPin: string` | Penggantian PIN mandiri oleh warga demi keamanan. |
| `buyer-order.ts` | `completeOrder` | `orderId: string` | Konfirmasi penerimaan pesanan oleh pembeli. |

### 🛡️ F. Operasional Admin (`admin.ts`)
| Fungsi | Parameter | Deskripsi |
|---|---|---|
| `fetchAllOrders` | `-` | Mengambil seluruh daftar transaksi terkini untuk keperluan monitoring admin kalurahan. |

---

## 3. Format Respons & Error Handling

Semua Server Actions mengembalikan objek JSON dengan struktur standar:
```typescript
// Sukses
{
  success: true,
  data?: any,
  message?: string
}

// Gagal
{
  success: false,
  error: string // Pesan human-readable dalam Bahasa Indonesia untuk ditampilkan pada toast / UI
}
```

---

## 4. Layanan Gateway WhatsApp Fonnte (`src/sanity/lib/whatsapp.ts`)

Layanan internal untuk broadcast pesan WhatsApp ke semua stakeholder:

| Fungsi | Parameter | Tipe Kembalian | Deskripsi |
|---|---|---|---|
| `sendWhatsAppNotification` | `target: string, message: string` | `Promise<{ success: boolean, data?: any, error?: string }>` | Mengirim pesan ke endpoint `https://api.fonnte.com/send`. Menggunakan token dari `process.env.FONNTE_TOKEN` / `FONNTE_API_TOKEN` (fallback token device baru `W5F7QE2AoyEUwpDGRdME`), serta otomatis menormalisasi nomor tujuan menjadi format standar internasional `628...`. |
| `formatOrderMessage` | `orderNumber, customerName, customerPhone, deliveryAddress, items, totalPrice, shippingFee, grandTotal` | `string` | Membentuk pesan invoice rincian belanja dan instruksi pembayaran COD untuk admin dan kurir. |
| `formatServiceOrderMessage` | `orderNumber, customerName, customerPhone, serviceAddress, serviceName, serviceDate, price` | `string` | Membentuk format pesan penugasan layanan jasa warga. |

