'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Loader2,
  RefreshCw,
  LogOut,
  Package,
  Printer,
  Users,
  ShoppingBag,
  Image as ImageIcon,
  Rocket,
  Settings,
  Wallet,
  ExternalLink,
} from 'lucide-react'
import {
  fetchAdminDashboardData,
  verifyAdminPin,
} from '@/app/actions/admin'
import AdminOrdersTab from './_components/AdminOrdersTab'
import AdminFinanceTab from './_components/AdminFinanceTab'
import AdminPartnersTab from './_components/AdminPartnersTab'
import AdminCatalogTab from './_components/AdminCatalogTab'
import AdminContentTab from './_components/AdminContentTab'
import AdminSettingsQrisTab from './_components/AdminSettingsQrisTab'

type ActiveTab =
  | 'orders'
  | 'finance'
  | 'partners'
  | 'catalog'
  | 'content'
  | 'incubator'
  | 'settings'

export default function AdminDashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [verifyingPin, setVerifyingPin] = useState(false)
  const [errorPin, setErrorPin] = useState('')

  const [activeTab, setActiveTab] = useState<ActiveTab>('orders')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [dashboardData, setDashboardData] = useState<any>({
    orders: [],
    vendors: [],
    couriers: [],
    customers: [],
    products: [],
    services: [],
    categories: [],
    banners: [],
    articles: [],
    incubatorServices: [],
    incubatorSettings: null,
    courierSettlements: [],
    appSettings: {
      siteName: 'PAWON PONDOKREJO',
      adminPhone: '+62895325586281',
      adminPin: '12341',
      defaultShippingFee: 6000,
      courierCommissionAmount: 4000,
      kalurahanFeeAmount: 2000,
      defaultCourierFloatCash: 100000,
      dailySettlementCutoffHour: 16,
      maxSettlementDelayHours: 48,
      isMaintenance: false,
      isQrisEnabled: true,
      qrisMerchantName: 'PAWON PONDOKREJO',
      qrisNmid: 'ID1026574925990',
      qrisStaticPayload: '',
      isSopAutoEnabled: true,
      sopPendingCancelHours: 24,
      sopStuckWarningHours: 4,
      sopDeliveredCompleteHours: 24,
      sopProcessingCancelHours: 48,
      sopLastRunAt: null,
    },
  })

  const loadAllData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    else setRefreshing(true)

    const res = await fetchAdminDashboardData()
    if (res.success && res.data) {
      setDashboardData(res.data)
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    const savedAuth = sessionStorage.getItem('pawon_admin_auth')
    if (savedAuth === 'true') {
      setIsAuthenticated(true)
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadAllData(false)
      const interval = setInterval(() => {
        loadAllData(true)
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, loadAllData])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyingPin(true)
    setErrorPin('')
    const res = await verifyAdminPin(pinInput)
    setVerifyingPin(false)

    if (res.success) {
      sessionStorage.setItem('pawon_admin_auth', 'true')
      setIsAuthenticated(true)
    } else {
      setErrorPin(res.error || 'PIN tidak sesuai.')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('pawon_admin_auth')
    setIsAuthenticated(false)
    setPinInput('')
  }

  if (!isAuthenticated && !loading) {
    return (
      <div className="min-h-screen bg-[var(--vibe-background)] flex items-center justify-center p-6">
        <form
          onSubmit={handleLogin}
          className="bg-[var(--vibe-surface)] p-10 rounded-3xl border border-[var(--vibe-border)] max-w-sm w-full text-center"
        >
          <div className="w-16 h-16 bg-[var(--vibe-text-main)] text-white rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-[var(--vibe-text-main)] mb-2">
            Admin PAWON
          </h1>
          <p className="text-[var(--vibe-text-sub)] font-bold text-sm mb-4">
            Masukkan PIN Admin Kalurahan
          </p>
          <Link
            href="/manual/admin"
            className="inline-block text-xs font-black text-[var(--vibe-text-sub)] bg-[var(--vibe-surface-sub)] px-4 py-2 rounded-xl hover:opacity-80 transition-opacity mb-6"
          >
            Panduan Operasional Admin
          </Link>

          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="*****"
            className="w-full text-center text-3xl tracking-[0.4em] font-black p-4 bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] rounded-2xl outline-none focus:border-[var(--vibe-accent-1)] mb-4"
          />

          {errorPin && (
            <p className="text-red-600 text-xs font-bold mb-4">{errorPin}</p>
          )}

          <button
            type="submit"
            disabled={verifyingPin}
            className="w-full bg-[var(--vibe-accent-1)] text-white font-black py-4 rounded-2xl transition-opacity hover:opacity-95 flex items-center justify-center gap-2"
          >
            {verifyingPin ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Masuk Dasbor'
            )}
          </button>
        </form>
      </div>
    )
  }

  if (loading && !dashboardData.orders.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--vibe-background)]">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--vibe-text-muted)]" />
      </div>
    )
  }

  const navItems: Array<{
    id: ActiveTab
    label: string
    icon: React.ReactNode
    badge?: number
  }> = [
    {
      id: 'orders',
      label: 'Pesanan',
      icon: <Package className="w-4 h-4" />,
      badge: dashboardData.orders.filter(
        (o: any) =>
          o.status === 'pending' ||
          (o.paymentMethod === 'qris' &&
            o.paymentStatus === 'unpaid' &&
            o.status !== 'cancelled')
      ).length,
    },
    {
      id: 'finance',
      label: 'Keuangan Kurir',
      icon: <Wallet className="w-4 h-4" />,
      badge: (dashboardData.courierSettlements || []).filter(
        (s: any) => s.status !== 'settled'
      ).length,
    },
    {
      id: 'partners',
      label: 'Mitra & Warga',
      icon: <Users className="w-4 h-4" />,
      badge: dashboardData.vendors.filter((v: any) => !v.isVerified).length,
    },
    {
      id: 'catalog',
      label: 'Katalog & Kategori',
      icon: <ShoppingBag className="w-4 h-4" />,
    },
    {
      id: 'content',
      label: 'Konten & Banner',
      icon: <ImageIcon className="w-4 h-4" />,
    },
    {
      id: 'incubator',
      label: 'Inkubator UMKM',
      icon: <Rocket className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: 'Pengaturan & QRIS',
      icon: <Settings className="w-4 h-4" />,
    },
  ]

  return (
    <div className="min-h-screen bg-[var(--vibe-background)] pb-20 print:bg-white print:pb-0">
      {/* Header */}
      <header className="bg-[var(--vibe-surface)] border-b border-[var(--vibe-border)] sticky top-0 z-40 print:hidden">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--vibe-accent-1)] text-white rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-[var(--vibe-text-main)] leading-none">
                Admin PAWON
              </h1>
              <p className="text-[11px] text-[var(--vibe-text-sub)] font-bold mt-1">
                Kalurahan Pondokrejo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-2 rounded-xl bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)] hover:text-[var(--vibe-text-main)] text-xs font-black inline-flex items-center gap-1.5 transition-colors"
              title="Buka Etalase Warga"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Lihat Toko</span>
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="p-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              title="Cetak Laporan Pesanan"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => loadAllData(true)}
              className="p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)] hover:text-[var(--vibe-text-main)] transition-colors"
              title="Sinkronkan Data"
            >
              <RefreshCw
                className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              title="Keluar"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 6-Tab Navigation Bar */}
        <div className="container mx-auto px-4 pb-3 overflow-x-auto">
          <nav className="flex items-center gap-2 min-w-max">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-colors inline-flex items-center gap-2 ${
                  activeTab === item.id
                    ? 'bg-[var(--vibe-text-main)] text-white'
                    : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)] hover:text-[var(--vibe-text-main)]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black leading-none">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 mt-6 print:hidden">
        {activeTab === 'orders' && (
          <AdminOrdersTab
            orders={dashboardData.orders}
            couriers={dashboardData.couriers}
            sopConfig={dashboardData.appSettings}
            onRefresh={() => loadAllData(true)}
          />
        )}

        {activeTab === 'finance' && (
          <AdminFinanceTab
            orders={dashboardData.orders}
            couriers={dashboardData.couriers}
            settlements={dashboardData.courierSettlements || []}
            appSettings={dashboardData.appSettings}
            onRefresh={() => loadAllData(true)}
          />
        )}

        {activeTab === 'partners' && (
          <AdminPartnersTab
            vendors={dashboardData.vendors}
            couriers={dashboardData.couriers}
            customers={dashboardData.customers}
            onRefresh={() => loadAllData(true)}
          />
        )}

        {activeTab === 'catalog' && (
          <AdminCatalogTab
            products={dashboardData.products}
            services={dashboardData.services}
            categories={dashboardData.categories}
            vendors={dashboardData.vendors}
            onRefresh={() => loadAllData(true)}
          />
        )}

        {activeTab === 'content' && (
          <AdminContentTab
            mode="content"
            banners={dashboardData.banners}
            articles={dashboardData.articles}
            incubatorServices={dashboardData.incubatorServices}
            incubatorSettings={dashboardData.incubatorSettings}
            onRefresh={() => loadAllData(true)}
          />
        )}

        {activeTab === 'incubator' && (
          <AdminContentTab
            mode="incubator"
            banners={dashboardData.banners}
            articles={dashboardData.articles}
            incubatorServices={dashboardData.incubatorServices}
            incubatorSettings={dashboardData.incubatorSettings}
            onRefresh={() => loadAllData(true)}
          />
        )}

        {activeTab === 'settings' && (
          <AdminSettingsQrisTab
            initialSettings={dashboardData.appSettings}
            onRefresh={() => loadAllData(true)}
          />
        )}
      </main>

      {/* Print Table */}
      <div className="hidden print:block p-8 bg-white font-sans text-slate-900">
        <div className="text-center mb-8 border-b-2 border-slate-900 pb-6">
          <h1 className="text-3xl font-black uppercase tracking-widest">
            Rekapitulasi Pesanan
          </h1>
          <p className="text-slate-500 font-bold mt-2">
            PAWON Pondokrejo - Dicetak pada{' '}
            {new Date().toLocaleString('id-ID', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </p>
        </div>

        <table className="w-full text-left border-collapse mb-8">
          <thead>
            <tr className="border-b-2 border-slate-800 text-sm">
              <th className="py-4 px-3 font-black uppercase bg-slate-50">No.</th>
              <th className="py-4 px-3 font-black uppercase bg-slate-50">Waktu</th>
              <th className="py-4 px-3 font-black uppercase bg-slate-50">
                Pelanggan
              </th>
              <th className="py-4 px-3 font-black uppercase bg-slate-50">Metode</th>
              <th className="py-4 px-3 font-black uppercase bg-slate-50">Status</th>
              <th className="py-4 px-3 font-black uppercase bg-slate-50 text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="text-sm align-top">
            {dashboardData.orders.map((order: any) => (
              <tr key={order._id} className="border-b border-slate-200">
                <td className="py-4 px-3 font-black">{order.orderNumber}</td>
                <td className="py-4 px-3">
                  {new Date(order._createdAt).toLocaleString('id-ID', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </td>
                <td className="py-4 px-3">
                  <div className="font-bold">{order.customerName}</div>
                  <div className="text-xs mt-1">{order.customerPhone}</div>
                </td>
                <td className="py-4 px-3 font-bold uppercase">
                  {order.paymentMethod || 'cod'}
                </td>
                <td className="py-4 px-3 font-bold">
                  {order.status === 'completed'
                    ? 'Selesai'
                    : order.status === 'cancelled'
                      ? 'Dibatalkan'
                      : order.status === 'delivered'
                        ? 'Diserahkan'
                        : order.status === 'delivering'
                          ? 'Diantar'
                          : order.status === 'shipped'
                            ? 'Diambil Kurir'
                            : order.status === 'processing'
                              ? 'Diproses'
                              : order.status === 'accepted'
                                ? 'Dijemput Kurir'
                                : order.status === 'problem'
                                  ? 'Kendala'
                                  : 'Menunggu'}
                </td>
                <td className="py-4 px-3 text-right font-black">
                  Rp {(order.totalAmount || 0).toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
