import { useState, useEffect, useCallback } from 'react'
import {
  updateVendorProfile,
  getVendorOrders,
  vendorOrderTransition,
} from '@/app/actions/vendor-portal'
import { isCourierConfirmedForOrder } from '@/lib/courierAssigner'
import {
  Save,
  Power,
  LogOut,
  CheckCircle2,
  MessageSquare,
  AlignLeft,
  Loader2,
  Package,
  User,
  Presentation,
  ShoppingBag,
  Truck,
  XCircle,
  RefreshCw,
  MapPin,
} from 'lucide-react'
import VendorProductManager from './VendorProductManager'
import VendorServiceManager from './VendorServiceManager'

interface Props {
  initialData: any
  onLogout: () => void
}

const VENDOR_STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu Verifikasi Pembayaran',
  processing: 'Perlu Disiapkan Penjual',
  accepted: 'Kurir Menjemput ke Lapak',
  shipped: 'Siap Diambil / Dibawa Kurir',
  delivering: 'Sedang Diantar ke Pembeli',
  delivered: 'Sudah Diserahkan ke Pembeli',
  problem: 'Ada Kendala',
}

export default function VendorDashboard({ initialData, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<'orders' | 'profile' | 'products'>('orders')
  const [isOpen, setIsOpen] = useState(initialData.isOpen)
  const [closingMessage, setClosingMessage] = useState(initialData.closingMessage || '')
  const [description, setDescription] = useState(initialData.description || '')
  const [latitude, setLatitude] = useState<number | null>(
    typeof initialData.latitude === 'number' ? initialData.latitude : null
  )
  const [longitude, setLongitude] = useState<number | null>(
    typeof initialData.longitude === 'number' ? initialData.longitude : null
  )
  const [locating, setLocating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [busyOrder, setBusyOrder] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true)
    const res = await getVendorOrders(initialData._id)
    if (res.success && res.data) {
      setOrders(res.data)
    }
    setOrdersLoading(false)
  }, [initialData._id])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const handleUpdate = async () => {
    setLoading(true)
    setSuccess(false)
    const res = await updateVendorProfile(initialData._id, {
      isOpen,
      closingMessage,
      description,
      latitude,
      longitude,
    })

    if (res.success) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } else {
      alert('Gagal memperbarui profil.')
    }
    setLoading(false)
  }

  const handleOrderAction = async (
    orderNumber: string,
    nextStatus: 'shipped' | 'delivering' | 'cancelled',
    note: string
  ) => {
    if (
      nextStatus === 'cancelled' &&
      !confirm(`Batalkan pesanan ${orderNumber} karena stok kosong / kendala?`)
    ) {
      return
    }
    setBusyOrder(orderNumber)
    const res = await vendorOrderTransition(orderNumber, nextStatus, note)
    if (!res.success) {
      alert(res.error || 'Gagal memperbarui status pesanan.')
    }
    await loadOrders()
    setBusyOrder(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 pb-32">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900">{initialData.name}</h1>
            <p className="text-slate-400 font-bold text-sm">Portal UMKM Pondokrejo</p>
          </div>
          <button
            onClick={onLogout}
            className="p-3 bg-white text-slate-400 hover:text-red-600 rounded-2xl shadow-sm transition-colors border border-slate-100"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-2xl mb-8">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Pesanan</span>
            {orders.length > 0 && (
              <span className="bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                {orders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            <User className="w-4 h-4" />
            Profil Toko
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'products' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {initialData.businessType === 'service' ? (
              <>
                <Presentation className="w-4 h-4" /> Jasa
              </>
            ) : (
              <>
                <Package className="w-4 h-4" /> Produk
              </>
            )}
          </button>
        </div>

        {activeTab === 'orders' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">
                Pesanan Masuk ({orders.length})
              </h3>
              <button
                onClick={loadOrders}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang</span>
              </button>
            </div>

            {ordersLoading ? (
              <div className="flex justify-center py-12 text-slate-300">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] py-16 text-center px-6">
                <p className="text-slate-400 font-bold text-sm">
                  Belum ada pesanan masuk yang aktif saat ini.
                </p>
              </div>
            ) : (
              orders.map((ord) => {
                const isBusy = busyOrder === ord.orderNumber
                const isService = ord.orderCategory === 'service'
                return (
                  <div
                    key={ord._id}
                    className="bg-white p-6 rounded-[2rem] border border-slate-100 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                          {ord.orderNumber}
                        </p>
                        <h4 className="font-black text-slate-900 text-lg">{ord.customerName}</h4>
                        <p className="text-xs font-bold text-slate-500">{ord.deliveryAddress}</p>
                      </div>
                      <span className="bg-green-50 text-green-700 text-[11px] font-black px-3 py-1 rounded-full border border-green-100">
                        {VENDOR_STATUS_LABEL[ord.status] || ord.status}
                      </span>
                    </div>

                    {isService ? (
                      <div className="bg-slate-50 p-3.5 rounded-2xl text-sm font-bold text-slate-700">
                        Layanan: {ord.serviceItem?.name || 'Jasa Warga'}
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-3.5 rounded-2xl space-y-1.5">
                        {(ord.items || []).map((it: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex justify-between text-sm font-bold text-slate-700"
                          >
                            <span>
                              {it.product?.name || 'Produk'} (x{it.quantity})
                            </span>
                            <span>
                              Rp{((it.price || 0) * (it.quantity || 1)).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!isService &&
                      (isCourierConfirmedForOrder(ord) ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <Truck className="w-4 h-4 text-green-600" />
                          <span>Kurir: {ord.courier.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                          <Truck className="w-4 h-4 text-amber-600" />
                          <span>Kurir: Menunggu konfirmasi kurir dalam antrean</span>
                        </div>
                      ))}

                    {['processing', 'accepted'].includes(ord.status) && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <button
                          disabled={isBusy}
                          onClick={() =>
                            handleOrderAction(
                              ord.orderNumber,
                              isService ? 'delivering' : 'shipped',
                              isService
                                ? 'Penyedia jasa menuju lokasi warga'
                                : 'Barang sudah siap diserahkan ke kurir'
                            )
                          }
                          className="py-3.5 bg-green-600 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>{isService ? 'Mulai Kerjakan' : 'Siap Diambil Kurir'}</span>
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() =>
                            handleOrderAction(
                              ord.orderNumber,
                              'cancelled',
                              'Dibatalkan oleh penjual (stok kosong / berhalangan)'
                            )
                          }
                          className="py-3.5 bg-red-50 text-red-600 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Stok Kosong / Batal</span>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        ) : activeTab === 'profile' ? (
          <div className="space-y-6">
            {/* Status Buka/Tutup */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isOpen ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Power className={`w-5 h-5 ${isOpen ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <h3 className="font-black text-slate-800">Status Operasional</h3>
                </div>
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${isOpen ? 'bg-green-600' : 'bg-slate-200'}`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isOpen ? 'translate-x-7' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              <p className="text-sm text-slate-500 font-medium mb-6">
                {isOpen
                  ? 'Usaha Anda saat ini BUKA dan dapat menerima pesanan dari warga.'
                  : 'Usaha Anda saat ini TUTUP. Profil akan tetap tampil namun tidak bisa dipesan.'}
              </p>

              {!isOpen && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                    <MessageSquare className="w-3 h-3" /> Pesan Penutupan
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Sedang istirahat, buka lagi jam 4 sore."
                    className="w-full p-5 bg-slate-50 border-none rounded-3xl focus:ring-2 focus:ring-red-500 outline-none transition-all font-bold text-slate-900"
                    value={closingMessage}
                    onChange={(e) => setClosingMessage(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Deskripsi Toko */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <AlignLeft className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-black text-slate-800">Profil Usaha</h3>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                  Deskripsi Lapak
                </label>
                <textarea
                  rows={4}
                  placeholder="Ceritakan tentang usaha Anda..."
                  className="w-full p-5 bg-slate-50 border-none rounded-3xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-slate-900 text-sm leading-relaxed"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="mt-5 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-slate-800 inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span>Titik Lokasi Lapak di Peta Pondokrejo</span>
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    {latitude !== null && longitude !== null
                      ? `Tersimpan: ${latitude}, ${longitude}`
                      : 'Belum ditandai. Klik tombol di samping saat berada di lapak.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={locating}
                  onClick={() => {
                    if (!navigator.geolocation) {
                      alert('Browser tidak mendukung GPS.')
                      return
                    }
                    setLocating(true)
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setLatitude(Number(pos.coords.latitude.toFixed(6)))
                        setLongitude(Number(pos.coords.longitude.toFixed(6)))
                        setLocating(false)
                      },
                      () => {
                        setLocating(false)
                        alert('Gagal membaca lokasi GPS. Pastikan izin lokasi diaktifkan.')
                      },
                      { enableHighAccuracy: true, timeout: 8000 }
                    )
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-black text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  {locating ? 'Mengambil Lokasi...' : 'Tandai Lokasi Lapak (GPS)'}
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 z-40">
              <div className="max-w-2xl mx-auto">
                <button
                  disabled={loading}
                  onClick={handleUpdate}
                  className={`w-full py-5 rounded-3xl font-black shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 ${success ? 'bg-green-100 text-green-700' : 'bg-slate-900 text-white shadow-slate-900/20'}`}
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : success ? (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      <span>Berhasil Disimpan!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-6 h-6" />
                      <span>Simpan Perubahan Profil</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : initialData.businessType === 'service' ? (
          <VendorServiceManager vendorId={initialData._id} />
        ) : (
          <VendorProductManager vendorId={initialData._id} />
        )}
      </div>
    </div>
  )
}
