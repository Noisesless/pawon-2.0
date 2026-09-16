# PAWON (Pasar Warga Pondokrejo) 🍲⚡

**PAWON** adalah inisiatif marketplace digital resmi milik **Kalurahan Pondokrejo** yang dirancang untuk memperkuat ekonomi lokal. Nama PAWON sendiri merupakan akronim dari **Pasar Warga Pondokrejo**, sekaligus melambangkan kehangatan dapur (pawon) yang menjadi pusat kehidupan warga.

Aplikasi ini menghubungkan produk UMKM, hasil bumi, dan layanan jasa profesional warga langsung ke tangan pembeli dengan sistem yang modern, terverifikasi, dan ramah pengguna.

## 🚀 Fitur Utama

### 🛒 Marketplace Produk (UMKM)
*   **Katalog Terverifikasi**: Semua produk telah diverifikasi oleh Admin Kalurahan untuk menjamin keaslian dan kualitas.
*   **Seksi Promo & Terlaris**: Menampilkan produk unggulan dan penawaran spesial untuk warga.
*   **Kategori Pilihan**: Pencarian produk berdasarkan kategori (Makanan, Kerajinan, Pertanian, dll) dengan tampilan elegan.

### 🛠️ Layanan Jasa (Services)
*   **Tenaga Ahli Lokal**: Temukan jasa instalasi listrik, internet, pijat bayi, hingga perbaikan elektronik langsung dari warga berkopetensi.
*   **Booking Mudah**: Terhubung langsung ke WhatsApp penyedia jasa untuk konsultasi dan pemesanan.

### 📱 Pengalaman Mobile Native (PWA)
*   **Optimasi Mobile**: Tampilan khusus mobile dengan navigasi bawah (*Bottom Nav*) layaknya aplikasi Android/iOS native.
*   **PWA Ready**: Dapat diinstal langsung di layar utama HP tanpa melalui Play Store.
*   **Deteksi Otomatis**: Sistem secara cerdas menyajikan layout terbaik berdasarkan perangkat yang digunakan.

### 📰 Kabar Kalurahan (Info)
*   **Pusat Informasi**: Update resmi mengenai pelatihan UMKM, bantuan modal BUMKal, dan panduan resmi kalurahan.
*   **Dukungan Pemerintah**: Pengumuman kegiatan yang bertujuan meningkatkan kapasitas pelaku usaha kalurahan.

### 🚚 Logistik & Tracking
*   **Kurir Kalurahan**: Pengiriman barang ditangani oleh tenaga kurir resmi kalurahan.
*   **Lacak Pesanan**: Fitur real-time untuk memantau status pengiriman paket.

## 🛠️ Tech Stack

*   **Framework**: [Next.js 16](https://nextjs.org/) (App Router + Turbopack)
*   **CMS**: [Sanity.io v5](https://www.sanity.io/) (Headless CMS for Content & Products)
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Rich Text**: [Portable Text](https://github.com/portabletext/react)
*   **PWA**: [@ducanh2912/next-pwa](https://www.npmjs.com/package/@ducanh2912/next-pwa)
*   **Deployment**: Ubuntu with CloudPanel (Nginx Reverse Proxy)

## 📚 Dokumentasi Lengkap (Single Source of Truth)

Seluruh arsitektur, panduan teknis, dan spesifikasi sistem terpusat pada direktori `/.docs/`:
1. [Arsitektur Sistem](.docs/architecture.md) — Aliran data makro 3-tier, hybrid mobile detection, dan ekosistem notifikasi WA.
2. [Spesifikasi API & Server Actions](.docs/api-spec.md) — Daftar REST endpoints & 12 Server Actions.
3. [Skema Database & Sanity Model](.docs/database.md) — ERD dokumen, skema field, dan GROQ queries.
4. [Peta Rute & Middleware](.docs/routes.md) — Daftar seluruh rute desktop, subpath mobile, dan middleware.
5. [Tinjauan Kualitas Kode](.docs/quality_review.md) — Metrik kompleksitas, sanitasi tipe TypeScript, dan deprecation Next.js 16.
6. [Graf Dependensi](.docs/dependency-graph.md) — Peta keterkaitan modul kritis dan analisis dampak perubahan.
7. [Panduan Deployment](.docs/deployment.md) — Konfigurasi server CloudPanel, environment mapping, dan rollback plan.
8. [Pelacak Isu Teknis](.docs/issues.md) — Pelacakan bug aktif dan isu terselesaikan.
9. [Sistem Desain Visual](.docs/design-system.md) — Visual DNA, token warna CSS, tipografi, dan ritme tata letak.

## 📦 Instalasi Lokal

1.  **Clone Repository**:
    ```bash
    git clone https://github.com/diskonnekted/pawon-pondokrejo.git
    cd pawon-pondokrejo
    ```

2.  **Instal Dependensi**:
    ```bash
    npm install
    ```

3.  **Konfigurasi Environment**:
    Buat file `.env.local` dan isi dengan kredensial Sanity serta WhatsApp Fonnte Anda:
    ```env
    NEXT_PUBLIC_SANITY_PROJECT_ID="i5mr5ihx"
    NEXT_PUBLIC_SANITY_DATASET="production"
    SANITY_API_WRITE_TOKEN="your_write_token"
    NEXT_PUBLIC_BASE_URL="http://localhost:3333"
    FONNTE_TOKEN="your_fonnte_token"
    ```

4.  **Jalankan Mode Pengembangan**:
    ```bash
    npm run dev -- -p 3333
    ```
    - Akses desktop: `http://localhost:3333`
    - Akses pengujian HP (Wi-Fi lokal yang sama): `http://192.168.1.39:3333`


## 🌐 Panduan Deployment (CloudPanel)

Jika Anda menggunakan **Ubuntu** dengan **CloudPanel**:

1.  **Buat Reverse Proxy Site** di CloudPanel yang diarahkan ke port internal (misal: `http://127.0.0.1:8080`).
2.  **Build Aplikasi** di server:
    ```bash
    npm run build
    ```
3.  **Jalankan menggunakan PM2**:
    ```bash
    PORT=8080 pm2 start npm --name "pawon-app" -- start
    ```
4.  **Aktifkan SSL** melalui menu SSL di CloudPanel menggunakan Let's Encrypt.

## 🤝 Kontribusi

Aplikasi ini dikembangkan untuk kemajuan warga Kalurahan Pondokrejo. Saran dan masukan sangat kami harapkan untuk pengembangan fitur ke depannya.

---
**PAWON** - *Membangun Kalurahan dari Tetangga.*
© 2026 Pemerintah Kalurahan Pondokrejo.

