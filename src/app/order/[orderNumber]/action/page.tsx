'use client'

import { useState, use } from 'react'
import { updateOrderStatus } from '@/app/actions/order'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  params: Promise<{ orderNumber: string }>
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  seller: 'Penjual',
  courier: 'Kurir',
  buyer: 'Pembeli',
}

export default function OrderActionPage({ params }: Props) {
  const resolvedParams = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()

  const orderNumber = resolvedParams.orderNumber
  const role = searchParams.get('role') || 'system'
  const status = searchParams.get('status')
  const label = searchParams.get('label')
  const courierId = searchParams.get('courierId')
  const courierPhone = searchParams.get('courierPhone')
  const token = searchParams.get('k')

  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAction = async () => {
    if (!orderNumber || !status) return

    setLoading(true)
    const roleName = ROLE_LABEL[role] || 'Petugas'
    const res = await updateOrderStatus(
      orderNumber,
      status,
      `Diperbarui oleh ${roleName} melalui tautan konfirmasi`,
      courierId || undefined,
      courierPhone || undefined,
      { role, token }
    )

    if (res.success) {
      setDoneMessage((res as any).message || `Status pesanan ${orderNumber} telah diperbarui.`)
      setDone(true)
    } else {
      setError(res.error || 'Gagal memperbarui status.')
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white p-12 rounded-[3rem] shadow-xl text-center max-w-sm w-full">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-black mb-2">Berhasil</h1>
          <p className="text-slate-500 font-bold mb-8">{doneMessage}</p>
          <button
            onClick={() => window.close()}
            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl"
          >
            Tutup Halaman
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-blue-50 rounded-3xl mb-4">
            <AlertTriangle className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Konfirmasi Tindakan</h1>
          <p className="text-slate-400 font-bold mt-2">Pesanan: {orderNumber}</p>
        </div>

        <div className="bg-slate-50 p-6 rounded-[2rem] mb-8">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
            Tindakan yang dipilih:
          </p>
          <p className="text-lg font-black text-slate-800">{label || 'Perbarui Status'}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-bold text-center">
            {error}
          </div>
        )}

        <button
          disabled={loading}
          onClick={handleAction}
          className="w-full bg-green-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-green-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Ya, Konfirmasi'}
        </button>

        <button
          disabled={loading}
          onClick={() => router.back()}
          className="w-full text-slate-400 font-bold py-4 mt-2"
        >
          Batal
        </button>
      </div>
    </div>
  )
}
