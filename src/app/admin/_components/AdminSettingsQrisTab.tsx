'use client'

import React, { useState, useMemo } from 'react'
import {
  Save,
  QrCode,
  CheckCircle,
  AlertTriangle,
  Upload,
  Loader2,
  Settings,
  RotateCcw,
  Clock,
} from 'lucide-react'
import { saveAppSettings } from '@/app/actions/admin'
import {
  parseQRIS,
  DEFAULT_PAWON_STATIC_QRIS,
} from '@/lib/qrisEngine'
import DynamicQrisCard from '@/components/DynamicQrisCard'

interface AdminSettingsQrisTabProps {
  initialSettings: {
    siteName: string
    adminPhone: string
    adminPin: string
    defaultShippingFee: number
    courierCommissionAmount?: number
    kalurahanFeeAmount?: number
    defaultCourierFloatCash?: number
    dailySettlementCutoffHour?: number
    maxSettlementDelayHours?: number
    isMaintenance: boolean
    isQrisEnabled: boolean
    qrisMerchantName: string
    qrisNmid: string
    qrisStaticPayload: string
    isSopAutoEnabled?: boolean
    sopPendingCancelHours?: number
    sopStuckWarningHours?: number
    sopDeliveredCompleteHours?: number
    sopProcessingCancelHours?: number
    sopCourierTimeoutMinutes?: number
    sopLastRunAt?: string | null
  }
  onRefresh: () => Promise<void>
}

export default function AdminSettingsQrisTab({
  initialSettings,
  onRefresh,
}: AdminSettingsQrisTabProps) {
  const [form, setForm] = useState({ ...initialSettings })
  const [isDirty, setIsDirty] = useState(false)
  const [previewNominal, setPreviewNominal] = useState(25000)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [decodeMsg, setDecodeMsg] = useState<string | null>(null)

  const updateForm = (updater: (prev: typeof form) => typeof form) => {
    setIsDirty(true)
    setForm(updater)
  }

  React.useEffect(() => {
    if (!isDirty) {
      setForm({ ...initialSettings })
    }
  }, [initialSettings, isDirty])

  const parsedQris = useMemo(
    () => parseQRIS(form.qrisStaticPayload),
    [form.qrisStaticPayload]
  )

  const handlePayloadChange = (raw: string) => {
    const check = parseQRIS(raw)
    updateForm((prev) => ({
      ...prev,
      qrisStaticPayload: raw,
      qrisMerchantName: check.isValid
        ? check.summary?.merchantName || prev.qrisMerchantName
        : prev.qrisMerchantName,
      qrisNmid: check.isValid
        ? check.summary?.nmid || prev.qrisNmid
        : prev.qrisNmid,
    }))
  }

  /**
   * Ekstrak otomatis string EMVCo dari file gambar QRIS Statis menggunakan BarcodeDetector API browser
   */
  const handleDecodeQrFromImage = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDecodeMsg(null)
    setErrorMsg(null)

    try {
      const DetectorClass = (window as any).BarcodeDetector
      if (!DetectorClass) {
        setErrorMsg(
          'Perangkat ini tidak mendukung baca gambar QR langsung. Silakan pindai gambar QR dengan kamera/scanner lalu tempel hasilnya di kolom kode.'
        )
        return
      }

      const bitmap = await createImageBitmap(file)
      const detector = new DetectorClass({ formats: ['qr_code'] })
      const results = await detector.detect(bitmap)

      if (!results || results.length === 0 || !results[0].rawValue) {
        setErrorMsg('Kode QR tidak terbaca pada gambar tersebut.')
        return
      }

      const rawValue = results[0].rawValue.trim()
      const parsed = parseQRIS(rawValue)
      if (!parsed.isValid) {
        setErrorMsg('Kode QR terdeteksi, namun bukan QRIS Bank atau E-Wallet yang sah.')
        return
      }

      handlePayloadChange(rawValue)
      setDecodeMsg(
        `Berhasil mengekstrak QRIS Resmi: ${parsed.summary?.merchantName} (NMID: ${parsed.summary?.nmid})`
      )
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Gagal membaca gambar QRIS. Silakan tempel string manual.'
      )
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    setSaveSuccess(false)

    const res = await saveAppSettings(form)
    setSaving(false)

    if (res.success) {
      setIsDirty(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      await onRefresh()
    } else {
      setErrorMsg(res.error || 'Gagal menyimpan pengaturan.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Global Config + QRIS Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Pengaturan Umum & Keamanan */}
          <div className="bg-[var(--vibe-surface)] p-6 rounded-2xl border border-[var(--vibe-border)] space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[var(--vibe-accent-1-lt)] text-[var(--vibe-accent-1)]">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                  Pengaturan Umum Aplikasi
                </h3>
                <p className="text-xs font-bold text-[var(--vibe-text-sub)]">
                  Identitas toko, nomor Admin pusat, dan biaya antar
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Nama Aplikasi
                </label>
                <input
                  required
                  type="text"
                  value={form.siteName}
                  onChange={(e) => updateForm((prev) => ({ ...prev, siteName: e.target.value }))}
                  className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Nomor WhatsApp Admin Pusat
                </label>
                <input
                  required
                  type="text"
                  value={form.adminPhone}
                  onChange={(e) =>
                    updateForm((prev) => ({ ...prev, adminPhone: e.target.value }))
                  }
                  className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Biaya Ongkir Flat Kalurahan (Rp)
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  value={form.defaultShippingFee}
                  onChange={(e) =>
                    updateForm((prev) => ({
                      ...prev,
                      defaultShippingFee: Number(e.target.value),
                    }))
                  }
                  className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  PIN Login Dasbor Admin (/admin)
                </label>
                <input
                  required
                  type="text"
                  value={form.adminPin}
                  onChange={(e) => updateForm((prev) => ({ ...prev, adminPin: e.target.value }))}
                  className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Upah Kurir per Pesanan (Rp)
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  value={form.courierCommissionAmount ?? 4000}
                  onChange={(e) =>
                    updateForm((prev) => ({
                      ...prev,
                      courierCommissionAmount: Number(e.target.value),
                    }))
                  }
                  className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Kas Kalurahan per Pesanan (Rp)
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  value={form.kalurahanFeeAmount ?? 2000}
                  onChange={(e) =>
                    updateForm((prev) => ({
                      ...prev,
                      kalurahanFeeAmount: Number(e.target.value),
                    }))
                  }
                  className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Kas Awal Harian Kurir (Rp)
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  step={10000}
                  value={form.defaultCourierFloatCash ?? 100000}
                  onChange={(e) =>
                    updateForm((prev) => ({
                      ...prev,
                      defaultCourierFloatCash: Number(e.target.value),
                    }))
                  }
                  className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--vibe-text-sub)] mb-1">
                    Jam Reset (WIB)
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    max={23}
                    value={form.dailySettlementCutoffHour ?? 16}
                    onChange={(e) =>
                      updateForm((prev) => ({
                        ...prev,
                        dailySettlementCutoffHour: Number(e.target.value),
                      }))
                    }
                    className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--vibe-text-sub)] mb-1">
                    Maks. Tunda (Jam)
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={168}
                    value={form.maxSettlementDelayHours ?? 48}
                    onChange={(e) =>
                      updateForm((prev) => ({
                        ...prev,
                        maxSettlementDelayHours: Number(e.target.value),
                      }))
                    }
                    className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                  />
                </div>
              </div>
            </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[var(--vibe-border)]">
                <label className="inline-flex items-center gap-2.5 text-xs font-black text-[var(--vibe-text-main)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isMaintenance}
                    onChange={(e) =>
                      updateForm((prev) => ({ ...prev, isMaintenance: e.target.checked }))
                    }
                  />
                  <span>Aktifkan Mode Pemeliharaan (Tutup Sementara Belanja)</span>
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black hover:opacity-95 transition-opacity inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saveSuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Tersimpan</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Konfigurasi Global</span>
                    </>
                  )}
                </button>
              </div>
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Card 2: Konfigurasi Dynamic QRIS */}
            <div className="bg-[var(--vibe-surface)] p-6 rounded-2xl border border-[var(--vibe-border)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[var(--vibe-accent-1-lt)] text-[var(--vibe-accent-1)]">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                      Pembayaran QRIS
                    </h3>
                    <p className="text-xs font-bold text-[var(--vibe-text-sub)]">
                      Nominal QRIS otomatis mengikuti total tagihan pembeli
                    </p>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isQrisEnabled}
                    onChange={(e) =>
                      updateForm((prev) => ({ ...prev, isQrisEnabled: e.target.checked }))
                    }
                  />
                  <span>{form.isQrisEnabled ? 'QRIS Aktif' : 'QRIS Nonaktif'}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                    Nama Merchant QRIS (Maks. 25 Karakter)
                  </label>
                  <input
                    type="text"
                    maxLength={25}
                    value={form.qrisMerchantName}
                    onChange={(e) =>
                      updateForm((prev) => ({ ...prev, qrisMerchantName: e.target.value }))
                    }
                    className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                    NMID (National Merchant ID)
                  </label>
                  <input
                    type="text"
                    style={{ fontFamily: 'var(--vibe-font-mono)' }}
                    value={form.qrisNmid}
                    onChange={(e) => updateForm((prev) => ({ ...prev, qrisNmid: e.target.value }))}
                    className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-bold text-[var(--vibe-text-sub)]">
                    Kode QRIS Statis Toko
                  </label>

                  <div className="flex items-center gap-2">
                    <label className="px-2.5 py-1 rounded-lg bg-[var(--vibe-accent-1-lt)] text-[var(--vibe-accent-1)] text-xs font-black cursor-pointer inline-flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Ekstrak dari Gambar QR</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleDecodeQrFromImage}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => handlePayloadChange(DEFAULT_PAWON_STATIC_QRIS)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)] text-xs font-bold inline-flex items-center gap-1 hover:text-[var(--vibe-text-main)]"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Pakai Contoh Default</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  style={{ fontFamily: 'var(--vibe-font-mono)' }}
                  placeholder="000201010211..."
                  value={form.qrisStaticPayload}
                  onChange={(e) => handlePayloadChange(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold"
                />

                {/* Live Validation Banner */}
                <div
                  className={`mt-2 p-3 rounded-xl border text-xs font-black flex items-center gap-2 ${parsedQris.isValid
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-600'
                    }`}
                >
                  {parsedQris.isValid ? (
                    <>
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        QRIS Valid • Merchant: {parsedQris.summary?.merchantName} • Kota:{' '}
                        {parsedQris.summary?.merchantCity}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Kode QRIS belum valid. Pastikan seluruh teks kode QRIS tersalin utuh.
                      </span>
                    </>
                  )}
                </div>
              </div>

              {decodeMsg && (
                <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold">
                  {decodeMsg}
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={saving || !parsedQris.isValid}
                className="w-full py-4 rounded-xl bg-[var(--vibe-accent-1)] text-white text-sm font-black hover:opacity-95 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : saveSuccess ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Pengaturan Berhasil Disimpan</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Simpan Pengaturan</span>
                  </>
                )}
              </button>
            </div>

            {/* Card 3: Aturan SOP Otomatis (Production Worker) */}
            <div className="bg-[var(--vibe-surface)] p-6 rounded-2xl border border-[var(--vibe-border)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[var(--vibe-accent-2-lt)] text-amber-700">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                      Aturan Batas Waktu Pesanan
                    </h3>
                    <p className="text-xs font-bold text-[var(--vibe-text-sub)]">
                      Penutupan otomatis pesanan kedaluwarsa &amp; pengalihan antrean kurir
                    </p>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isSopAutoEnabled !== false}
                    onChange={(e) =>
                      updateForm((prev) => ({
                        ...prev,
                        isSopAutoEnabled: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    {form.isSopAutoEnabled !== false ? 'Aktif' : 'Nonaktif'}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--vibe-text-sub)] mb-1">
                    Respons Kurir (Menit)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={form.sopCourierTimeoutMinutes ?? 5}
                    onChange={(e) =>
                      updateForm((prev) => ({
                        ...prev,
                        sopCourierTimeoutMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--vibe-text-sub)] mb-1">
                    Batal Pending (Jam)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.sopPendingCancelHours ?? 24}
                    onChange={(e) =>
                      updateForm((prev) => ({
                        ...prev,
                        sopPendingCancelHours: Number(e.target.value),
                      }))
                    }
                    className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--vibe-text-sub)] mb-1">
                    Peringatan Macet (Jam)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.sopStuckWarningHours ?? 4}
                    onChange={(e) =>
                      updateForm((prev) => ({
                        ...prev,
                        sopStuckWarningHours: Number(e.target.value),
                      }))
                    }
                    className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--vibe-text-sub)] mb-1">
                    Selesai Delivered (Jam)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.sopDeliveredCompleteHours ?? 24}
                    onChange={(e) =>
                      updateForm((prev) => ({
                        ...prev,
                        sopDeliveredCompleteHours: Number(e.target.value),
                      }))
                    }
                    className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--vibe-text-sub)] mb-1">
                    Tutup Macet (Jam)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.sopProcessingCancelHours ?? 48}
                    onChange={(e) =>
                      updateForm((prev) => ({
                        ...prev,
                        sopProcessingCancelHours: Number(e.target.value),
                      }))
                    }
                    className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--vibe-border)] text-xs">
                <span className="font-bold text-[var(--vibe-text-sub)]">
                  Pengecekan otomatis terakhir:{' '}
                  <strong className="text-[var(--vibe-text-main)]">
                    {form.sopLastRunAt
                      ? new Date(form.sopLastRunAt).toLocaleString('id-ID')
                      : 'Belum pernah berjalan'}
                  </strong>
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black"
                >
                  Simpan Aturan
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: QRIS Scan Tester */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[var(--vibe-surface)] p-6 rounded-2xl border border-[var(--vibe-border)] space-y-4">
              <div>
                <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                  Uji Coba Scan QRIS
                </h3>
                <p className="text-xs font-bold text-[var(--vibe-text-sub)]">
                  Pindai dengan aplikasi pembayaran memakai contoh nominal
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Nominal Simulasi Tagihan (Rp)
                </label>
                <input
                  type="number"
                  min={500}
                  step={500}
                  value={previewNominal}
                  onChange={(e) =>
                    setPreviewNominal(Math.max(500, Number(e.target.value) || 500))
                  }
                  className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-black"
                />
              </div>

              <DynamicQrisCard
                amount={previewNominal}
                merchantName={form.qrisMerchantName}
                nmid={form.qrisNmid}
                staticPayload={
                  parsedQris.isValid
                    ? form.qrisStaticPayload
                    : DEFAULT_PAWON_STATIC_QRIS
                }
              />
            </div>
          </div>
        </div>
    </form>
  )
}
