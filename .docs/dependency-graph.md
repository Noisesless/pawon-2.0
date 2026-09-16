# Graf Dependensi & Analisis Dampak 🕸️
**Pasar Warga Pondokrejo — Peta Ketergantungan Modul & Komponen**

Dokumen ini memetakan derajat kepentingan dan keterikatan (*coupling*) antar berkas dalam basis kode **PAWON**. Panduan ini penting sebelum melakukan refactoring untuk mengantisipasi efek domino ke modul lain.

---

## 🔴 Critical Files (Paling Banyak Diimpor — Jangan Ubah Tanpa Review)

Berkas-berkas ini menjadi pondasi dasar seluruh aplikasi. Perubahan tanda tangan fungsi (*signature*) atau struktur tipe data di sini akan merusak puluhan modul sekaligus.

| File Path | Imported By (Est. Count) | Tipe Modul | Dampak Jika Berubah |
|---|---|---|---|
| `src/types/index.ts` | 25+ modul | TypeScript Core Contracts | Mengubah `Product`, `Vendor`, `Service`, atau `Order` akan memicu error kompilasi di hampir seluruh halaman dan komponen. |
| `src/sanity/lib/client.ts` | 18+ modul | Sanity Client Gateway | Menghubungkan query read-only maupun server-action mutation ke cluster Sanity.io. |
| `src/sanity/lib/queries.ts` | 16+ modul | GROQ Query Library | Perubahan proyeksi field pada query GROQ akan langsung memengaruhi data props di Server Components. |
| `src/context/CartContext.tsx` | 12+ modul | Global State Management | Menyimpan keranjang belanja di `localStorage`. Diperlukan oleh Navbar, BottomNav, AddToCartButton, Checkout, dan Cart views. |
| `src/sanity/lib/image.ts` | 14+ modul | Sanity Image Asset Builder | Menghasilkan URL gambar responsif berukuran optimal (CDN) untuk seluruh card produk, banner, dan logo UMKM. |
| `src/sanity/lib/whatsapp.ts` | 8+ modul | Notification Formatter | Mengatur susunan template pesan WA ke Admin, Penjual, Kurir, dan Pembeli. |

---

## 🟡 High-Impact Files (Ubah = Efek Luas)

Berkas-berkas yang mengontrol alur UX makro atau logika transaksi utama.

| File Path | Depends On | Used By | Impact Level | Catatan Khusus |
|---|---|---|---|---|
| `src/middleware.ts` | Next.js Engine, User-Agent | Seluruh perutean HTTP | **Tinggi** | Kesalahan regex user-agent dapat merusak pengalaman pengguna smartphone atau merusak rute `/studio` & `/api`. |
| `src/app/actions/order.ts` | `client.ts`, `whatsapp.ts`, `types` | `/checkout`, `/order/action` | **Tinggi** | Pusat transaksi pemesanan barang, pengecekan buka/tutup lapak, dan broadcast notifikasi WA. |
| `src/app/layout.tsx` | `Navbar.tsx`, `CartContext.tsx` | Seluruh Halaman Desktop | **Tinggi** | Root shell desktop (HTML, font Geist, metadata, header, footer). |
| `src/app/mobile/layout.tsx` | `BottomNav.tsx`, `CartContext.tsx` | Seluruh Halaman Mobile | **Tinggi** | Root shell mobile view yang menyematkan Bottom Navigation bar permanen. |
| `src/components/ProductCard.tsx` | `image.ts`, `AddToCartButton.tsx` | Beranda, `/products`, `/lapak` | **Sedang** | Komponen kartu etalase produk UMKM yang tampil di berbagai halaman. |
| `src/components/mobile/BottomNav.tsx` | `CartIconBadge.tsx`, Lucide Icons | Seluruh `/mobile/*` views | **Sedang** | Navigasi utama bagi pengguna smartphone. |

---

## 🟢 Leaf Files (Aman Diubah — Minimal Dependency)

Berkas independen yang berada di ujung pohon dependensi. Perubahan pada berkas ini memiliki risiko regresi mendekati nol terhadap bagian sistem lainnya.

| File Path | Purpose | Catatan |
|---|---|---|
| `src/app/api/version/route.ts` | Endpoint diagnostik versi anti-cache | Mengembalikan respons JSON statis |
| `src/app/manual/admin/page.tsx` | Halaman panduan petugas admin | Berisi dokumentasi statis |
| `src/app/manual/kurir/page.tsx` | Halaman panduan operasional kurir | Berisi dokumentasi statis |
| `src/app/manual/penjual/page.tsx` | Halaman panduan pelaku UMKM | Berisi dokumentasi statis |
| `src/app/manual/pembeli/page.tsx` | Halaman panduan belanja warga | Berisi dokumentasi statis |
| `src/components/TrackOrderForm.tsx` | Form pencarian nomor pesanan | Komponen UI terisolasi dengan state lokal |
| `src/app/info/page.tsx` | Halaman kabar dan pelatihan kalurahan | Membaca dokumen artikel secara pasif |
| `scripts/sync-categories.ts` | Skrip migrasi CLI | Hanya dijalankan secara manual via Node.js |
| `scripts/upload-covers.ts` | Skrip upload sampul CLI | Skrip batch sekali jalan |
