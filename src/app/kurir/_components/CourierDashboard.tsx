'use client'

import { useState, useEffect } from 'react'
import {
  updateCourierStatus,
  getCourierOrders,
  getCourierFinanceSummary,
} from '@/app/actions/courier-portal'
import { updateOrderStatus } from '@/app/actions/order'
import {
  LogOut,
  Power,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  Package,
  Clock,
  Truck,
  AlertTriangle,
  XCircle,
  Wallet,
  ShieldAlert,
} from 'lucide-react'

interface Props {
  initialData: any
  onLogout: () => void
}

export default function CourierDashboard({ initialData, onLogout }: Props) {
  const [isActive, setIsActive] = useState(initialData.isActive)
  const [statusMessage, setStatusMessage] = useState(initialData.statusMessage || '')
  const [orders, setOrders] = useState<any[]>([])
  const [finance, setFinance] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    const [ordRes, finRes] = await Promise.all([
      getCourierOrders(initialData._id),
      getCourierFinanceSummary(initialData._id),
    ])
    if (ordRes.success) setOrders(ordRes.data)
    if (finRes.success) setFinance(finRes.data)
    setLoading(false)
  }

  const handleStatusUpdate = async () => {
    setUpdating(true)
    const res = await updateCourierStatus(initialData._id, { isActive, statusMessage })
    if (res.success) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setUpdating(false)
  }

  const quickUpdateOrder = async (orderNumber: string, status: string, label: string) => {
    if (!confirm(`Konfirmasi: ${label}?`)) return
    const res = await updateOrderStatus(
      orderNumber,
      status,
      `Diperbarui oleh Kurir (${initialData.name}) melalui portal`,
      initialData._id
    )
    if (res.success) fetchOrders()
    else alert(res.error || 'Gagal memperbarui pesanan.')
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 pb-32">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900">{initialData.name}</h1>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Kurir Logistik</p>
          </div>
          <button onClick={onLogout} className="p-3 bg-white text-slate-400 hover:text-red-600 rounded-2xl shadow-sm transition-colors border border-slate-100">
            <LogOut className="w-6 h-6" />
          </button>
        </div>

        {/* Ringkasan Kas & Upah Harian */}
        {finance && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 mb-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <Wallet className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">Kas Awal &amp; Upah Anda</h3>
                  <p className="text-[11px] font-bold text-slate-400">
                    Periode {finance.currentPeriodKey} | Reset {String(finance.cutoffHour).padStart(2, '0')}:00 WIB
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                Modal Rp{Number(finance.openingFloatCash || 0).toLocaleString('id-ID')}
              </span>
            </div>

            {finance.isSettlementBlocked && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-black">Giliran Pengantaran Dibekukan Sementara</p>
                  <p className="mt-0.5">
                    {finance.settlementBlockedReason ||
                      'Laporan setoran kas Anda melewati batas 2x24 jam. Segera selesaikan dengan Admin Kalurahan.'}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5 text-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div>
                <p className="text-[10px] font-bold text-slate-400">Selesai</p>
                <p className="text-sm font-black text-slate-900">
                  {finance.liveSummary.orderCount} Order
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">Upah Anda</p>
                <p className="text-sm font-black text-emerald-700">
                  Rp{Number(finance.liveSummary.courierCommissionTotal || 0).toLocaleString('id-ID')}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">
                  {finance.liveSummary.netContinueNextDay >= 0 ? 'Setor Admin' : 'Refill Admin'}
                </p>
                <p
                  className={`text-sm font-black ${
                    finance.liveSummary.netContinueNextDay >= 0
                      ? 'text-slate-900'
                      : 'text-rose-600'
                  }`}
                >
                  Rp{Math.abs(Math.round(finance.liveSummary.netContinueNextDay || 0)).toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            {Array.isArray(finance.openSettlements) && finance.openSettlements.length > 0 && (
              <div className="space-y-2">
                {finance.openSettlements.map((st: any) => (
                  <div
                    key={st._id}
                    className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 ${
                      st.status === 'blocked_overdue'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    <span>
                      Tagihan {st.periodKey} ({st.orderCount} order)
                    </span>
                    <span className="font-black">
                      {Number(st.netContinueNextDay || 0) >= 0
                        ? `Setor Rp${Math.round(st.netContinueNextDay).toLocaleString('id-ID')}`
                        : `Refill Rp${Math.abs(Math.round(st.netContinueNextDay)).toLocaleString('id-ID')}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Kurir Status Section */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isActive ? 'bg-green-100' : 'bg-red-100'}`}>
                <Power className={`w-5 h-5 ${isActive ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <h3 className="font-black text-slate-800">Status Saya</h3>
            </div>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${isActive ? 'bg-green-600' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          {!isActive && (
            <input
              type="text"
              placeholder="Contoh: Sedang istirahat makan"
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all font-bold text-slate-900 mb-4 text-sm"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
            />
          )}

          <button
            disabled={updating}
            onClick={handleStatusUpdate}
            className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${success ? 'bg-green-100 text-green-700' : 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'}`}
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : success ? 'Tersimpan!' : 'Simpan Status'}
          </button>
        </div>

        {/* Task List Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 ml-2">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-black text-slate-800">Tugas Aktif</h3>
            <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full">{orders.length}</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-300">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] py-16 text-center px-6">
              <p className="text-slate-400 font-bold text-sm">Belum ada tugas pengantaran.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order._id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{order.orderNumber}</p>
                      <h4 className="font-black text-slate-800 text-lg leading-tight">{order.customerName}</h4>
                    </div>
                    <div className="bg-blue-50 text-blue-700 text-[10px] font-black px-3 py-1 rounded-full border border-blue-100">
                      {order.status.toUpperCase()}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-3 text-sm text-slate-500 font-medium leading-relaxed">
                      <MapPin className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                      <p>{order.deliveryAddress}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500 font-bold">
                      <Phone className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      <a href={`https://wa.me/${order.customerPhone}`} className="text-blue-600 hover:underline">{order.customerPhone}</a>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500 font-bold">
                      <Clock className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      {order.paymentMethod === 'qris' ? (
                        <span>
                          Tagihan:{' '}
                          <span className="text-green-700 font-black">
                            LUNAS VIA QRIS (Rp 0 - Jangan Tagih Tunai)
                          </span>
                        </span>
                      ) : (
                        <span>
                          Tagihan COD:{' '}
                          <span className="text-slate-900">
                            Rp{order.totalAmount.toLocaleString('id-ID')}
                          </span>{' '}
                          (Tagih Tunai)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
                    {order.status === 'processing' && (
                      <>
                        <button
                          onClick={() =>
                            quickUpdateOrder(
                              order.orderNumber,
                              'accepted',
                              'Kurir menerima tugas dan menuju penjual'
                            )
                          }
                          className="py-4 bg-green-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Terima Order</span>
                        </button>
                        <button
                          onClick={() =>
                            quickUpdateOrder(
                              order.orderNumber,
                              'reject',
                              'Kurir menolak tugas pengantaran'
                            )
                          }
                          className="py-4 bg-red-50 text-red-600 font-black rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Tolak Order</span>
                        </button>
                      </>
                    )}
                    {(order.status === 'accepted' || order.status === 'shipped') && (
                      <button
                        onClick={() =>
                          quickUpdateOrder(
                            order.orderNumber,
                            'delivering',
                            'Barang diambil dari penjual dan mulai jalan antar ke pembeli'
                          )
                        }
                        className="col-span-2 py-4 bg-purple-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Truck className="w-4 h-4" />
                        <span>Ambil &amp; Mulai Antar ke Pembeli</span>
                      </button>
                    )}
                    {order.status === 'delivering' && (
                      <>
                        <button
                          onClick={() =>
                            quickUpdateOrder(
                              order.orderNumber,
                              'delivered',
                              order.paymentMethod === 'qris'
                                ? 'Barang diserahkan ke warga (Sudah lunas QRIS)'
                                : 'Barang diserahkan ke warga & pembayaran COD diterima'
                            )
                          }
                          className="py-4 bg-green-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Barang Diserahkan</span>
                        </button>
                        <button
                          onClick={() =>
                            quickUpdateOrder(
                              order.orderNumber,
                              'problem',
                              'Kendala pengantaran di lapangan'
                            )
                          }
                          className="py-4 bg-rose-50 text-rose-600 font-black rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span>Kendala</span>
                        </button>
                      </>
                    )}
                    {order.status === 'delivered' && (
                      <div className="col-span-2 py-3 px-4 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-2xl text-center">
                        Barang sudah diserahkan. Menunggu konfirmasi diterima dari pembeli.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
