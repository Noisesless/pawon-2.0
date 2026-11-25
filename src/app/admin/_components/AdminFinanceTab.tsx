'use client'

import React, { useMemo, useState } from 'react'
import {
  Wallet,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Truck,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Printer,
} from 'lucide-react'
import {
  resolveFinanceConfig,
  computeCourierLedgerSummary,
  assignOrderSettlementPeriodKey,
} from '@/lib/courierFinanceEngine'
import {
  syncCourierSettlementsAction,
  confirmCourierSettlementAction,
} from '@/app/actions/admin'

interface AdminFinanceTabProps {
  orders: any[]
  couriers: any[]
  settlements: any[]
  appSettings: any
  onRefresh: () => Promise<void>
}

function formatRp(n: number): string {
  return `Rp${Math.round(Math.abs(n)).toLocaleString('id-ID')}`
}

export default function AdminFinanceTab({
  orders,
  couriers,
  settlements,
  appSettings,
  onRefresh,
}: AdminFinanceTabProps) {
  const [syncing, setSyncing] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showSettledHistory, setShowSettledHistory] = useState(false)

  const finConfig = useMemo(() => resolveFinanceConfig(appSettings), [appSettings])

  const openSettlements = useMemo(
    () =>
      (settlements || []).filter(
        (s: any) => s && s.status !== 'settled'
      ),
    [settlements]
  )

  const settledHistory = useMemo(
    () =>
      (settlements || []).filter(
        (s: any) => s && s.status === 'settled'
      ),
    [settlements]
  )

  // Hitung transaksi berjalan hari ini / sebelum cutoff 16:00 yang belum dibukukan
  const liveCourierLedgers = useMemo(() => {
    const activeOrdersByCourier = new Map<string, { completed: any[]; inFlightCount: number }>()
    for (const ord of orders || []) {
      if (!ord || ord.orderCategory === 'service' || !ord.courier?._id) continue
      const cid = String(ord.courier._id).replace(/^drafts\./, '')
      if (!activeOrdersByCourier.has(cid)) {
        activeOrdersByCourier.set(cid, { completed: [], inFlightCount: 0 })
      }
      const bucket = activeOrdersByCourier.get(cid)!
      if (ord.status === 'completed' && !ord.settlementId) {
        bucket.completed.push(ord)
      } else if (
        ['processing', 'accepted', 'shipped', 'delivering', 'delivered'].includes(
          ord.status
        )
      ) {
        bucket.inFlightCount++
      }
    }

    return (couriers || []).map((c: any) => {
      const cid = String(c._id).replace(/^drafts\./, '')
      const openingFloat =
        typeof c.customFloatCash === 'number'
          ? Math.max(0, c.customFloatCash)
          : finConfig.defaultCourierFloatCash
      const bucket = activeOrdersByCourier.get(cid) || { completed: [], inFlightCount: 0 }
      const summary = computeCourierLedgerSummary(bucket.completed, openingFloat, finConfig)
      const latestCompleted = bucket.completed[0]
      const currentPeriodKey = latestCompleted
        ? assignOrderSettlementPeriodKey(
            latestCompleted.completedAt || latestCompleted._updatedAt || latestCompleted._createdAt,
            finConfig.dailySettlementCutoffHour
          )
        : assignOrderSettlementPeriodKey(
            new Date().toISOString(),
            finConfig.dailySettlementCutoffHour
          )

      return {
        courier: c,
        courierId: cid,
        periodKey: currentPeriodKey,
        inFlightCount: bucket.inFlightCount,
        summary,
      }
    })
  }, [couriers, orders, finConfig])

  const kpiTotals = useMemo(() => {
    let totalCommission = 0
    let totalKalurahan = 0
    let totalTalangan = 0
    let totalUnsettledCount = 0

    for (const row of liveCourierLedgers) {
      totalCommission += row.summary.courierCommissionTotal
      totalKalurahan += row.summary.kalurahanFeeTotal
      totalTalangan += row.summary.kurirOutOfPocket
      totalUnsettledCount += row.summary.orderCount
    }
    for (const st of openSettlements) {
      totalCommission += Number(st.courierCommissionTotal || 0)
      totalKalurahan += Number(st.kalurahanFeeTotal || 0)
      totalTalangan += Number(st.kurirOutOfPocket || 0)
      totalUnsettledCount += Number(st.orderCount || 0)
    }

    return {
      totalCommission,
      totalKalurahan,
      totalTalangan,
      totalUnsettledCount,
      blockedCount: openSettlements.filter((s: any) => s.status === 'blocked_overdue')
        .length,
    }
  }, [liveCourierLedgers, openSettlements])

  const handleManualSync = async () => {
    setSyncing(true)
    setFeedback(null)
    const res = await syncCourierSettlementsAction()
    setSyncing(false)
    if (res.success && res.data) {
      setFeedback(
        `Sinkronisasi selesai: ${res.data.createdCount} rekap baru dibuat, ${res.data.warnedCount} pengingat >24 jam, ${res.data.blockedCount} dibekukan >48 jam.`
      )
      await onRefresh()
    } else {
      setFeedback(res.error || 'Gagal menyinkronkan laporan kas.')
    }
  }

  const handleConfirmSettlement = async (params: {
    settlementId?: string
    courierId: string
    courierName: string
    periodKey?: string
    mode: 'continue_float' | 'full_return'
    amount: number
  }) => {
    const actionDesc =
      params.mode === 'continue_float'
        ? params.amount >= 0
          ? `Terima setoran ${formatRp(params.amount)} dari ${params.courierName} (Lanjut Kas Besok)`
          : `Bayarkan refill/talangan ${formatRp(params.amount)} ke ${params.courierName} (Lanjut Kas Besok)`
        : params.amount >= 0
          ? `Terima setoran penuh ${formatRp(params.amount)} dari ${params.courierName} (Tutup Kas)`
          : `Ganti talangan penuh ${formatRp(params.amount)} ke ${params.courierName} (Tutup Kas)`

    if (!confirm(`Konfirmasi: ${actionDesc}?`)) return

    const key = `${params.settlementId || params.courierId}-${params.mode}`
    setBusyKey(key)
    setFeedback(null)
    const res = await confirmCourierSettlementAction({
      settlementId: params.settlementId,
      courierId: params.courierId,
      periodKey: params.periodKey,
      mode: params.mode,
    })
    setBusyKey(null)

    if (res.success) {
      setFeedback(`Setoran kas ${params.courierName} berhasil dikonfirmasi lunas.`)
      await onRefresh()
    } else {
      alert(res.error || 'Gagal mengonfirmasi setoran kas.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Control Bar */}
      <div className="bg-[var(--vibe-surface)] p-5 rounded-2xl border border-[var(--vibe-border)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-[var(--vibe-text-main)]">
            Keuangan Kas Kurir &amp; Setoran Kalurahan
          </h2>
          <p className="text-xs font-bold text-[var(--vibe-text-sub)] mt-0.5">
            Tarif ongkir {formatRp(finConfig.defaultShippingFee)} (Kurir{' '}
            {formatRp(finConfig.courierCommissionAmount)} + Kalurahan{' '}
            {formatRp(finConfig.kalurahanFeeAmount)}) | Kas Awal{' '}
            {formatRp(finConfig.defaultCourierFloatCash)} | Tutup buku harian pukul{' '}
            {String(finConfig.dailySettlementCutoffHour).padStart(2, '0')}:00 WIB (maks. tunda{' '}
            {finConfig.maxSettlementDelayHours} jam)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-main)] text-xs font-black inline-flex items-center gap-2 hover:opacity-85 transition-opacity"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekap</span>
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={handleManualSync}
            className="px-4 py-2.5 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black inline-flex items-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>Cek Tutup Buku 16.00</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-[var(--vibe-accent-1-lt)] border border-green-200 text-green-800 text-xs font-bold">
          {feedback}
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--vibe-surface)] p-5 rounded-2xl border border-[var(--vibe-border)]">
          <p className="text-[11px] font-black text-[var(--vibe-text-sub)] uppercase tracking-wider">
            Order Belum Tutup Setoran
          </p>
          <p className="text-2xl font-black text-[var(--vibe-text-main)] mt-1">
            {kpiTotals.totalUnsettledCount} Pesanan
          </p>
        </div>

        <div className="bg-[var(--vibe-surface)] p-5 rounded-2xl border border-[var(--vibe-border)]">
          <p className="text-[11px] font-black text-[var(--vibe-text-sub)] uppercase tracking-wider">
            Hak Upah Kurir Berjalan
          </p>
          <p className="text-2xl font-black text-[var(--vibe-accent-1)] mt-1">
            {formatRp(kpiTotals.totalCommission)}
          </p>
        </div>

        <div className="bg-[var(--vibe-surface)] p-5 rounded-2xl border border-[var(--vibe-border)]">
          <p className="text-[11px] font-black text-[var(--vibe-text-sub)] uppercase tracking-wider">
            Porsi Kas Kalurahan Berjalan
          </p>
          <p className="text-2xl font-black text-blue-700 mt-1">
            {formatRp(kpiTotals.totalKalurahan)}
          </p>
        </div>

        <div
          className={`p-5 rounded-2xl border ${
            kpiTotals.blockedCount > 0 || kpiTotals.totalTalangan > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-[var(--vibe-surface)] border-[var(--vibe-border)]'
          }`}
        >
          <p className="text-[11px] font-black text-[var(--vibe-text-sub)] uppercase tracking-wider">
            Talangan / Blokir &gt;48 Jam
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {kpiTotals.blockedCount > 0
              ? `${kpiTotals.blockedCount} Kurir Dibekukan`
              : kpiTotals.totalTalangan > 0
                ? formatRp(kpiTotals.totalTalangan)
                : 'Semua Tertib'}
          </p>
        </div>
      </div>

      {/* SECTION 1: Laporan Jatuh Tempo (Sudah Melewati Cutoff 16.00 WIB & Belum Lunas) */}
      <div className="bg-[var(--vibe-surface)] p-6 rounded-2xl border border-[var(--vibe-border)] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--vibe-accent-2-lt)] text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                Tagihan / Refill Tutup Buku 16.00 WIB ({openSettlements.length})
              </h3>
              <p className="text-xs font-bold text-[var(--vibe-text-sub)]">
                Laporan yang sudah melewati jam batas harian dan menunggu penyelesaian dengan Admin
              </p>
            </div>
          </div>
        </div>

        {openSettlements.length === 0 ? (
          <div className="p-6 rounded-xl bg-[var(--vibe-surface-sub)] text-center text-xs font-bold text-[var(--vibe-text-sub)]">
            Tidak ada tunggakan setoran tutup buku dari periode sebelumnya.
          </div>
        ) : (
          <div className="space-y-3">
            {openSettlements.map((st: any) => {
              const isBlocked = st.status === 'blocked_overdue'
              const isWarned = st.status === 'overdue_warning'
              const netNext = Number(st.netContinueNextDay || 0)
              const netClose = Number(st.netFullClose || 0)
              return (
                <div
                  key={st._id}
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isBlocked
                      ? 'bg-red-50/70 border-red-300'
                      : isWarned
                        ? 'bg-amber-50/70 border-amber-300'
                        : 'bg-[var(--vibe-surface-sub)] border-[var(--vibe-border)]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-black text-[var(--vibe-text-main)]">
                          {st.courierName}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-white border border-[var(--vibe-border)] text-[11px] font-black">
                          Periode {st.periodKey}
                        </span>
                        {isBlocked ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-black inline-flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Dibekukan (&gt;48 Jam)</span>
                          </span>
                        ) : isWarned ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-black inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Terlambat (&gt;24 Jam)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-black">
                            Menunggu Penyelesaian
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-[var(--vibe-text-sub)] mt-1">
                        {st.orderCount} pesanan selesai | Batas akhir:{' '}
                        {st.dueAt
                          ? new Date(st.dueAt).toLocaleString('id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '-'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] font-black uppercase tracking-wider text-[var(--vibe-text-sub)]">
                        {netNext >= 0 ? 'Kurir Setor (Lanjut Kas)' : 'Admin Refill ke Kurir'}
                      </p>
                      <p
                        className={`text-xl font-black inline-flex items-center gap-1 ${
                          netNext >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {netNext >= 0 ? (
                          <ArrowDownRight className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                        <span>{formatRp(netNext)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white p-3.5 rounded-xl border border-[var(--vibe-border)] text-xs">
                    <div>
                      <p className="text-[10px] font-bold text-[var(--vibe-text-sub)]">Kas Awal</p>
                      <p className="font-black text-[var(--vibe-text-main)]">
                        {formatRp(st.openingFloatCash || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[var(--vibe-text-sub)]">
                        Bayar Penjual
                      </p>
                      <p className="font-black text-rose-600">
                        -{formatRp(st.sellerCashPaid || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[var(--vibe-text-sub)]">
                        Masuk COD / QRIS
                      </p>
                      <p className="font-black text-[var(--vibe-text-main)]">
                        +{formatRp(st.codOrderTotal || 0)} / {formatRp(st.qrisOrderTotal || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[var(--vibe-text-sub)]">
                        Upah Kurir
                      </p>
                      <p className="font-black text-[var(--vibe-accent-1)]">
                        {formatRp(st.courierCommissionTotal || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[var(--vibe-text-sub)]">
                        Kas Kalurahan
                      </p>
                      <p className="font-black text-blue-700">
                        {formatRp(st.kalurahanFeeTotal || 0)}
                      </p>
                    </div>
                  </div>

                  {Number(st.kurirOutOfPocket || 0) > 0 && (
                    <div className="px-3.5 py-2 rounded-xl bg-amber-100 text-amber-900 text-xs font-bold">
                      Dana Talangan Pribadi Kurir Tercatat: {formatRp(st.kurirOutOfPocket)} (otomatis
                      diperhitungkan pada nominal refill di atas).
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() =>
                        handleConfirmSettlement({
                          settlementId: st._id,
                          courierId: st.courierId,
                          courierName: st.courierName,
                          periodKey: st.periodKey,
                          mode: 'full_return',
                          amount: netClose,
                        })
                      }
                      className="px-4 py-2.5 rounded-xl bg-white border border-[var(--vibe-border)] text-[var(--vibe-text-main)] text-xs font-black hover:bg-slate-50 disabled:opacity-50"
                    >
                      {netClose >= 0
                        ? `Tutup Kas Penuh (Setor ${formatRp(netClose)})`
                        : `Tutup Kas (Ganti Talangan ${formatRp(netClose)})`}
                    </button>

                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() =>
                        handleConfirmSettlement({
                          settlementId: st._id,
                          courierId: st.courierId,
                          courierName: st.courierName,
                          periodKey: st.periodKey,
                          mode: 'continue_float',
                          amount: netNext,
                        })
                      }
                      className="px-4 py-2.5 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black inline-flex items-center gap-1.5 hover:opacity-95 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>
                        {netNext >= 0
                          ? `Konfirmasi Setor ${formatRp(netNext)} & Lanjut Kas`
                          : `Konfirmasi Refill ${formatRp(netNext)} & Lanjut Kas`}
                      </span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Pantauan Kas Berjalan Hari Ini (Sebelum Jam 16.00) */}
      <div className="bg-[var(--vibe-surface)] p-6 rounded-2xl border border-[var(--vibe-border)] space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[var(--vibe-accent-1-lt)] text-[var(--vibe-accent-1)]">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-[var(--vibe-text-main)]">
              Pantauan Kas Berjalan Per Kurir
            </h3>
            <p className="text-xs font-bold text-[var(--vibe-text-sub)]">
              Posisi transaksi selesai yang belum tutup buku, otomatis ditagihkan pukul{' '}
              {String(finConfig.dailySettlementCutoffHour).padStart(2, '0')}:00 WIB
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {liveCourierLedgers.map((row) => {
            const { courier, summary, inFlightCount } = row
            const hasActivity = summary.orderCount > 0 || inFlightCount > 0 || courier.isSettlementBlocked
            return (
              <div
                key={row.courierId}
                className={`p-5 rounded-2xl border space-y-3 ${
                  courier.isSettlementBlocked
                    ? 'bg-red-50/50 border-red-200'
                    : 'bg-[var(--vibe-surface-sub)] border-[var(--vibe-border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[var(--vibe-text-sub)]" />
                      <h4 className="font-black text-[var(--vibe-text-main)]">{courier.name}</h4>
                      {courier.isSettlementBlocked && (
                        <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black">
                          Dibekukan
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-[var(--vibe-text-sub)] mt-0.5">
                      Kas Awal: {formatRp(summary.openingFloatCash)} | Sedang antar: {inFlightCount}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-bold text-[var(--vibe-text-sub)] uppercase">
                      {summary.netContinueNextDay >= 0 ? 'Estimasi Setor' : 'Estimasi Refill'}
                    </p>
                    <p
                      className={`text-base font-black ${
                        summary.orderCount === 0
                          ? 'text-[var(--vibe-text-sub)]'
                          : summary.netContinueNextDay >= 0
                            ? 'text-green-700'
                            : 'text-red-700'
                      }`}
                    >
                      {formatRp(summary.netContinueNextDay)}
                    </p>
                  </div>
                </div>

                {hasActivity && (
                  <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-[var(--vibe-border)] text-[11px]">
                    <div>
                      <span className="block text-[var(--vibe-text-sub)] font-bold">
                        Selesai ({summary.orderCount})
                      </span>
                      <span className="font-black text-[var(--vibe-text-main)]">
                        {formatRp(summary.codOrderTotal + summary.qrisOrderTotal)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[var(--vibe-text-sub)] font-bold">
                        Bayar Penjual
                      </span>
                      <span className="font-black text-rose-600">
                        {formatRp(summary.sellerCashPaid)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[var(--vibe-text-sub)] font-bold">
                        Upah / Kas
                      </span>
                      <span className="font-black text-[var(--vibe-accent-1)]">
                        {formatRp(summary.courierCommissionTotal)} /{' '}
                        {formatRp(summary.kalurahanFeeTotal)}
                      </span>
                    </div>
                  </div>
                )}

                {summary.orderCount > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() =>
                        handleConfirmSettlement({
                          courierId: row.courierId,
                          courierName: courier.name,
                          periodKey: row.periodKey,
                          mode: 'continue_float',
                          amount: summary.netContinueNextDay,
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black hover:opacity-90 disabled:opacity-50"
                    >
                      Tutup &amp; Rekonsiliasi Sekarang
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* SECTION 3: Riwayat Setoran Lunas */}
      <div className="bg-[var(--vibe-surface)] p-6 rounded-2xl border border-[var(--vibe-border)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-[var(--vibe-text-main)]">
            Riwayat Setoran Lunas ({settledHistory.length})
          </h3>
          <button
            type="button"
            onClick={() => setShowSettledHistory((v) => !v)}
            className="text-xs font-black text-[var(--vibe-accent-1)]"
          >
            {showSettledHistory ? 'Sembunyikan' : 'Tampilkan Riwayat'}
          </button>
        </div>

        {showSettledHistory && (
          <div className="overflow-x-auto">
            {settledHistory.length === 0 ? (
              <p className="text-xs font-bold text-[var(--vibe-text-sub)] py-4 text-center">
                Belum ada riwayat setoran kas kurir yang selesai.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--vibe-border)] text-[var(--vibe-text-sub)]">
                    <th className="py-2.5 pr-3 font-black">Periode</th>
                    <th className="py-2.5 pr-3 font-black">Kurir</th>
                    <th className="py-2.5 pr-3 font-black">Order</th>
                    <th className="py-2.5 pr-3 font-black">Upah Kurir</th>
                    <th className="py-2.5 pr-3 font-black">Kas Kalurahan</th>
                    <th className="py-2.5 pr-3 font-black">Disetor / Refill</th>
                    <th className="py-2.5 font-black">Selesai Pada</th>
                  </tr>
                </thead>
                <tbody>
                  {settledHistory.map((h: any) => {
                    const amt = Number(h.settledAmount || 0)
                    return (
                      <tr key={h._id} className="border-b border-[var(--vibe-border)]">
                        <td className="py-3 pr-3 font-bold">{h.periodKey}</td>
                        <td className="py-3 pr-3 font-black">{h.courierName}</td>
                        <td className="py-3 pr-3 font-bold">{h.orderCount}</td>
                        <td className="py-3 pr-3 font-bold text-[var(--vibe-accent-1)]">
                          {formatRp(h.courierCommissionTotal || 0)}
                        </td>
                        <td className="py-3 pr-3 font-bold text-blue-700">
                          {formatRp(h.kalurahanFeeTotal || 0)}
                        </td>
                        <td className="py-3 pr-3 font-black">
                          {amt >= 0 ? `Setor ${formatRp(amt)}` : `Refill ${formatRp(amt)}`}
                        </td>
                        <td className="py-3 text-[var(--vibe-text-sub)]">
                          {h.settledAt
                            ? new Date(h.settledAt).toLocaleString('id-ID', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
