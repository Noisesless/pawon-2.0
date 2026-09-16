# Sistem Desain Visual PAWON (Design System) 🎨
**Pasar Warga Pondokrejo — Single Source of Truth Visual & Token Komponen**

Dokumen ini menjadi acuan tunggal seluruh elemen visual antarmuka aplikasi **PAWON**, menetapkan DNA visual yang mencerminkan kesegaran pedesaan, kehangatan dapur warga, dan keandalan digital modern.

---

## 1. Visual DNA & Color Tokens

PAWON mengusung nuansa **Agri-Commerce & Village Warmth** dengan perpaduan hijau segar khas persawahan Kalurahan Pondokrejo, aksen kuning kunyit hangat, dan latar belakang bersih yang ramah keterbacaan di bawah sinar matahari.

### A. Palet Warna Inti
```css
:root {
  /* Surface & Base */
  --vibe-background:  #f8fafc; /* slate-50 - Latar belakang utama bersih */
  --vibe-surface:     #ffffff; /* white - Permukaan kartu & kontainer */
  --vibe-surface-sub: #f1f5f9; /* slate-100 - Aksen sekunder kontainer */

  /* Typography Colors */
  --vibe-text-main:   #0f172a; /* slate-900 - Teks utama dengan kontras tinggi (≥7:1) */
  --vibe-text-sub:    #475569; /* slate-600 - Teks keterangan & label metadata */
  --vibe-text-muted:  #94a3b8; /* slate-400 - Placeholder & petunjuk non-aktif */

  /* Brand Accents */
  --vibe-accent-1:    #15803d; /* green-700 - Hijau Pondokrejo (Brand utama, tombol primer) */
  --vibe-accent-1-lt: #f0fdf4; /* green-50 - Latar badge terverifikasi & highlight */
  --vibe-accent-2:    #f59e0b; /* amber-500 - Kuning kehangatan dapur (Rating, promo, bintang) */

  /* Status Tokens */
  --vibe-success:     #16a34a; /* green-600 - Pesanan terkirim / sukses */
  --vibe-warning:     #eab308; /* yellow-500 - Pesanan dalam perjalanan */
  --vibe-error:       #dc2626; /* red-600 - Toko tutup / stok habis / error */

  /* Geometry & Animation */
  --radius-sm:        8px;
  --radius-md:        16px;    /* rounded-2xl - Standar kartu & tombol */
  --radius-lg:        24px;    /* rounded-3xl - Hero banner & modal */
  --radius-full:      9999px;  /* Pill button & status badge */
  --vibe-transition:  all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### B. Tipografi
- **Font Utama (Body & Heading)**: `Geist Sans` (didukung oleh sistem font cadangan `ui-sans-serif, system-ui, sans-serif`).
- **Font Angka / Kode / Tracking**: `Geist Mono` untuk nomor pesanan (`ORD-XXXXXX`), PIN, dan nilai nominal Rupiah.
- **Hierarki Tipografi**:
  - `Hero Heading`: 36px - 48px, Font-Black / Extrabold.
  - `Section Heading`: 24px - 30px, Font-Bold dengan sentuhan `.text-gradient`.
  - `Card Title`: 16px - 18px, Font-Semibold.
  - `Body Text`: 14px - 15px, Font-Normal (Line height 1.6).
  - `Microcopy & Badges`: 11px - 12px, Font-Bold uppercase dengan letter-spacing lebar.

### C. Elevasi & Bayangan (Shadow System)
- **Kartu Produk Standar**: `box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)`
- **Hover Elevation**: `box-shadow: 0 20px 25px -5px rgb(21 128 61 / 0.1), 0 8px 10px -6px rgb(21 128 61 / 0.1)`
- **Glassmorphism Container**:
  ```css
  .glass {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.4);
  }
  ```

---

## 2. Component Token Registry

### A. Ikonografi
- **Icon Library Tunggal**: `lucide-react` (Dilarang mencampur icon library lain).
- **Ukuran Standar**:
  - Mini / Badge: `size-3.5` (14px)
  - Inline Text: `size-4` (16px)
  - Button Action: `size-5` (20px)
  - Floating Action / Nav: `size-6` (24px)

### B. Tombol Aksi (Buttons)
- **Primary CTA**: Latar `#15803d` (Green-700), teks putih, hover `bg-green-800`, padding `px-6 py-3.5`, rounded `rounded-2xl`, shadow lembut hijau.
- **Secondary / WhatsApp CTA**: Latar `#25d366` (WA Green), teks putih, ikon WhatsApp tersemat.
- **Danger / Cancel CTA**: Latar `#fef2f2`, teks `#dc2626`, hover `bg-red-100`.

### C. Kartu Produk (ProductCard)
- Aspek rasio foto: Persegi 1:1 (`aspect-square`) dengan `object-cover`.
- Badge verifikasi UMKM: Badge hijau kecil di bawah judul lapak.
- Harga: Diformat dengan lokal Indonesia (`Rp${price.toLocaleString('id-ID')}`).

---

## 3. Ritme Bagian & Tata Letak Halaman (Section Rhythm)

Struktur tata letak beranda dan katalog mengikuti kaidah ritme asimetris yang dinamis:
1. **Hero Banner**: Desain berani dengan latar gelap (`bg-slate-900`) dipadukan foto dapur hangat, teks kontras putih, dan pill badge verifikasi resmi kalurahan.
2. **Kategori Grid**: Barisan ikon kategori bergaya kapsul geser horisontal pada perangkat mobile dan grid 4-6 kolom pada desktop.
3. **Bento / Asymmetric Promo Section**: Menampilkan promo terlaris dengan kartu berukuran variatif, bukan 3 kartu identik yang monoton.
4. **Katalog Produk & Jasa Tabbed**: Pemisahan jelas antara komoditas fisik dan tenaga ahli jasa warga.
5. **Kabar Kalurahan**: Feed berita edukasi UMKM dengan kartu horizontal berfoto.
6. **Mobile Navigation & Fixed CTA Hierarchy**:
   - **Bottom Navigation Bar**: Menu bar melayang di bagian bawah (`z-50`) dengan 5 tab standar e-commerce: *Beranda*, *Produk*, *Jasa*, *Toko*, dan *Keranjang* (dengan badge counter oranye reaktif).
   - **Detail Page Sticky Action**: Pada seluruh halaman rute detail dan checkout (`/product/*`, `/service/*`, `/checkout`), `BottomNav` otomatis bersembunyi untuk memberi panggung penuh pada bilah aksi mengambang (*Fixed Bottom Action Bar* `z-50`) yang memuat tombol *Tanya Penjual (WhatsApp)* dan tombol *Tambah ke Keranjang* berukuran penuh.
