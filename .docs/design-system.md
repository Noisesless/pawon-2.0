# Sistem Desain Visual PAWON (Design System) 🎨
**Pasar Warga Pondokrejo — Single Source of Truth Visual & Token Komponen**

Dokumen ini menjadi acuan tunggal seluruh elemen visual antarmuka aplikasi **PAWON**, menetapkan DNA visual yang mencerminkan kesegaran pedesaan, kehangatan dapur warga, dan antarmuka operasional yang bersih.

---

## 1. Visual DNA & Color Tokens (`src/app/globals.css`)

PAWON mengusung nuansa **Agri-Commerce & Village Warmth** dengan perpaduan hijau persawahan Kalurahan Pondokrejo, aksen kunyit hangat, dan permukaan terang bernuansa clean slate (`--background: #f8fafc`) demi keterbacaan tinggi di bawah sinar matahari.

### A. Palet Warna & Token `:root` Terpasang
```css
:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --primary: #15803d;
  --primary-light: #f0fdf4;
  --accent: #f59e0b;

  /* PAWON Design System SSOT Tokens */
  --vibe-background: #f8fafc;
  --vibe-surface: #ffffff;
  --vibe-surface-sub: #f1f5f9;
  --vibe-border: #e2e8f0;
  --vibe-text-main: #0f172a;
  --vibe-text-sub: #475569;
  --vibe-text-muted: #94a3b8;
  --vibe-accent-1: #15803d;
  --vibe-accent-1-lt: #f0fdf4;
  --vibe-accent-2: #f59e0b;
  --vibe-accent-2-lt: #fffbeb;
  --vibe-success: #16a34a;
  --vibe-warning: #eab308;
  --vibe-error: #dc2626;
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-full: 9999px;
  --vibe-font-main: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --vibe-font-head: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --vibe-font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;
  --vibe-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### B. Tipografi
- **Font Utama (`--vibe-font-main` / `--vibe-font-head`)**: `Geist Sans` (`ui-sans-serif, system-ui, sans-serif`).
- **Font Angka / Kode (`--vibe-font-mono`)**: `Geist Mono` untuk nomor pesanan (`ORD-XXXXXX`), NMID QRIS, timer/SLA, dan nilai nominal Rupiah.

### C. Elevasi & Permukaan
- Permukaan kartu operasional & etalase menggunakan latar `--vibe-surface` (`#ffffff`) dengan border halus `--vibe-border` (`#e2e8f0`), menghindari bayangan berat pada elemen diam (*anti resting shadows*).
- Utility `.glass` & `.text-gradient` tersedia di `globals.css` untuk header dan penekanan heading seksi.

---

## 2. Component Token Registry

### A. Ikonografi
- **Icon Library Tunggal**: `lucide-react` (dilarang mencampur ikon library lain atau SVG hand-rolled baru di komponen UI).

### B. Komponen Kunci Terbaru
- **`DynamicQrisCard` (`src/components/DynamicQrisCard.tsx`)**:
  - Kartu pembayaran QRIS EMVCo dengan badge NMID, tampilan nominal terkunci bold, QR code berbasis SVG/Canvas (`qrcode.react`), serta tombol unduh kartu QRIS berformat PNG siap cetak/scan dari galeri e-wallet.
- **Pusat Kendali Admin (`/admin`)**:
  - Tata letak 7-tab (termasuk tab **Keuangan Kurir** `AdminFinanceTab`) dengan kartu KPI filterable, grup transaksi berbasis periode (`Bulan > Minggu > Hari`) yang otomatis terlipat (*auto-collapse*), saklar tampilan **Tabel vs Kartu**, stepper 5-tahap horizontal, tombol setoran/refill warna semantik status, serta kartu **Kas Awal & Upah** di Portal Kurir (`/kurir`) berbasis token `var(--vibe-*)` tanpa resting shadows.

---

## 3. Ritme Bagian & Navigasi Responsif

- **Desktop (≥ 1024px, target acuan `1366×768`)**: Navbar atas tetap, grid etalase multi-kolom, dan tabel manajemen admin penuh.
- **Mobile (`360px`–`430px` / subpath `/mobile/*`)**:
  - **Bottom Navigation Bar** (`z-50`) dengan 5 tab (*Beranda*, *Produk*, *Jasa*, *Toko*, *Keranjang*).
  - Otomatis disembunyikan pada halaman detail & checkout via `cleanPath` regex agar *Fixed Bottom CTA* tidak tertutup.
