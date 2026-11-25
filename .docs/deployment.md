# Panduan & Strategi Deployment PAWON 🚀
**Pasar Warga Pondokrejo — Target Server, Konfigurasi Environment, Worker SOP & Prosedur Rollback**

Dokumen ini menjelaskan tata cara deployment aplikasi **PAWON** dari lingkungan pengembangan lokal (Windows/Node.js) ke server produksi (Ubuntu VPS dengan CloudPanel & Nginx Reverse Proxy).

---

## 1. Deployment Targets

| Target | Tipe Lingkungan | Port Internal | Stack / Runtime | URL Akses |
|---|---|---|---|---|
| **Development** | Lokal (Windows / WSL) | `3333` | Node.js v20+, Turbopack (`npx next dev -p 3333`) | `http://localhost:3333` atau `http://192.168.1.39:3333` (Testing HP via Wi-Fi LAN) |
| **Production** | Ubuntu 22.04 LTS (CloudPanel) | `3000` (atau port PM2 aktif) | Node.js v20+, Next.js Standalone/Start, Nginx Reverse Proxy, SSL Let's Encrypt | `https://pawon.pondokrejo.id` |

---

## 2. Environment Mapping

| Variable Name | Development (`.env.local`) | Production (CloudPanel Env) | Keterangan & Tingkat Sensitivitas |
|---|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | `i5mr5ihx` | `i5mr5ihx` | Publik. ID Proyek Sanity Studio. |
| `NEXT_PUBLIC_SANITY_DATASET` | `production` | `production` | Publik. Nama dataset aktif Sanity. |
| `SANITY_API_WRITE_TOKEN` | `<SANITY_WRITE_TOKEN>` | `<SANITY_WRITE_TOKEN>` | 🔴 **Sangat Rahasia**. Digunakan Server Actions & SOP Worker untuk menulis order, upload aset, dan mutasi status. |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3333` | `https://pawon.pondokrejo.id` | Publik. Domain dasar pembentukan tautan WA & Magic Link. |
| `FONNTE_TOKEN` | `<FONNTE_TOKEN>` | `<FONNTE_TOKEN>` | 🔴 **Rahasia**. Token device WhatsApp Gateway (Fonnte) untuk notifikasi multi-pihak. |
| `CRON_SECRET` | *(Opsional di Dev)* | `<RANDOM_STRONG_SECRET>` | 🟡 **Rahasia Operasional**. Mengamankan endpoint `GET /api/cron/order-sop`. |
| `ENABLE_ORDER_SOP_WORKER` | `false` *(Default nonaktif)* | Tidak perlu diset *(Otomatis aktif bila `NODE_ENV=production`)* | Mengontrol `src/instrumentation.ts`. Mencegah PC dev lokal mengeksekusi penutupan order produksi secara tidak sengaja. |
| `NODE_ENV` | `development` | `production` | Mengaktifkan optimasi build, PWA Service Worker, dan background SOP worker (`instrumentation.ts`). |

---

## 3. Operasional Worker SOP Pesanan di Production

Aplikasi dilengkapi proteksi otomatis berbasis `NODE_ENV` pada `src/instrumentation.ts`:
- **Di Local Development (`NODE_ENV=development`)**: Background interval worker **NONAKTIF secara default**. Jika ingin menguji mekanisme SOP di lokal, gunakan tombol **"Cek SOP"** (*Dry-Run*) di `/admin` tab Pesanan atau jalankan `GET /api/cron/order-sop?dryRun=true`.
- **Di Production (`NODE_ENV=production`)**:
  1. **Internal Instrumentation Worker (Default Active)**: Begitu `next start` berjalan di PM2/CloudPanel, `src/instrumentation.ts` menyala otomatis (pengecekan batas waktu pesan **10 menit**, serta pengecekan cepat **auto-skip antrean kurir setiap 1 menit**).
  2. **External Crontab Backup (Opsional / Disarankan jika container idle)**:
     ```cron
     # Setiap 15 menit via crontab server Ubuntu
     */15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://pawon.pondokrejo.id/api/cron/order-sop > /dev/null
     ```

---

## 4. Checklist Pra-Deployment (Pre-Deploy)

- [ ] Variabel lingkungan produksi (`SANITY_API_WRITE_TOKEN`, `FONNTE_TOKEN`, `NEXT_PUBLIC_BASE_URL`, `CRON_SECRET`) terpasang di server.
- [ ] `npx tsc --noEmit` dan `npx vitest run` lulus bersih sebelum push.
- [ ] Pemindaian rahasia bersih (`.env*` & folder `temp/` tidak membawa token ke repo publik).
- [ ] CORS origin pada Sanity Manage mengizinkan `https://pawon.pondokrejo.id`.
- [ ] Pada `/admin` tab **Pengaturan & QRIS**, pastikan string **QRIS Statis resmi** Kalurahan/UMKM telah diisi (atau matikan toggle QRIS jika masih tahap pengurusan).
- [ ] Sertifikat SSL Let's Encrypt aktif di Nginx CloudPanel.

---

## 5. Langkah-Langkah Deployment (Ubuntu + CloudPanel)

1. **Pull Kode Terkini**:
   ```bash
   cd /home/pawon-user/htdocs/pawon.pondokrejo.id
   git pull origin main
   ```
2. **Instal Dependensi & Build**:
   ```bash
   npm ci
   npm run build
   ```
3. **Restart Service via PM2 / CloudPanel Node Manager**:
   ```bash
   pm2 restart pawon-app || pm2 start npm --name "pawon-app" -- start -- -p 3000
   ```
4. **Verifikasi Log Startup Worker**:
   Pastikan tidak ada error koneksi Sanity pada log startup `pm2 logs pawon-app --lines 50`.

---

## 6. Verifikasi Pasca-Deployment (Post-Deploy Verification)

1. **Smoke Test Beranda**: Akses `https://pawon.pondokrejo.id` dari browser desktop & smartphone (pastikan rewrite `/mobile/*` aktif).
2. **Endpoint Version Diagnostic**: Akses `https://pawon.pondokrejo.id/api/version` (HTTP 200 OK).
3. **Smoke Test SOP Endpoint**: Panggil `GET /api/cron/order-sop?dryRun=true` dengan header `Authorization: Bearer <CRON_SECRET>` dan pastikan merespons `ok: true`.
4. **Pusat Kendali Admin**: Login ke `https://pawon.pondokrejo.id/admin` untuk mengecek dashboard pesanan 6-tab & pengaturan QRIS.

---

## 7. Prosedur Rollback (Emergency Rollback Plan)

| Skenario Insiden | Prosedur Penanganan Cepat |
|---|---|
| **Build Gagal di Server** | Eksekusi `git reset --hard HEAD~1`, jalankan `npm run build` kembali pada commit stabil sebelumnya. |
| **Worker SOP Terlalu Agresif** | Nonaktifkan saklar **SOP Otomatis** di `/admin` → tab **Pengaturan & QRIS** (tersimpan seketika di `appSettings.isSopAutoEnabled = false`, tanpa perlu restart server). |
| **Pesan WhatsApp Gagal Terkirim** | Periksa `FONNTE_TOKEN` & status koneksi device Fonnte. Transaksi tetap tersimpan di Sanity sehingga koordinasi tetap dapat dilakukan lewat tautan WA 3-arah di `/admin`. |
| **Port Service Crash / Hang** | Jalankan `pm2 reload pawon-app --update-env` atau restart service di CloudPanel. |
