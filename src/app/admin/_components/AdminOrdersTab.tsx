'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Package,
  User,
  MapPin,
  CreditCard,
  CheckCircle,
  Clock,
  Truck,
  AlertTriangle,
  Trash2,
  Edit3,
  Search,
  Loader2,
  Send,
  X,
  Download,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  LayoutList,
  LayoutGrid,
  ShieldAlert,
  ExternalLink,
  Calendar,
} from 'lucide-react'
import {
  adminConfirmAndAssignOrder,
  adminUpdateOrderDirect,
  adminDeleteDocument,
  adminQuickOrderTransition,
  previewOrderSopAction,
  executeOrderSopAction,
} from '@/app/actions/admin'
import { classifyOrderForSop, SopConfig, SopEvaluationResult } from '@/lib/orderSopEngine'

interface AdminOrdersTabProps {
  orders: any[]
  couriers: any[]
  sopConfig?: Partial<SopConfig>
  onRefresh: () => Promise<void>
}

type StatusFilter =
  | 'all'
  | 'needs_action'
  | 'pending_qris'
  | 'pending_cod'
  | 'active_delivery'
  | 'stuck'
  | 'missing_courier'
  | 'completed'
  | 'problem'

type PeriodFilter = 'all' | 'today' | 'week' | 'month'
type GroupByMode = 'month' | 'week' | 'day' | 'none'
type ViewMode = 'table' | 'cards'

function formatWaNumber(phone?: string): string {
  if (!phone) return ''
  const clean = phone.replace(/\D/g, '')
  return clean.startsWith('0') ? '62' + clean.slice(1) : clean
}

function formatRelativeAge(dateStr: string): { label: string; hours: number } {
  const ts = new Date(dateStr).getTime()
  if (Number.isNaN(ts)) return { label: '-', hours: 0 }
  const diffMs = Math.max(0, Date.now() - ts)
  const mins = Math.floor(diffMs / 60000)
  const hours = diffMs / 3600000
  if (mins < 2) return { label: 'Baru saja', hours }
  if (mins < 60) return { label: `${mins} mnt lalu`, hours }
  if (hours < 24) return { label: `${Math.floor(hours)} jam lalu`, hours }
  const days = Math.floor(hours / 24)
  return { label: `${days} hari lalu`, hours }
}

function getGroupMeta(dateStr: string, mode: GroupByMode): { key: string; label: string } {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime()) || mode === 'none') {
    return { key: 'all', label: 'Semua Transaksi' }
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  if (mode === 'day') {
    const label = d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    return { key: `${y}-${m}-${day}`, label }
  }

  if (mode === 'week') {
    const copy = new Date(d)
    const dayOfWeek = copy.getDay() || 7
    copy.setDate(copy.getDate() - dayOfWeek + 1)
    copy.setHours(0, 0, 0, 0)
    const end = new Date(copy)
    end.setDate(copy.getDate() + 6)
    const key = copy.toISOString().slice(0, 10)
    const startFmt = copy.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    const endFmt = end.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    return { key: `W-${key}`, label: `Minggu ${startFmt} - ${endFmt}` }
  }

  // Month
  const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  return { key: `${y}-${m}`, label }
}

function getStageStep(status: string): number {
  if (status === 'pending') return 1
  if (status === 'accepted' || status === 'processing') return 2
  if (status === 'shipped') return 3
  if (status === 'delivering' || status === 'delivered') return 4
  if (status === 'completed') return 5
  return 0
}

export default function AdminOrdersTab({
  orders,
  couriers,
  sopConfig,
  onRefresh,
}: AdminOrdersTabProps) {
  const effectiveSop: SopConfig = {
    isSopAutoEnabled: sopConfig?.isSopAutoEnabled !== false,
    sopPendingCancelHours: Number(sopConfig?.sopPendingCancelHours) || 24,
    sopStuckWarningHours: Number(sopConfig?.sopStuckWarningHours) || 4,
    sopDeliveredCompleteHours: Number(sopConfig?.sopDeliveredCompleteHours) || 24,
    sopProcessingCancelHours: Number(sopConfig?.sopProcessingCancelHours) || 48,
    sopCourierTimeoutMinutes: Number(sopConfig?.sopCourierTimeoutMinutes) || 5,
  }

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<GroupByMode>('month')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [hideTestOrders, setHideTestOrders] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeGroupKey, setActiveGroupKey] = useState<string | null | undefined>(
    undefined
  )
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const [selectedCourierByOrder, setSelectedCourierByOrder] = useState<
    Record<string, string>
  >({})
  const [notesByOrder, setNotesByOrder] = useState<Record<string, string>>({})
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [editingOrder, setEditingOrder] = useState<any | null>(null)

  const [sopModal, setSopModal] = useState<SopEvaluationResult | null>(null)
  const [sopLoading, setSopLoading] = useState(false)
  const [sopSendWa, setSopSendWa] = useState(true)

  const activeCouriers = useMemo(
    () => couriers.filter((c) => c.isActive && c.status !== 'inactive'),
    [couriers]
  )

  const availableMonths = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of orders) {
      const d = new Date(o._createdAt)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      map.set(key, label)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [orders])

  const kpiStats = useMemo(() => {
    let needsAction = 0
    let pendingQris = 0
    let pendingCod = 0
    let activeDelivery = 0
    let missingCourier = 0
    let stuck = 0
    let completed = 0
    let completedOmzet = 0
    let problem = 0
    let sopEligible = 0

    for (const o of orders) {
      const isActiveStage = [
        'accepted',
        'processing',
        'shipped',
        'delivering',
        'delivered',
      ].includes(o.status)

      if (o.paymentMethod === 'qris' && o.paymentStatus === 'unpaid' && o.status !== 'cancelled') {
        pendingQris++
        needsAction++
      } else if (o.status === 'pending') {
        pendingCod++
        needsAction++
      }

      if (isActiveStage) {
        activeDelivery++
        if (o.orderCategory !== 'service' && !o.courier?._id) {
          missingCourier++
        }
        const ageHours =
          (Date.now() - new Date(o._updatedAt || o._createdAt).getTime()) / 3600000
        if (ageHours >= effectiveSop.sopStuckWarningHours) {
          stuck++
        }
      }

      if (o.status === 'completed') {
        completed++
        completedOmzet += Number(o.totalAmount || 0)
      }
      if (o.status === 'problem' || o.status === 'cancelled') {
        problem++
      }

      if (classifyOrderForSop(o, effectiveSop)) {
        sopEligible++
      }
    }

    return {
      needsAction,
      pendingQris,
      pendingCod,
      activeDelivery,
      missingCourier,
      stuck,
      completed,
      completedOmzet,
      problem,
      sopEligible,
    }
  }, [orders, effectiveSop])

  const filteredOrders = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfWeek = startOfToday - ((now.getDay() || 7) - 1) * 86400000
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    return orders.filter((o) => {
      if (hideTestOrders && (o.customerName || '').toLowerCase().includes('test')) {
        return false
      }

      const createdTs = new Date(o._createdAt).getTime()
      if (periodFilter === 'today' && createdTs < startOfToday) return false
      if (periodFilter === 'week' && createdTs < startOfWeek) return false
      if (periodFilter === 'month' && createdTs < startOfMonth) return false

      if (selectedMonth !== 'all') {
        const d = new Date(o._createdAt)
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (ym !== selectedMonth) return false
      }

      if (statusFilter === 'needs_action') {
        const isPendingQris =
          o.paymentMethod === 'qris' &&
          o.paymentStatus === 'unpaid' &&
          o.status !== 'cancelled'
        if (!isPendingQris && o.status !== 'pending') return false
      } else if (statusFilter === 'pending_qris') {
        if (
          !(
            o.paymentMethod === 'qris' &&
            o.paymentStatus === 'unpaid' &&
            o.status !== 'cancelled'
          )
        ) {
          return false
        }
      } else if (statusFilter === 'pending_cod') {
        if (!(o.paymentMethod !== 'qris' && o.status === 'pending')) return false
      } else if (statusFilter === 'active_delivery') {
        if (
          !['accepted', 'processing', 'shipped', 'delivering', 'delivered'].includes(
            o.status
          )
        ) {
          return false
        }
      } else if (statusFilter === 'missing_courier') {
        if (
          !(
            ['accepted', 'processing', 'shipped', 'delivering', 'delivered'].includes(
              o.status
            ) &&
            o.orderCategory !== 'service' &&
            !o.courier?._id
          )
        ) {
          return false
        }
      } else if (statusFilter === 'stuck') {
        const ageHours =
          (Date.now() - new Date(o._updatedAt || o._createdAt).getTime()) / 3600000
        if (
          !(
            ['accepted', 'processing', 'shipped', 'delivering', 'delivered'].includes(
              o.status
            ) && ageHours >= effectiveSop.sopStuckWarningHours
          )
        ) {
          return false
        }
      } else if (statusFilter === 'completed') {
        if (o.status !== 'completed') return false
      } else if (statusFilter === 'problem') {
        if (!['problem', 'cancelled'].includes(o.status)) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const inOrder = [
          o.orderNumber,
          o.customerName,
          o.customerPhone,
          o.deliveryAddress,
          o.courier?.name,
          o.serviceItem?.name,
          o.serviceItem?.vendorName,
          ...(o.items || []).flatMap((i: any) => [
            i.product?.name,
            i.product?.vendorName,
          ]),
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q))
        if (!inOrder) return false
      }

      return true
    })
  }, [
    orders,
    hideTestOrders,
    periodFilter,
    selectedMonth,
    statusFilter,
    searchQuery,
    effectiveSop.sopStuckWarningHours,
  ])

  const groupedOrders = useMemo(() => {
    const groups: Array<{
      key: string
      label: string
      orders: any[]
      completedCount: number
      omzet: number
    }> = []
    const indexMap = new Map<string, number>()

    for (const o of filteredOrders) {
      const { key, label } = getGroupMeta(o._createdAt, groupBy)
      let idx = indexMap.get(key)
      if (idx === undefined) {
        idx = groups.length
        indexMap.set(key, idx)
        groups.push({
          key,
          label,
          orders: [],
          completedCount: 0,
          omzet: 0,
        })
      }
      groups[idx].orders.push(o)
      if (o.status === 'completed') {
        groups[idx].completedCount++
        groups[idx].omzet += Number(o.totalAmount || 0)
      }
    }
    return groups
  }, [filteredOrders, groupBy])

  const isGroupOpen = (key: string, idx: number) => {
    if (groupBy === 'none') return true
    if (activeGroupKey === undefined) return idx === 0
    return activeGroupKey === key
  }

  const getStatusBadge = (order: any) => {
    if (order.status === 'completed') {
      return {
        label: 'Selesai',
        cls: 'bg-green-100 text-green-700 border-green-200',
        icon: <CheckCircle className="w-3.5 h-3.5" />,
      }
    }
    if (order.status === 'cancelled') {
      return {
        label: 'Dibatalkan',
        cls: 'bg-red-50 text-red-700 border-red-200',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      }
    }
    if (order.status === 'problem') {
      return {
        label: 'Bermasalah',
        cls: 'bg-red-100 text-red-700 border-red-200',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      }
    }
    if (order.paymentMethod === 'qris' && order.paymentStatus === 'unpaid') {
      return {
        label: 'Mutasi QRIS',
        cls: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: <Clock className="w-3.5 h-3.5" />,
      }
    }
    if (order.status === 'pending') {
      return {
        label:
          order.orderCategory === 'service'
            ? 'Pending Jasa'
            : 'Menunggu Konfirmasi COD',
        cls: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        icon: <Clock className="w-3.5 h-3.5" />,
      }
    }
    if (order.status === 'accepted') {
      return {
        label:
          order.orderCategory === 'service'
            ? 'Penjual Sanggup'
            : 'Diterima Kurir',
        cls: 'bg-sky-50 text-sky-700 border-sky-200',
        icon: <Truck className="w-3.5 h-3.5" />,
      }
    }
    if (order.status === 'processing') {
      return {
        label: 'Disiapkan Penjual',
        cls: 'bg-orange-100 text-orange-700 border-orange-200',
        icon: <Package className="w-3.5 h-3.5" />,
      }
    }
    if (order.status === 'shipped') {
      return {
        label: 'Diambil Kurir',
        cls: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        icon: <Package className="w-3.5 h-3.5" />,
      }
    }
    if (order.status === 'delivering') {
      return {
        label: 'Diantar ke Warga',
        cls: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: <Truck className="w-3.5 h-3.5" />,
      }
    }
    if (order.status === 'delivered') {
      return {
        label: 'Sampai (Tunggu Warga)',
        cls: 'bg-purple-100 text-purple-700 border-purple-200',
        icon: <User className="w-3.5 h-3.5" />,
      }
    }
    return {
      label: order.status || 'Pending',
      cls: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: <Package className="w-3.5 h-3.5" />,
    }
  }

  const handleConfirmAndDispatch = async (order: any) => {
    const mode = order.paymentMethod === 'qris' ? 'paid' : 'processing_cod'
    const chosenCourierId =
      selectedCourierByOrder[order._id] ||
      order.courier?._id ||
      activeCouriers[0]?._id ||
      ''
    const notes = notesByOrder[order._id] ?? order.courierNotes ?? ''

    setBusyOrderId(order._id)
    const res = await adminConfirmAndAssignOrder({
      orderId: order._id,
      orderNumber: order.orderNumber,
      actionMode: mode,
      courierId: chosenCourierId || undefined,
      courierNotes: notes,
    })
    setBusyOrderId(null)

    if (res.success) {
      await onRefresh()
    } else {
      alert(res.error || 'Gagal memproses pesanan.')
    }
  }

  const handleAssignCourierOnly = async (order: any) => {
    const chosenCourierId = selectedCourierByOrder[order._id] || ''
    if (!chosenCourierId) {
      alert('Pilih kurir terlebih dahulu.')
      return
    }
    setBusyOrderId(order._id)
    const res = await adminUpdateOrderDirect({
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus || 'unpaid',
      courierId: chosenCourierId,
      courierNotes: notesByOrder[order._id] ?? order.courierNotes ?? '',
    })
    setBusyOrderId(null)
    if (res.success) await onRefresh()
    else alert(res.error)
  }

  const handleQuickComplete = async (order: any) => {
    if (!confirm(`Tandai pesanan ${order.orderNumber} sebagai SELESAI?`)) return
    setBusyOrderId(order._id)
    const res = await adminQuickOrderTransition(
      order.orderNumber,
      'completed',
      'Diselesaikan oleh Admin dari Pusat Kendali'
    )
    setBusyOrderId(null)
    if (res.success) await onRefresh()
    else alert(res.error || 'Gagal menyelesaikan pesanan.')
  }

  const handleServiceAction = async (
    order: any,
    nextStatus: 'accepted' | 'cancelled'
  ) => {
    setBusyOrderId(order._id)
    const res = await adminQuickOrderTransition(
      order.orderNumber,
      nextStatus,
      nextStatus === 'accepted'
        ? 'Pesanan jasa disetujui Admin'
        : 'Pesanan jasa ditolak/dibatalkan Admin'
    )
    setBusyOrderId(null)
    if (res.success) await onRefresh()
    else alert(res.error)
  }

  const handleSaveManualEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return
    setBusyOrderId(editingOrder._id)
    const res = await adminUpdateOrderDirect({
      orderId: editingOrder._id,
      orderNumber: editingOrder.orderNumber,
      status: editingOrder.status,
      paymentStatus: editingOrder.paymentStatus || 'unpaid',
      courierId: editingOrder.courierId || undefined,
      courierNotes: editingOrder.courierNotes || '',
    })
    setBusyOrderId(null)
    if (res.success) {
      setEditingOrder(null)
      await onRefresh()
    } else {
      alert(res.error || 'Gagal menyimpan perubahan pesanan.')
    }
  }

  const handleDeleteOrder = async (order: any) => {
    if (!confirm(`Hapus pesanan ${order.orderNumber} secara permanen?`)) return
    setBusyOrderId(order._id)
    const res = await adminDeleteDocument(order._id)
    setBusyOrderId(null)
    if (res.success) await onRefresh()
    else alert(res.error)
  }

  const handleOpenSopPreview = async () => {
    setSopLoading(true)
    const res = await previewOrderSopAction()
    setSopLoading(false)
    if (res.success && res.data) {
      setSopModal(res.data)
    } else {
      alert(res.error || 'Gagal menganalisa SOP.')
    }
  }

  const handleExecuteSop = async () => {
    setSopLoading(true)
    const res = await executeOrderSopAction(sopSendWa)
    setSopLoading(false)
    if (res.success && res.data) {
      setSopModal(null)
      await onRefresh()
      alert(
        `Selesai: ${res.data.counts.totalAffected} pesanan diperbarui (${res.data.counts.cancelPending} dibatalkan, ${res.data.counts.completeDelivered} diselesaikan, ${res.data.counts.cancelStuck} macet ditutup).`
      )
    } else {
      alert(res.error || 'Gagal memproses penutupan pesanan.')
    }
  }

  const handleExportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const headers = [
      'No Pesanan',
      'Tanggal',
      'Kategori',
      'Pembeli',
      'WA Pembeli',
      'Alamat',
      'Item / UMKM',
      'Ongkir',
      'Total',
      'Metode Bayar',
      'Status Bayar',
      'Status Pesanan',
      'Kurir',
      'Catatan SOP',
    ]
    const rows = filteredOrders.map((o) => {
      const itemsSummary =
        o.orderCategory === 'service' && o.serviceItem
          ? `[Jasa] ${o.serviceItem.name} (${o.serviceItem.vendorName || '-'})`
          : (o.items || [])
              .map(
                (i: any) =>
                  `${i.product?.name || 'Produk'} x${i.quantity} (${i.product?.vendorName || '-'})`
              )
              .join('; ')
      return [
        o.orderNumber,
        new Date(o._createdAt).toLocaleString('id-ID'),
        o.orderCategory || 'product',
        o.customerName,
        o.customerPhone,
        o.deliveryAddress,
        itemsSummary,
        o.shippingFee || 0,
        o.totalAmount || 0,
        o.paymentMethod || 'cod',
        o.paymentStatus || 'unpaid',
        o.status,
        o.courier?.name || '-',
        o.autoResolutionReason || '',
      ]
        .map(esc)
        .join(',')
    })

    const csvContent = '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Rekap-Pesanan-PAWON-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderOrderCard = (order: any) => {
    const badge = getStatusBadge(order)
    const age = formatRelativeAge(order._updatedAt || order._createdAt)
    const isActiveStage = [
      'accepted',
      'processing',
      'shipped',
      'delivering',
      'delivered',
    ].includes(order.status)
    const isMissingCourier =
      isActiveStage && order.orderCategory !== 'service' && !order.courier?._id
    const isStuck =
      isActiveStage && age.hours >= effectiveSop.sopStuckWarningHours
    const needsAdminConfirmation =
      (order.paymentMethod === 'qris' &&
        order.paymentStatus === 'unpaid' &&
        order.status !== 'cancelled') ||
      order.status === 'pending'

    const stage = getStageStep(order.status)
    const shippingFee = Number(order.shippingFee ?? (order.orderCategory === 'service' ? 0 : 6000))
    const subtotal = Math.max(0, Number(order.totalAmount || 0) - shippingFee)

    // Kumpulkan unique seller contacts
    const vendorContacts: Array<{ name: string; phone: string }> = []
    const seenPhones = new Set<string>()
    if (order.serviceItem?.vendorPhone && !seenPhones.has(order.serviceItem.vendorPhone)) {
      seenPhones.add(order.serviceItem.vendorPhone)
      vendorContacts.push({
        name: order.serviceItem.vendorName || 'Penjual Jasa',
        phone: order.serviceItem.vendorPhone,
      })
    }
    for (const it of order.items || []) {
      const vp = it.product?.vendorPhone
      if (vp && !seenPhones.has(vp)) {
        seenPhones.add(vp)
        vendorContacts.push({
          name: it.product?.vendorName || 'UMKM',
          phone: vp,
        })
      }
    }

    const defaultCourierId =
      selectedCourierByOrder[order._id] ??
      order.courier?._id ??
      activeCouriers[0]?._id ??
      ''

    return (
      <div
        key={order._id}
        className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-5 flex flex-col lg:flex-row gap-5"
      >
        {/* Left: Core Order Details */}
        <div className="flex-grow space-y-3.5">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                style={{ fontFamily: 'var(--vibe-font-mono)' }}
                className="bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-main)] px-3 py-1 rounded-lg text-xs font-black"
              >
                {order.orderNumber}
              </span>
              <span className="text-xs font-bold text-[var(--vibe-text-sub)]">
                {new Date(order._createdAt).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                  isStuck
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]'
                }`}
              >
                {age.label}
                {isStuck ? ' • Macet' : ''}
              </span>
              {isMissingCourier && (
                <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[11px] font-black inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Belum Ada Kurir
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/track/${order.orderNumber}`}
                target="_blank"
                className="px-2.5 py-1 rounded-lg bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)] hover:text-[var(--vibe-text-main)] text-[11px] font-black inline-flex items-center gap-1"
              >
                <span>Lacak</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black ${badge.cls}`}
              >
                {badge.icon}
                <span>{badge.label}</span>
              </div>
            </div>
          </div>

          {/* 5-Stage Mini Stepper (only for non-cancelled/problem) */}
          {stage > 0 && (
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { step: 1, label: '1. Menunggu' },
                { step: 2, label: '2. Penjual' },
                { step: 3, label: '3. Diambil' },
                { step: 4, label: '4. Diantar' },
                { step: 5, label: '5. Selesai' },
              ].map((s) => (
                <div key={s.step} className="space-y-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      stage >= s.step
                        ? 'bg-[var(--vibe-accent-1)]'
                        : 'bg-[var(--vibe-surface-sub)]'
                    }`}
                  />
                  <p
                    className={`text-[10px] font-black truncate ${
                      stage >= s.step
                        ? 'text-[var(--vibe-accent-1)]'
                        : 'text-[var(--vibe-text-muted)]'
                    }`}
                  >
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Buyer & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-[var(--vibe-surface-sub)] rounded-xl text-[var(--vibe-text-sub)]">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-black text-[var(--vibe-text-main)]">
                  {order.customerName}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <a
                    href={`https://wa.me/${formatWaNumber(order.customerPhone)}?text=${encodeURIComponent(
                      `Halo ${order.customerName}, terkait pesanan PAWON ${order.orderNumber}...`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[var(--vibe-accent-1)] hover:underline inline-flex items-center gap-1"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>WA Pembeli ({order.customerPhone})</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-[var(--vibe-surface-sub)] rounded-xl text-[var(--vibe-text-sub)]">
                <MapPin className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-[var(--vibe-text-sub)] leading-relaxed">
                {order.deliveryAddress}
              </p>
            </div>
          </div>

          {/* Items & Financial Breakdown */}
          <div className="bg-[var(--vibe-surface-sub)] p-4 rounded-xl space-y-2">
            {order.orderCategory === 'service' && order.serviceItem ? (
              <div className="flex justify-between items-center text-sm font-bold">
                <span>
                  [Jasa] {order.serviceItem.name}{' '}
                  {order.serviceItem.vendorName
                    ? `(${order.serviceItem.vendorName})`
                    : ''}
                </span>
                <span>Rp {(order.totalAmount || 0).toLocaleString('id-ID')}</span>
              </div>
            ) : (
              (order.items || []).map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="font-bold text-[var(--vibe-text-main)]">
                    {item.product?.name || 'Produk'}{' '}
                    <span className="text-[var(--vibe-text-sub)]">
                      x{item.quantity}
                    </span>
                    {item.product?.vendorName && (
                      <span className="text-xs text-[var(--vibe-text-sub)] ml-1">
                        ({item.product.vendorName})
                      </span>
                    )}
                  </span>
                  <span className="font-bold text-[var(--vibe-text-main)]">
                    Rp{' '}
                    {((item.price || 0) * (item.quantity || 1)).toLocaleString(
                      'id-ID'
                    )}
                  </span>
                </div>
              ))
            )}

            <div className="border-t border-[var(--vibe-border)] pt-2 mt-2 space-y-1 text-xs">
              {order.orderCategory !== 'service' && (
                <>
                  <div className="flex justify-between text-[var(--vibe-text-sub)] font-bold">
                    <span>Subtotal Barang</span>
                    <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-[var(--vibe-text-sub)] font-bold">
                    <span>Ongkos Kirim</span>
                    <span>Rp {shippingFee.toLocaleString('id-ID')}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="font-bold text-[var(--vibe-text-sub)]">
                  Metode:{' '}
                  <strong className="text-[var(--vibe-text-main)]">
                    {order.paymentMethod === 'qris'
                      ? order.paymentStatus === 'paid'
                        ? 'QRIS (LUNAS)'
                        : 'QRIS (Belum Diverifikasi)'
                      : order.status === 'completed'
                        ? 'Tunai (COD - Lunas)'
                        : 'Tunai (COD)'}
                  </strong>
                </span>
                <span className="text-base font-black text-[var(--vibe-accent-1)]">
                  Rp {(order.totalAmount || 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* 3-Way WA Coordination Strip (Seller + Courier) */}
          {(vendorContacts.length > 0 || order.courier?.phone || order.autoResolutionReason) && (
            <div className="flex flex-wrap items-center gap-2">
              {vendorContacts.map((vc) => (
                <a
                  key={vc.phone}
                  href={`https://wa.me/${formatWaNumber(vc.phone)}?text=${encodeURIComponent(
                    `Halo ${vc.name}, mohon konfirmasi pesanan PAWON ${order.orderNumber} atas nama ${order.customerName}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-[var(--vibe-accent-1-lt)] text-[var(--vibe-accent-1)] text-[11px] font-black inline-flex items-center gap-1 hover:opacity-80"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>WA Penjual: {vc.name}</span>
                </a>
              ))}

              {order.courier?.phone && (
                <a
                  href={`https://wa.me/${formatWaNumber(order.courier.phone)}?text=${encodeURIComponent(
                    `Halo ${order.courier.name}, cek progres pengantaran pesanan ${order.orderNumber} ke ${order.customerName}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-black inline-flex items-center gap-1 hover:opacity-80"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>WA Kurir: {order.courier.name}</span>
                </a>
              )}

              {order.autoResolutionReason && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">
                  {order.autoResolutionReason}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Admin Control Panel */}
        <div className="lg:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--vibe-border)] pt-4 lg:pt-0 lg:pl-5 flex flex-col justify-between gap-3">
          {needsAdminConfirmation && order.orderCategory === 'service' ? (
            <div className="space-y-2.5">
              <p className="text-xs font-black text-[var(--vibe-text-main)]">
                Konfirmasi Pemesanan Jasa
              </p>
              <button
                type="button"
                disabled={busyOrderId === order._id}
                onClick={() => handleServiceAction(order, 'accepted')}
                className="w-full py-2.5 px-4 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
              >
                Konfirmasi Sanggup
              </button>
              <button
                type="button"
                disabled={busyOrderId === order._id}
                onClick={() => handleServiceAction(order, 'cancelled')}
                className="w-full py-2.5 px-4 rounded-xl bg-red-50 text-red-600 text-xs font-black"
              >
                Batalkan Jasa
              </button>
            </div>
          ) : needsAdminConfirmation ? (
            <div className="space-y-2.5">
              <p className="text-xs font-black text-[var(--vibe-text-main)]">
                {order.paymentMethod === 'qris'
                  ? 'Verifikasi Mutasi QRIS & Tugaskan Kurir'
                  : 'Konfirmasi COD & Tugaskan Kurir'}
              </p>
              <select
                value={defaultCourierId}
                onChange={(e) =>
                  setSelectedCourierByOrder((prev) => ({
                    ...prev,
                    [order._id]: e.target.value,
                  }))
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold text-[var(--vibe-text-main)]"
              >
                <option value="">-- Pilih Kurir Penjemput --</option>
                {couriers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.isActive ? '(Aktif)' : '(Nonaktif)'}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Catatan kurir (opsional)"
                value={notesByOrder[order._id] ?? order.courierNotes ?? ''}
                onChange={(e) =>
                  setNotesByOrder((prev) => ({
                    ...prev,
                    [order._id]: e.target.value,
                  }))
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold text-[var(--vibe-text-main)]"
              />

              <button
                type="button"
                disabled={busyOrderId === order._id}
                onClick={() => handleConfirmAndDispatch(order)}
                className="w-full py-3 px-4 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {busyOrderId === order._id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {order.paymentMethod === 'qris'
                        ? 'Konfirmasi Lunas & Kirim WA'
                        : 'Konfirmasi COD & Kirim WA'}
                    </span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-[var(--vibe-text-sub)] font-bold">
                <CreditCard className="w-4 h-4" />
                <span>
                  {order.paymentMethod === 'qris'
                    ? `QRIS (${order.paymentStatus === 'paid' ? 'Lunas' : 'Belum Lunas'})`
                    : order.status === 'completed'
                      ? 'Tunai (COD - Lunas)'
                      : 'Tunai (COD)'}
                </span>
              </div>

              {order.courier ? (
                <div className="flex items-center gap-2 bg-blue-50 text-blue-800 p-2.5 rounded-xl font-bold">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Kurir: {order.courier.name}</span>
                </div>
              ) : isActiveStage && order.orderCategory !== 'service' ? (
                <div className="space-y-2 bg-red-50 p-2.5 rounded-xl border border-red-200">
                  <p className="text-[11px] font-black text-red-700">
                    Kurir belum ditugaskan
                  </p>
                  <div className="flex gap-1.5">
                    <select
                      value={selectedCourierByOrder[order._id] || ''}
                      onChange={(e) =>
                        setSelectedCourierByOrder((prev) => ({
                          ...prev,
                          [order._id]: e.target.value,
                        }))
                      }
                      className="flex-1 p-1.5 rounded-lg bg-white border border-red-200 text-xs font-bold"
                    >
                      <option value="">Pilih kurir</option>
                      {couriers.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busyOrderId === order._id}
                      onClick={() => handleAssignCourierOnly(order)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white font-black text-[11px]"
                    >
                      Tugaskan
                    </button>
                  </div>
                </div>
              ) : null}

              {order.courierNotes && (
                <p className="text-[11px] bg-[var(--vibe-surface-sub)] p-2.5 rounded-xl text-[var(--vibe-text-sub)] font-bold">
                  Catatan: {order.courierNotes}
                </p>
              )}

              {isActiveStage && (
                <button
                  type="button"
                  disabled={busyOrderId === order._id}
                  onClick={() => handleQuickComplete(order)}
                  className="w-full py-2.5 px-3 rounded-xl bg-green-600 text-white text-xs font-black hover:bg-green-700 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Tandai Selesai</span>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-[var(--vibe-border)]">
            <button
              type="button"
              onClick={() =>
                setEditingOrder({
                  _id: order._id,
                  orderNumber: order.orderNumber,
                  status: order.status || 'pending',
                  paymentStatus: order.paymentStatus || 'unpaid',
                  courierId: order.courier?._id || '',
                  courierNotes: order.courierNotes || '',
                })
              }
              className="flex-1 py-2 px-3 rounded-xl bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-main)] text-xs font-black hover:opacity-80 inline-flex items-center justify-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Ubah Status</span>
            </button>
            <button
              type="button"
              disabled={busyOrderId === order._id}
              onClick={() => handleDeleteOrder(order)}
              className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              title="Hapus Pesanan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 1. Interactive KPI Row (Clickable Filters) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('needs_action')}
          className={`text-left p-4 rounded-2xl border transition-colors ${
            statusFilter === 'needs_action'
              ? 'bg-amber-50 border-amber-400'
              : 'bg-[var(--vibe-surface)] border-[var(--vibe-border)] hover:border-amber-300'
          }`}
        >
          <p className="text-xs font-bold text-amber-700">Perlu Tindakan</p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {kpiStats.needsAction}
          </p>
          <p className="text-[11px] font-bold text-[var(--vibe-text-sub)] mt-0.5">
            {kpiStats.pendingQris} QRIS • {kpiStats.pendingCod} COD
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(
              kpiStats.missingCourier > 0 && statusFilter === 'active_delivery'
                ? 'missing_courier'
                : 'active_delivery'
            )
          }
          className={`text-left p-4 rounded-2xl border transition-colors ${
            statusFilter === 'active_delivery' || statusFilter === 'missing_courier'
              ? 'bg-blue-50 border-blue-400'
              : 'bg-[var(--vibe-surface)] border-[var(--vibe-border)] hover:border-blue-300'
          }`}
        >
          <p className="text-xs font-bold text-blue-700">Proses / Kirim</p>
          <p className="text-2xl font-black text-blue-600 mt-1">
            {kpiStats.activeDelivery}
          </p>
          {kpiStats.missingCourier > 0 ? (
            <p className="text-[11px] font-black text-red-600 mt-0.5">
              {kpiStats.missingCourier} belum ada kurir
            </p>
          ) : (
            <p className="text-[11px] font-bold text-[var(--vibe-text-sub)] mt-0.5">
              Semua ada kurir
            </p>
          )}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('stuck')}
          className={`text-left p-4 rounded-2xl border transition-colors ${
            statusFilter === 'stuck'
              ? 'bg-orange-50 border-orange-400'
              : 'bg-[var(--vibe-surface)] border-[var(--vibe-border)] hover:border-orange-300'
          }`}
        >
          <p className="text-xs font-bold text-orange-700">
            Macet (&gt;{effectiveSop.sopStuckWarningHours} jam)
          </p>
          <p className="text-2xl font-black text-orange-600 mt-1">
            {kpiStats.stuck}
          </p>
          <p className="text-[11px] font-bold text-[var(--vibe-text-sub)] mt-0.5">
            Perlu pantau progres
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('problem')}
          className={`text-left p-4 rounded-2xl border transition-colors ${
            statusFilter === 'problem'
              ? 'bg-red-50 border-red-400'
              : 'bg-[var(--vibe-surface)] border-[var(--vibe-border)] hover:border-red-300'
          }`}
        >
          <p className="text-xs font-bold text-red-700">Bermasalah / Batal</p>
          <p className="text-2xl font-black text-red-600 mt-1">
            {kpiStats.problem}
          </p>
          <p className="text-[11px] font-bold text-[var(--vibe-text-sub)] mt-0.5">
            Pesanan gagal / batal
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('completed')}
          className={`col-span-2 md:col-span-1 text-left p-4 rounded-2xl border transition-colors ${
            statusFilter === 'completed'
              ? 'bg-green-50 border-green-400'
              : 'bg-[var(--vibe-surface)] border-[var(--vibe-border)] hover:border-green-300'
          }`}
        >
          <p className="text-xs font-bold text-green-700">Selesai & Omzet</p>
          <p className="text-2xl font-black text-green-600 mt-1">
            {kpiStats.completed}
          </p>
          <p className="text-[11px] font-black text-[var(--vibe-text-main)] mt-0.5">
            Rp {kpiStats.completedOmzet.toLocaleString('id-ID')}
          </p>
        </button>
      </div>

      {/* 2. SOP Auto-Cancel / Complete Control Banner */}
      {kpiStats.sopEligible > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-950">
                {kpiStats.sopEligible} pesanan melewati batas waktu
              </p>
              <p className="text-xs font-bold text-amber-800">
                Menunggu &gt;{effectiveSop.sopPendingCancelHours} jam • Selesai otomatis &gt;
                {effectiveSop.sopDeliveredCompleteHours} jam • Proses macet &gt;
                {effectiveSop.sopProcessingCancelHours} jam
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={sopLoading}
            onClick={handleOpenSopPreview}
            className="px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-black hover:bg-amber-700 transition-colors inline-flex items-center justify-center gap-2 flex-shrink-0"
          >
            {sopLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Rapikan Pesanan</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 3. Period, Grouping, View Mode, Search & CSV Export Bar */}
      <div className="bg-[var(--vibe-surface)] p-4 rounded-2xl border border-[var(--vibe-border)] space-y-3">
        {/* Row A: Status Filters + Search */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: `Semua (${orders.length})` },
              { id: 'pending_qris', label: 'Verifikasi QRIS' },
              { id: 'pending_cod', label: 'Konfirmasi COD' },
              { id: 'active_delivery', label: 'Sedang Berjalan' },
              { id: 'missing_courier', label: 'Tanpa Kurir' },
              { id: 'completed', label: 'Selesai' },
              { id: 'problem', label: 'Bermasalah / Batal' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as StatusFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-[var(--vibe-accent-1)] text-white'
                    : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)] hover:text-[var(--vibe-text-main)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-grow lg:w-72">
              <Search className="w-4 h-4 text-[var(--vibe-text-muted)] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari order, warga, produk, UMKM, kurir"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold text-[var(--vibe-text-main)] outline-none focus:border-[var(--vibe-accent-1)]"
              />
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-black text-[var(--vibe-text-main)] hover:bg-[var(--vibe-accent-1-lt)] inline-flex items-center gap-1.5 flex-shrink-0"
              title="Unduh Data CSV untuk Excel"
            >
              <Download className="w-4 h-4 text-[var(--vibe-accent-1)]" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Row B: Period Filter + GroupBy + View Switch + Hide Test */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--vibe-border)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black text-[var(--vibe-text-sub)] inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Periode:
            </span>
            {[
              { id: 'all', label: 'Semua Waktu' },
              { id: 'today', label: 'Hari Ini' },
              { id: 'week', label: 'Minggu Ini' },
              { id: 'month', label: 'Bulan Ini' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPeriodFilter(p.id as PeriodFilter)
                  setSelectedMonth('all')
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  periodFilter === p.id && selectedMonth === 'all'
                    ? 'bg-[var(--vibe-text-main)] text-white'
                    : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]'
                }`}
              >
                {p.label}
              </button>
            ))}

            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value)
                if (e.target.value !== 'all') setPeriodFilter('all')
              }}
              className="px-2.5 py-1 rounded-lg bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold text-[var(--vibe-text-main)]"
            >
              <option value="all">Pilih Bulan...</option>
              {availableMonths.map(([ym, label]) => (
                <option key={ym} value={ym}>
                  {label}
                </option>
              ))}
            </select>

            <span className="text-[11px] font-black text-[var(--vibe-text-sub)] ml-2">
              Kelompok:
            </span>
            <select
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value as GroupByMode)
                setActiveGroupKey(undefined)
                setExpandedRowId(null)
              }}
              className="px-2.5 py-1 rounded-lg bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold text-[var(--vibe-text-main)]"
            >
              <option value="month">Per Bulan</option>
              <option value="week">Per Minggu</option>
              <option value="day">Per Tanggal</option>
              <option value="none">Tanpa Kelompok</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--vibe-text-sub)] cursor-pointer">
              <input
                type="checkbox"
                checked={hideTestOrders}
                onChange={(e) => setHideTestOrders(e.target.checked)}
              />
              <span>Sembunyikan Order Test</span>
            </label>

            <div className="inline-flex rounded-xl bg-[var(--vibe-surface-sub)] p-1 border border-[var(--vibe-border)]">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black inline-flex items-center gap-1 ${
                  viewMode === 'table'
                    ? 'bg-[var(--vibe-surface)] text-[var(--vibe-text-main)]'
                    : 'text-[var(--vibe-text-sub)]'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Ringkas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black inline-flex items-center gap-1 ${
                  viewMode === 'cards'
                    ? 'bg-[var(--vibe-surface)] text-[var(--vibe-text-main)]'
                    : 'text-[var(--vibe-text-sub)]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Kartu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Grouped Orders List */}
      <div className="space-y-4">
        {groupedOrders.map((group, gIdx) => {
          const open = isGroupOpen(group.key, gIdx)
          return (
            <div key={group.key} className="space-y-3">
              {groupBy !== 'none' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveGroupKey(open ? null : group.key)
                    setExpandedRowId(null)
                  }}
                  className="w-full bg-[var(--vibe-surface)] px-4 py-3 rounded-2xl border border-[var(--vibe-border)] flex flex-wrap items-center justify-between gap-2 hover:border-[var(--vibe-accent-1)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {open ? (
                      <ChevronDown className="w-4 h-4 text-[var(--vibe-accent-1)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--vibe-text-sub)]" />
                    )}
                    <span className="text-sm font-black text-[var(--vibe-text-main)]">
                      {group.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--vibe-surface-sub)] text-xs font-black text-[var(--vibe-text-sub)]">
                      {group.orders.length} transaksi
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-bold text-[var(--vibe-text-sub)]">
                    <span>
                      Selesai:{' '}
                      <strong className="text-[var(--vibe-text-main)]">
                        {group.completedCount}
                      </strong>
                    </span>
                    <span>
                      Omzet Selesai:{' '}
                      <strong className="text-[var(--vibe-accent-1)]">
                        Rp {group.omzet.toLocaleString('id-ID')}
                      </strong>
                    </span>
                  </div>
                </button>
              )}

              {open && (
                <>
                  {viewMode === 'cards' ? (
                    <div className="space-y-4">
                      {group.orders.map((order) => renderOrderCard(order))}
                    </div>
                  ) : (
                    <div className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[var(--vibe-surface-sub)] border-b border-[var(--vibe-border)] text-[var(--vibe-text-sub)] font-black uppercase">
                              <th className="py-3 px-4">Order & Waktu</th>
                              <th className="py-3 px-4">Warga</th>
                              <th className="py-3 px-4">Item / UMKM</th>
                              <th className="py-3 px-4">Total & Metode</th>
                              <th className="py-3 px-4">Kurir</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-right">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--vibe-border)]">
                            {group.orders.map((order) => {
                              const badge = getStatusBadge(order)
                              const age = formatRelativeAge(
                                order._updatedAt || order._createdAt
                              )
                              const isExpanded = expandedRowId === order._id
                              const isActiveStage = [
                                'accepted',
                                'processing',
                                'shipped',
                                'delivering',
                                'delivered',
                              ].includes(order.status)
                              const isMissingCourier =
                                isActiveStage &&
                                order.orderCategory !== 'service' &&
                                !order.courier?._id

                              const itemSummary =
                                order.orderCategory === 'service' && order.serviceItem
                                  ? `[Jasa] ${order.serviceItem.name}`
                                  : (order.items || [])
                                      .map(
                                        (i: any) =>
                                          `${i.product?.name || 'Produk'} x${i.quantity}`
                                      )
                                      .join(', ')

                              return (
                                <React.Fragment key={order._id}>
                                  <tr
                                    onClick={() =>
                                      setExpandedRowId(isExpanded ? null : order._id)
                                    }
                                    className="hover:bg-[var(--vibe-surface-sub)]/60 cursor-pointer transition-colors"
                                  >
                                    <td className="py-3 px-4 align-top">
                                      <p
                                        style={{ fontFamily: 'var(--vibe-font-mono)' }}
                                        className="font-black text-[var(--vibe-text-main)]"
                                      >
                                        {order.orderNumber}
                                      </p>
                                      <p className="text-[11px] text-[var(--vibe-text-sub)] font-bold mt-0.5">
                                        {new Date(order._createdAt).toLocaleString(
                                          'id-ID',
                                          { dateStyle: 'short', timeStyle: 'short' }
                                        )}{' '}
                                        ({age.label})
                                      </p>
                                    </td>
                                    <td className="py-3 px-4 align-top">
                                      <p className="font-black text-[var(--vibe-text-main)]">
                                        {order.customerName}
                                      </p>
                                      <p className="text-[11px] text-[var(--vibe-text-sub)] font-bold">
                                        {order.customerPhone}
                                      </p>
                                    </td>
                                    <td className="py-3 px-4 align-top max-w-xs">
                                      <p className="font-bold text-[var(--vibe-text-main)] line-clamp-2">
                                        {itemSummary || '-'}
                                      </p>
                                    </td>
                                    <td className="py-3 px-4 align-top">
                                      <p className="font-black text-[var(--vibe-accent-1)]">
                                        Rp {(order.totalAmount || 0).toLocaleString('id-ID')}
                                      </p>
                                      <p className="text-[11px] font-bold text-[var(--vibe-text-sub)]">
                                        {order.paymentMethod === 'qris'
                                          ? order.paymentStatus === 'paid'
                                            ? 'QRIS (Lunas)'
                                            : 'QRIS (Belum Lunas)'
                                          : 'COD'}
                                      </p>
                                    </td>
                                    <td className="py-3 px-4 align-top">
                                      {order.courier?.name ? (
                                        <span className="font-bold text-blue-700">
                                          {order.courier.name}
                                        </span>
                                      ) : isMissingCourier ? (
                                        <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-black text-[10px]">
                                          Belum Ada Kurir
                                        </span>
                                      ) : (
                                        <span className="text-[var(--vibe-text-muted)]">
                                          -
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 align-top">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-black ${badge.cls}`}
                                      >
                                        {badge.icon}
                                        <span>{badge.label}</span>
                                      </span>
                                    </td>
                                    <td
                                      className="py-3 px-4 align-top text-right"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedRowId(
                                            isExpanded ? null : order._id
                                          )
                                        }
                                        className="px-2.5 py-1.5 rounded-lg bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-main)] font-black hover:opacity-80"
                                      >
                                        {isExpanded ? 'Tutup' : 'Kelola'}
                                      </button>
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={7} className="p-3 bg-[var(--vibe-background)]">
                                        {renderOrderCard(order)}
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}

        {filteredOrders.length === 0 && (
          <div className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-12 text-center">
            <Package className="w-12 h-12 text-[var(--vibe-text-muted)] mx-auto mb-3" />
            <p className="text-base font-black text-[var(--vibe-text-main)]">
              Belum ada pesanan pada filter & periode ini
            </p>
          </div>
        )}
      </div>

      {/* Auto Close Confirmation Modal */}
      {sopModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                Tutup Pesanan Melewati Batas Waktu
              </h3>
              <button
                type="button"
                onClick={() => setSopModal(null)}
                className="p-1.5 rounded-lg bg-[var(--vibe-surface-sub)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <p className="text-xl font-black text-red-700">
                  {sopModal.counts.cancelPending}
                </p>
                <p className="text-[11px] font-bold text-red-800">
                  Menunggu &gt;{sopModal.config.sopPendingCancelHours}j Batal
                </p>
              </div>
              <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                <p className="text-xl font-black text-green-700">
                  {sopModal.counts.completeDelivered}
                </p>
                <p className="text-[11px] font-bold text-green-800">
                  Diterima &gt;{sopModal.config.sopDeliveredCompleteHours}j Selesai
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xl font-black text-amber-700">
                  {sopModal.counts.cancelStuck}
                </p>
                <p className="text-[11px] font-bold text-amber-800">
                  Macet &gt;{sopModal.config.sopProcessingCancelHours}j Tutup
                </p>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto bg-[var(--vibe-surface-sub)] rounded-xl p-3 space-y-1.5 text-xs">
              {sopModal.candidates.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between gap-2 border-b border-[var(--vibe-border)] pb-1 last:border-0"
                >
                  <span className="font-black text-[var(--vibe-text-main)]">
                    {c.orderNumber} ({c.customerName})
                  </span>
                  <span className="text-[11px] font-bold text-[var(--vibe-text-sub)]">
                    {c.ageHours} jam •{' '}
                    {c.isLegacySilent ? 'Tutup Tanpa WA (>7 hari)' : 'Kirim WA'}
                  </span>
                </div>
              ))}
            </div>

            <label className="flex items-start gap-2 text-xs font-bold text-[var(--vibe-text-main)] cursor-pointer">
              <input
                type="checkbox"
                checked={sopSendWa}
                onChange={(e) => setSopSendWa(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Kirim pesan WA hanya untuk pesanan 7 hari terakhir (pesanan lama ditutup tanpa pesan).
              </span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSopModal(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={sopLoading || sopModal.counts.totalAffected === 0}
                onClick={handleExecuteSop}
                className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-xs font-black hover:bg-amber-700 disabled:opacity-50"
              >
                {sopLoading
                  ? 'Memproses...'
                  : `Jalankan (${sopModal.counts.totalAffected} Pesanan)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveManualEdit}
            className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-6 w-full max-w-md space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                Ubah Pesanan {editingOrder.orderNumber}
              </h3>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1.5 rounded-lg bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Status Pesanan
              </label>
              <select
                value={editingOrder.status}
                onChange={(e) =>
                  setEditingOrder({ ...editingOrder, status: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              >
                <option value="pending">Menunggu Konfirmasi</option>
                <option value="accepted">Kurir Menjemput / Penjual Sanggup</option>
                <option value="processing">Disiapkan Penjual</option>
                <option value="shipped">Diambil Kurir</option>
                <option value="delivering">Dalam Perjalanan</option>
                <option value="delivered">Sudah Diserahkan ke Pembeli</option>
                <option value="completed">Selesai</option>
                <option value="cancelled">Dibatalkan</option>
                <option value="problem">Ada Kendala</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Status Pembayaran
              </label>
              <select
                value={editingOrder.paymentStatus}
                onChange={(e) =>
                  setEditingOrder({
                    ...editingOrder,
                    paymentStatus: e.target.value as 'unpaid' | 'paid',
                  })
                }
                className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              >
                <option value="unpaid">Belum Dibayar</option>
                <option value="paid">Sudah Dibayar / Lunas</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Kurir Bertugas
              </label>
              <select
                value={editingOrder.courierId}
                onChange={(e) =>
                  setEditingOrder({ ...editingOrder, courierId: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              >
                <option value="">-- Belum Ditentukan --</option>
                {couriers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Catatan Kurir
              </label>
              <textarea
                rows={2}
                value={editingOrder.courierNotes}
                onChange={(e) =>
                  setEditingOrder({ ...editingOrder, courierNotes: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busyOrderId === editingOrder._id}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
