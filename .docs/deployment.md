# Panduan & Strategi Deployment PAWON 🚀
**Pasar Warga Pondokrejo — Target Server, Konfigurasi Environment & Prosedur Rollback**

Dokumen ini menjelaskan tata cara deployment aplikasi **PAWON** dari lingkungan pengembangan lokal (Windows/Node.js) ke server produksi (Ubuntu VPS dengan CloudPanel & Nginx Reverse Proxy).

---

## 1. Deployment Targets

| Target | Tipe Lingkungan | Port Internal | Stack / Runtime | URL Akses |
|---|---|---|---|---|
| **Development** | Lokal (Windows / WSL) | `3333` | Node.js v20+, Turbopack (`npm run dev`) | `http://localhost:3333` atau `http://192.168.1.39:3333` (Testing HP via Wi-Fi LAN) |
| **Production** | Ubuntu 22.04 LTS (CloudPanel) | `3000` atau PM2 cluster | Node.js v20+, Nginx Reverse Proxy, SSL Let's Encrypt | `https://pawon.pondokrejo.id` |


---

## 2. Environment Mapping

| Variable Name | Development (`.env.local`) | Production (CloudPanel Env) | Keterangan & Tingkat Sensitivitas |
|---|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | `i5mr5ihx` | `i5mr5ihx` | Publik. ID Proyek Sanity Studio. |
| `NEXT_PUBLIC_SANITY_DATASET` | `production` | `production` | Publik. Nama dataset aktif Sanity. |
| `SANITY_API_WRITE_TOKEN` | `sk...` (Aktif & Terverifikasi) | `sk...` (Token Write Produksi) | 🔴 **Sangat Rahasia**. Digunakan Server Actions untuk menulis order, upload produk, dan status kurir. |

| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3333` | `https://pawon.pondokrejo.id` | Publik. Domain dasar pembentukan *Magic Link* WhatsApp. |
| `FONNTE_TOKEN` | `your_fonnte_token` | `your_fonnte_token` | 🔴 **Rahasia**. Token device WhatsApp Gateway (Fonnte) untuk broadcast notifikasi pesanan ke Admin, Penjual, Kurir, & Pembeli. |

| `NODE_ENV` | `development` | `production` | Sistem. Mengaktifkan optimasi build Turbopack & PWA Service Worker. |

---

## 3. Checklist Pra-Deployment (Pre-Deploy)

- [ ] Variabel lingkungan produksi (`SANITY_API_WRITE_TOKEN`, `NEXT_PUBLIC_BASE_URL`) telah diset di CloudPanel / PM2.
- [ ] Dependensi terpasang bersih tanpa konflik (`npm ci`).
- [ ] Build lokal berhasil dieksekusi tanpa error (`npm run build`).
- [ ] CORS origin pada dashboard Sanity (`sanity.io/manage`) telah mengizinkan domain `https://pawon.pondokrejo.id`.
- [ ] Sertifikat SSL Let's Encrypt aktif di Nginx CloudPanel.
- [ ] Service worker PWA dikonfigurasi aktif (`disable: false` pada environment production).

---

## 4. Langkah-Langkah Deployment (Ubuntu + CloudPanel)

1. **Pull Kode Terkini**:
   ```bash
   cd /home/pawon-user/htdocs/pawon.pondokrejo.id
   git pull origin main
   ```
2. **Instal Dependensi & Build Standalone**:
   ```bash
   npm install --frozen-lockfile
   npm run build
   ```
3. **Restart Service via PM2 / CloudPanel Node Manager**:
   ```bash
   pm2 restart pawon-app || pm2 start npm --name "pawon-app" -- start -- -p 3000
   ```
4. **Reload Nginx Reverse Proxy** (jika ada pembaruan konfigurasi header PWA).

---

## 5. Verifikasi Pasca-Deployment (Post-Deploy Verification)

1. **Smoke Test Beranda**: Akses `https://pawon.pondokrejo.id` dari browser desktop dan smartphone (pastikan deteksi mobile rewrite berfungsi).
2. **Endpoint Version Diagnostic**: Akses `https://pawon.pondokrejo.id/api/version` (pastikan HTTP 200 OK).
3. **Simulasi Checkout Belanja**: Buat 1 pesanan percobaan menggunakan nomor uji coba dan pastikan pesan WhatsApp serta record di Sanity Studio `/studio` terbentuk.
4. **PWA Installability**: Periksa apakah tombol/banner "Install PAWON" muncul di peramban Google Chrome Android.

---

## 6. Prosedur Rollback (Emergency Rollback Plan)

| Skenario Insiden | Prosedur Penanganan Cepat |
|---|---|
| **Build Gagal di Server** | Eksekusi `git reset --hard HEAD~1`, lalu jalankan `npm run build` kembali pada commit stabil sebelumnya. |
| **Pesan WhatsApp Gagal Terkirim** | Periksa token Fonnte / koneksi WA gateway di `.env`. Pesanan tetap tersimpan aman di Sanity sehingga kurir dapat dihubungi secara manual via `/admin`. |
| **Port Service Crash / Hang** | Jalankan `pm2 reload pawon-app --update-env` atau restart container Node.js di CloudPanel. |
| **Sanity Rate Limit / Credential Error** | Validasi token `SANITY_API_WRITE_TOKEN` di `sanity.io/manage` dan pastikan kuota API request bulanan mencukupi. |
