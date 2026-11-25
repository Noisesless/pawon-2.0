'use client'

import React, { useState } from 'react'
import {
  Store,
  Truck,
  Users,
  Plus,
  Edit3,
  Trash2,
  CheckCircle,
  Power,
  KeyRound,
  Upload,
  Loader2,
  X,
} from 'lucide-react'
import {
  saveVendor,
  saveCourier,
  saveCustomer,
  adminDeleteDocument,
  uploadAdminImage,
} from '@/app/actions/admin'

interface AdminPartnersTabProps {
  vendors: any[]
  couriers: any[]
  customers: any[]
  onRefresh: () => Promise<void>
}

export default function AdminPartnersTab({
  vendors,
  couriers,
  customers,
  onRefresh,
}: AdminPartnersTabProps) {
  const [subTab, setSubTab] = useState<'vendors' | 'couriers' | 'customers'>('vendors')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [vendorModal, setVendorModal] = useState<any | null>(null)
  const [courierModal, setCourierModal] = useState<any | null>(null)
  const [customerModal, setCustomerModal] = useState<any | null>(null)

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (assetId: string, url: string) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadAdminImage(fd)
    setUploading(false)
    if (res.success && res.assetId && res.url) {
      onSuccess(res.assetId, res.url)
    } else {
      alert(res.error || 'Gagal mengunggah gambar.')
    }
  }

  const handleQuickToggleVendor = async (
    vendor: any,
    field: 'isVerified' | 'isOpen'
  ) => {
    setBusyId(vendor._id)
    const res = await saveVendor({
      _id: vendor._id,
      name: vendor.name,
      phone: vendor.phone,
      pin: vendor.pin || '123456',
      address: vendor.address || '',
      description: vendor.description || '',
      businessType: vendor.businessType || 'product',
      isOpen: field === 'isOpen' ? !vendor.isOpen : Boolean(vendor.isOpen),
      closingMessage: vendor.closingMessage || '',
      isVerified:
        field === 'isVerified' ? !vendor.isVerified : Boolean(vendor.isVerified),
      logoAssetId: vendor.logoAssetId,
    })
    setBusyId(null)
    if (res.success) await onRefresh()
    else alert(res.error)
  }

  const handleQuickToggleCourier = async (courier: any) => {
    setBusyId(courier._id)
    const res = await saveCourier({
      _id: courier._id,
      name: courier.name,
      phone: courier.phone,
      pin: courier.pin || '123456',
      isActive: !courier.isActive,
      statusMessage: courier.statusMessage || '',
    })
    setBusyId(null)
    if (res.success) await onRefresh()
    else alert(res.error)
  }

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Hapus ${label} secara permanen?`)) return
    setBusyId(id)
    const res = await adminDeleteDocument(id)
    setBusyId(null)
    if (res.success) await onRefresh()
    else alert(res.error)
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation + Add button */}
      <div className="bg-[var(--vibe-surface)] p-4 rounded-2xl border border-[var(--vibe-border)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('vendors')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black inline-flex items-center gap-2 ${
              subTab === 'vendors'
                ? 'bg-[var(--vibe-accent-1)] text-white'
                : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Penjual UMKM ({vendors.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('couriers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black inline-flex items-center gap-2 ${
              subTab === 'couriers'
                ? 'bg-[var(--vibe-accent-1)] text-white'
                : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Kurir Kalurahan ({couriers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('customers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black inline-flex items-center gap-2 ${
              subTab === 'customers'
                ? 'bg-[var(--vibe-accent-1)] text-white'
                : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Data Warga ({customers.length})</span>
          </button>
        </div>

        {subTab === 'vendors' && (
          <button
            type="button"
            onClick={() =>
              setVendorModal({
                name: '',
                phone: '',
                pin: '123456',
                address: '',
                description: '',
                businessType: 'product',
                isOpen: true,
                closingMessage: '',
                isVerified: true,
                logoAssetId: '',
                logoUrl: '',
              })
            }
            className="px-4 py-2.5 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah UMKM</span>
          </button>
        )}

        {subTab === 'couriers' && (
          <button
            type="button"
            onClick={() =>
              setCourierModal({
                name: '',
                phone: '',
                pin: '123456',
                isActive: true,
                statusMessage: '',
              })
            }
            className="px-4 py-2.5 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kurir</span>
          </button>
        )}

        {subTab === 'customers' && (
          <button
            type="button"
            onClick={() =>
              setCustomerModal({
                name: '',
                phone: '',
                address: '',
                pin: '123456',
                isVerified: true,
              })
            }
            className="px-4 py-2.5 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Warga</span>
          </button>
        )}
      </div>

      {/* 1. VENDORS LIST */}
      {subTab === 'vendors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vendors.map((v) => (
            <div
              key={v._id}
              className="bg-[var(--vibe-surface)] p-5 rounded-2xl border border-[var(--vibe-border)] flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {v.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.logoUrl}
                      alt={v.name}
                      className="w-12 h-12 rounded-xl object-cover border border-[var(--vibe-border)]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[var(--vibe-surface-sub)] flex items-center justify-center text-[var(--vibe-text-sub)] font-black">
                      {v.name?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h4 className="text-base font-black text-[var(--vibe-text-main)]">
                      {v.name}
                    </h4>
                    <p className="text-xs font-bold text-[var(--vibe-text-sub)]">
                      WA: {v.phone} • PIN: {v.pin || '123456'}
                    </p>
                    <p className="text-[11px] font-bold text-[var(--vibe-text-sub)] mt-0.5">
                      {v.businessType === 'service' ? 'Jasa & Layanan' : 'Produk Barang'} •{' '}
                      {v.address || 'Pondokrejo'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--vibe-border)]">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === v._id}
                    onClick={() => handleQuickToggleVendor(v, 'isVerified')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 ${
                      v.isVerified
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{v.isVerified ? 'Terverifikasi' : 'Belum Verifikasi'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyId === v._id}
                    onClick={() => handleQuickToggleVendor(v, 'isOpen')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 ${
                      v.isOpen
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{v.isOpen ? 'Toko Buka' : 'Toko Tutup'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVendorModal({ ...v })}
                    className="p-2 rounded-xl bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-main)]"
                    title="Edit UMKM"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(v._id, `UMKM ${v.name}`)}
                    className="p-2 rounded-xl bg-red-50 text-red-600"
                    title="Hapus UMKM"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. COURIERS LIST */}
      {subTab === 'couriers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {couriers.map((c) => (
            <div
              key={c._id}
              className="bg-[var(--vibe-surface)] p-5 rounded-2xl border border-[var(--vibe-border)] flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-base font-black text-[var(--vibe-text-main)]">
                    {c.name}
                  </h4>
                  <button
                    type="button"
                    disabled={busyId === c._id}
                    onClick={() => handleQuickToggleCourier(c)}
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      c.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {c.isActive ? 'Aktif Bertugas' : 'Libur / Nonaktif'}
                  </button>
                </div>
                <p className="text-xs font-bold text-[var(--vibe-text-sub)] mt-1">
                  WA: {c.phone}
                </p>
                <p className="text-xs font-bold text-[var(--vibe-text-sub)] inline-flex items-center gap-1 mt-0.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>PIN Portal: {c.pin || '123456'}</span>
                </p>
                {c.statusMessage && (
                  <p className="text-xs bg-[var(--vibe-surface-sub)] p-2 rounded-xl mt-2 font-bold text-[var(--vibe-text-sub)]">
                    Status: {c.statusMessage}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--vibe-border)]">
                <button
                  type="button"
                  onClick={() => setCourierModal({ ...c })}
                  className="px-3 py-1.5 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Ubah</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c._id, `Kurir ${c.name}`)}
                  className="p-2 rounded-xl bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. CUSTOMERS LIST */}
      {subTab === 'customers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((cust) => (
            <div
              key={cust._id}
              className="bg-[var(--vibe-surface)] p-5 rounded-2xl border border-[var(--vibe-border)] flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-black text-[var(--vibe-text-main)]">
                    {cust.name}
                  </h4>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                      cust.isVerified
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cust.isVerified ? 'Warga Terverifikasi' : 'Belum Verifikasi'}
                  </span>
                </div>
                <p className="text-xs font-bold text-[var(--vibe-text-sub)] mt-1">
                  WA: {cust.phone} • PIN: {cust.pin || '123456'}
                </p>
                <p className="text-xs text-[var(--vibe-text-sub)] mt-1 line-clamp-2">
                  {cust.address}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--vibe-border)]">
                <button
                  type="button"
                  onClick={() => setCustomerModal({ ...cust })}
                  className="px-3 py-1.5 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Ubah</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(cust._id, `Data Warga ${cust.name}`)}
                  className="p-2 rounded-xl bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VENDOR MODAL */}
      {vendorModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusyId('saving-vendor')
              const res = await saveVendor(vendorModal)
              setBusyId(null)
              if (res.success) {
                setVendorModal(null)
                await onRefresh()
              } else alert(res.error)
            }}
            className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-6 w-full max-w-lg space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                {vendorModal._id ? 'Edit Penjual UMKM' : 'Tambah Penjual UMKM'}
              </h3>
              <button
                type="button"
                onClick={() => setVendorModal(null)}
                className="p-1.5 rounded-lg bg-[var(--vibe-surface-sub)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Nama Lapak UMKM *
                </label>
                <input
                  required
                  type="text"
                  value={vendorModal.name}
                  onChange={(e) =>
                    setVendorModal({ ...vendorModal, name: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Nomor WhatsApp *
                </label>
                <input
                  required
                  type="text"
                  value={vendorModal.phone}
                  onChange={(e) =>
                    setVendorModal({ ...vendorModal, phone: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  PIN Login Portal (/lapak)
                </label>
                <input
                  type="text"
                  value={vendorModal.pin || ''}
                  onChange={(e) =>
                    setVendorModal({ ...vendorModal, pin: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Jenis Usaha
                </label>
                <select
                  value={vendorModal.businessType || 'product'}
                  onChange={(e) =>
                    setVendorModal({ ...vendorModal, businessType: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                >
                  <option value="product">Produk Barang</option>
                  <option value="service">Jasa & Layanan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Alamat Pedukuhan
              </label>
              <input
                type="text"
                value={vendorModal.address || ''}
                onChange={(e) =>
                  setVendorModal({ ...vendorModal, address: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Deskripsi Singkat
              </label>
              <textarea
                rows={2}
                value={vendorModal.description || ''}
                onChange={(e) =>
                  setVendorModal({ ...vendorModal, description: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Logo UMKM
              </label>
              <div className="flex items-center gap-3">
                {vendorModal.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={vendorModal.logoUrl}
                    alt="Logo"
                    className="w-12 h-12 rounded-xl object-cover border"
                  />
                )}
                <label className="px-3 py-2 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-black cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Mengunggah...' : 'Pilih Foto Logo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleImageUpload(e, (assetId, url) =>
                        setVendorModal({
                          ...vendorModal,
                          logoAssetId: assetId,
                          logoUrl: url,
                        })
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-black">
                <input
                  type="checkbox"
                  checked={Boolean(vendorModal.isVerified)}
                  onChange={(e) =>
                    setVendorModal({ ...vendorModal, isVerified: e.target.checked })
                  }
                />
                <span>Terverifikasi Kalurahan</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-black">
                <input
                  type="checkbox"
                  checked={Boolean(vendorModal.isOpen)}
                  onChange={(e) =>
                    setVendorModal({ ...vendorModal, isOpen: e.target.checked })
                  }
                />
                <span>Status Toko Buka</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVendorModal(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busyId === 'saving-vendor' || uploading}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
              >
                {busyId === 'saving-vendor' ? 'Menyimpan...' : 'Simpan UMKM'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* COURIER MODAL */}
      {courierModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusyId('saving-courier')
              const res = await saveCourier(courierModal)
              setBusyId(null)
              if (res.success) {
                setCourierModal(null)
                await onRefresh()
              } else alert(res.error)
            }}
            className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-6 w-full max-w-md space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                {courierModal._id ? 'Edit Kurir Kalurahan' : 'Tambah Kurir Kalurahan'}
              </h3>
              <button
                type="button"
                onClick={() => setCourierModal(null)}
                className="p-1.5 rounded-lg bg-[var(--vibe-surface-sub)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Nama Kurir *
              </label>
              <input
                required
                type="text"
                value={courierModal.name}
                onChange={(e) =>
                  setCourierModal({ ...courierModal, name: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Nomor WhatsApp *
              </label>
              <input
                required
                type="text"
                value={courierModal.phone}
                onChange={(e) =>
                  setCourierModal({ ...courierModal, phone: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                PIN Login Portal (/kurir)
              </label>
              <input
                type="text"
                value={courierModal.pin || ''}
                onChange={(e) =>
                  setCourierModal({ ...courierModal, pin: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-black">
              <input
                type="checkbox"
                checked={Boolean(courierModal.isActive)}
                onChange={(e) =>
                  setCourierModal({ ...courierModal, isActive: e.target.checked })
                }
              />
              <span>Kurir Aktif Bertugas</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCourierModal(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busyId === 'saving-courier'}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
              >
                Simpan Kurir
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CUSTOMER MODAL */}
      {customerModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusyId('saving-customer')
              const res = await saveCustomer(customerModal)
              setBusyId(null)
              if (res.success) {
                setCustomerModal(null)
                await onRefresh()
              } else alert(res.error)
            }}
            className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-6 w-full max-w-md space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                {customerModal._id ? 'Edit Data Warga' : 'Tambah Data Warga'}
              </h3>
              <button
                type="button"
                onClick={() => setCustomerModal(null)}
                className="p-1.5 rounded-lg bg-[var(--vibe-surface-sub)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Nama Lengkap *
              </label>
              <input
                required
                type="text"
                value={customerModal.name}
                onChange={(e) =>
                  setCustomerModal({ ...customerModal, name: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Nomor WhatsApp *
              </label>
              <input
                required
                type="text"
                value={customerModal.phone}
                onChange={(e) =>
                  setCustomerModal({ ...customerModal, phone: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Alamat Lengkap
              </label>
              <textarea
                rows={2}
                value={customerModal.address || ''}
                onChange={(e) =>
                  setCustomerModal({ ...customerModal, address: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                PIN Warga
              </label>
              <input
                type="text"
                value={customerModal.pin || ''}
                onChange={(e) =>
                  setCustomerModal({ ...customerModal, pin: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-black">
              <input
                type="checkbox"
                checked={Boolean(customerModal.isVerified)}
                onChange={(e) =>
                  setCustomerModal({
                    ...customerModal,
                    isVerified: e.target.checked,
                  })
                }
              />
              <span>Warga Terverifikasi</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomerModal(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busyId === 'saving-customer'}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
              >
                Simpan Warga
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
