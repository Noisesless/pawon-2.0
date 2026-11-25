'use client'

import React, { useState } from 'react'
import {
  ShoppingBag,
  Wrench,
  Tags,
  Plus,
  Edit3,
  Trash2,
  Upload,
  Star,
  Percent,
  X,
} from 'lucide-react'
import {
  saveProduct,
  saveService,
  saveCategory,
  adminDeleteDocument,
  uploadAdminImage,
} from '@/app/actions/admin'

interface AdminCatalogTabProps {
  products: any[]
  services: any[]
  categories: any[]
  vendors: any[]
  onRefresh: () => Promise<void>
}

export default function AdminCatalogTab({
  products,
  services,
  categories,
  vendors,
  onRefresh,
}: AdminCatalogTabProps) {
  const [subTab, setSubTab] = useState<'products' | 'services' | 'categories'>('products')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [productModal, setProductModal] = useState<any | null>(null)
  const [serviceModal, setServiceModal] = useState<any | null>(null)
  const [categoryModal, setCategoryModal] = useState<any | null>(null)

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    cb: (assetId: string, url: string) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadAdminImage(fd)
    setUploading(false)
    if (res.success && res.assetId && res.url) {
      cb(res.assetId, res.url)
    } else {
      alert(res.error || 'Gagal mengunggah gambar.')
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Hapus ${title} secara permanen?`)) return
    setBusyId(id)
    const res = await adminDeleteDocument(id)
    setBusyId(null)
    if (res.success) await onRefresh()
    else alert(res.error)
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="bg-[var(--vibe-surface)] p-4 rounded-2xl border border-[var(--vibe-border)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('products')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black inline-flex items-center gap-2 ${
              subTab === 'products'
                ? 'bg-[var(--vibe-accent-1)] text-white'
                : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Produk Barang ({products.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('services')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black inline-flex items-center gap-2 ${
              subTab === 'services'
                ? 'bg-[var(--vibe-accent-1)] text-white'
                : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Jasa & Layanan ({services.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('categories')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black inline-flex items-center gap-2 ${
              subTab === 'categories'
                ? 'bg-[var(--vibe-accent-1)] text-white'
                : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]'
            }`}
          >
            <Tags className="w-4 h-4" />
            <span>Kategori ({categories.length})</span>
          </button>
        </div>

        {subTab === 'products' && (
          <button
            type="button"
            onClick={() =>
              setProductModal({
                name: '',
                vendorId: vendors[0]?._id || '',
                categoryIds: [],
                price: 15000,
                stock: 20,
                description: '',
                isBestSeller: false,
                isPromo: false,
                promoDiscount: 10,
                imageAssetId: '',
                imageUrl: '',
              })
            }
            className="px-4 py-2.5 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk</span>
          </button>
        )}

        {subTab === 'services' && (
          <button
            type="button"
            onClick={() =>
              setServiceModal({
                name: '',
                vendorId: vendors[0]?._id || '',
                categoryIds: [],
                price: 50000,
                priceType: 'starting_from',
                description: '',
                isBestSeller: false,
                isPromo: false,
                promoDiscount: 10,
                imageAssetId: '',
                imageUrl: '',
              })
            }
            className="px-4 py-2.5 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Jasa</span>
          </button>
        )}

        {subTab === 'categories' && (
          <button
            type="button"
            onClick={() =>
              setCategoryModal({
                name: '',
                description: '',
                imageAssetId: '',
                imageUrl: '',
              })
            }
            className="px-4 py-2.5 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kategori</span>
          </button>
        )}
      </div>

      {/* 1. PRODUCTS GRID */}
      {subTab === 'products' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p._id}
              className="bg-[var(--vibe-surface)] p-4 rounded-2xl border border-[var(--vibe-border)] flex flex-col justify-between gap-3"
            >
              <div className="flex gap-3">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-16 h-16 rounded-xl object-cover border border-[var(--vibe-border)] flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[var(--vibe-surface-sub)] flex items-center justify-center text-xs font-bold text-[var(--vibe-text-sub)] flex-shrink-0">
                    Foto
                  </div>
                )}
                <div className="flex-grow">
                  <p className="text-[11px] font-bold text-[var(--vibe-accent-1)]">
                    {p.vendorName || 'UMKM'}
                  </p>
                  <h4 className="text-sm font-black text-[var(--vibe-text-main)] line-clamp-1">
                    {p.name}
                  </h4>
                  <p className="text-sm font-black text-[var(--vibe-text-main)] mt-1">
                    Rp {(p.price || 0).toLocaleString('id-ID')}{' '}
                    <span className="text-xs font-bold text-[var(--vibe-text-sub)]">
                      • Stok: {p.stock ?? 0}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--vibe-border)]">
                <div className="flex gap-1.5">
                  {p.isBestSeller && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black inline-flex items-center gap-1">
                      <Star className="w-3 h-3" /> Terlaris
                    </span>
                  )}
                  {p.isPromo && (
                    <span className="px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] font-black inline-flex items-center gap-1">
                      <Percent className="w-3 h-3" /> -{p.promoDiscount || 10}%
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setProductModal({
                        ...p,
                        categoryIds: p.categoryIds || [],
                      })
                    }
                    className="p-2 rounded-xl bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-main)]"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p._id, `Produk ${p.name}`)}
                    className="p-2 rounded-xl bg-red-50 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. SERVICES GRID */}
      {subTab === 'services' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <div
              key={s._id}
              className="bg-[var(--vibe-surface)] p-4 rounded-2xl border border-[var(--vibe-border)] flex flex-col justify-between gap-3"
            >
              <div className="flex gap-3">
                {s.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.imageUrl}
                    alt={s.name}
                    className="w-16 h-16 rounded-xl object-cover border border-[var(--vibe-border)] flex-shrink-0"
                  />
                )}
                <div>
                  <p className="text-[11px] font-bold text-[var(--vibe-accent-1)]">
                    {s.vendorName || 'Penyedia Jasa'}
                  </p>
                  <h4 className="text-sm font-black text-[var(--vibe-text-main)]">
                    {s.name}
                  </h4>
                  <p className="text-sm font-black text-[var(--vibe-text-main)] mt-1">
                    Rp {(s.price || 0).toLocaleString('id-ID')}{' '}
                    <span className="text-xs font-bold text-[var(--vibe-text-sub)]">
                      ({s.priceType || 'starting_from'})
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-1.5 pt-3 border-t border-[var(--vibe-border)]">
                <button
                  type="button"
                  onClick={() =>
                    setServiceModal({
                      ...s,
                      categoryIds: s.categoryIds || [],
                    })
                  }
                  className="p-2 rounded-xl bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-main)]"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s._id, `Jasa ${s.name}`)}
                  className="p-2 rounded-xl bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. CATEGORIES GRID */}
      {subTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div
              key={cat._id}
              className="bg-[var(--vibe-surface)] p-4 rounded-2xl border border-[var(--vibe-border)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                {cat.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cat.imageUrl}
                    alt={cat.name}
                    className="w-10 h-10 rounded-xl object-cover border"
                  />
                )}
                <div>
                  <h4 className="text-sm font-black text-[var(--vibe-text-main)]">
                    {cat.name}
                  </h4>
                  {cat.description && (
                    <p className="text-xs text-[var(--vibe-text-sub)] line-clamp-1">
                      {cat.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setCategoryModal({ ...cat })}
                  className="p-2 rounded-xl bg-[var(--vibe-surface-sub)]"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(cat._id, `Kategori ${cat.name}`)}
                  className="p-2 rounded-xl bg-red-50 text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PRODUCT MODAL */}
      {productModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusyId('saving-product')
              const res = await saveProduct(productModal)
              setBusyId(null)
              if (res.success) {
                setProductModal(null)
                await onRefresh()
              } else alert(res.error)
            }}
            className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-6 w-full max-w-lg space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                {productModal._id ? 'Edit Produk UMKM' : 'Tambah Produk UMKM'}
              </h3>
              <button
                type="button"
                onClick={() => setProductModal(null)}
                className="p-1.5 rounded-lg bg-[var(--vibe-surface-sub)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Nama Produk *
              </label>
              <input
                required
                type="text"
                value={productModal.name}
                onChange={(e) =>
                  setProductModal({ ...productModal, name: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Penjual (UMKM) *
                </label>
                <select
                  required
                  value={productModal.vendorId}
                  onChange={(e) =>
                    setProductModal({ ...productModal, vendorId: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold"
                >
                  <option value="">-- Pilih UMKM --</option>
                  {vendors.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Harga (Rp) *
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  value={productModal.price}
                  onChange={(e) =>
                    setProductModal({
                      ...productModal,
                      price: Number(e.target.value),
                    })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Stok *
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  value={productModal.stock}
                  onChange={(e) =>
                    setProductModal({
                      ...productModal,
                      stock: Number(e.target.value),
                    })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Kategori
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const checked = (productModal.categoryIds || []).includes(cat._id)
                  return (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => {
                        const prev = productModal.categoryIds || []
                        setProductModal({
                          ...productModal,
                          categoryIds: checked
                            ? prev.filter((id: string) => id !== cat._id)
                            : [...prev, cat._id],
                        })
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                        checked
                          ? 'bg-[var(--vibe-accent-1-lt)] border-[var(--vibe-accent-1)] text-[var(--vibe-accent-1)]'
                          : 'bg-[var(--vibe-surface-sub)] border-[var(--vibe-border)] text-[var(--vibe-text-sub)]'
                      }`}
                    >
                      {cat.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Deskripsi Produk
              </label>
              <textarea
                rows={2}
                value={productModal.description || ''}
                onChange={(e) =>
                  setProductModal({ ...productModal, description: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Foto Produk
              </label>
              <div className="flex items-center gap-3">
                {productModal.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productModal.imageUrl}
                    alt="Preview"
                    className="w-14 h-14 rounded-xl object-cover border"
                  />
                )}
                <label className="px-3 py-2 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-black cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Mengunggah...' : 'Unggah Foto Produk'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleUpload(e, (assetId, url) =>
                        setProductModal({
                          ...productModal,
                          imageAssetId: assetId,
                          imageUrl: url,
                        })
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-black">
                <input
                  type="checkbox"
                  checked={Boolean(productModal.isBestSeller)}
                  onChange={(e) =>
                    setProductModal({
                      ...productModal,
                      isBestSeller: e.target.checked,
                    })
                  }
                />
                <span>Produk Terlaris</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-black">
                <input
                  type="checkbox"
                  checked={Boolean(productModal.isPromo)}
                  onChange={(e) =>
                    setProductModal({
                      ...productModal,
                      isPromo: e.target.checked,
                    })
                  }
                />
                <span>Sedang Promo</span>
              </label>

              {productModal.isPromo && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold">Diskon (%):</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={productModal.promoDiscount || 10}
                    onChange={(e) =>
                      setProductModal({
                        ...productModal,
                        promoDiscount: Number(e.target.value),
                      })
                    }
                    className="w-16 p-1.5 rounded-lg bg-[var(--vibe-surface-sub)] border text-xs font-bold"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductModal(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busyId === 'saving-product' || uploading}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
              >
                Simpan Produk
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SERVICE MODAL */}
      {serviceModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusyId('saving-service')
              const res = await saveService(serviceModal)
              setBusyId(null)
              if (res.success) {
                setServiceModal(null)
                await onRefresh()
              } else alert(res.error)
            }}
            className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-6 w-full max-w-lg space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                {serviceModal._id ? 'Edit Layanan Jasa' : 'Tambah Layanan Jasa'}
              </h3>
              <button
                type="button"
                onClick={() => setServiceModal(null)}
                className="p-1.5 rounded-lg bg-[var(--vibe-surface-sub)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Nama Jasa *
              </label>
              <input
                required
                type="text"
                value={serviceModal.name}
                onChange={(e) =>
                  setServiceModal({ ...serviceModal, name: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Penyedia Jasa *
                </label>
                <select
                  required
                  value={serviceModal.vendorId}
                  onChange={(e) =>
                    setServiceModal({ ...serviceModal, vendorId: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold"
                >
                  <option value="">-- Pilih Mitra --</option>
                  {vendors.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Harga Acuan (Rp) *
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  value={serviceModal.price}
                  onChange={(e) =>
                    setServiceModal({
                      ...serviceModal,
                      price: Number(e.target.value),
                    })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Tipe Harga
                </label>
                <select
                  value={serviceModal.priceType || 'starting_from'}
                  onChange={(e) =>
                    setServiceModal({ ...serviceModal, priceType: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold"
                >
                  <option value="fixed">Harga Pas</option>
                  <option value="starting_from">Mulai Dari</option>
                  <option value="hourly">Per Jam</option>
                  <option value="negotiable">Nego</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Deskripsi Jasa
              </label>
              <textarea
                rows={2}
                value={serviceModal.description || ''}
                onChange={(e) =>
                  setServiceModal({ ...serviceModal, description: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Foto Jasa
              </label>
              <div className="flex items-center gap-3">
                {serviceModal.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={serviceModal.imageUrl}
                    alt="Preview"
                    className="w-14 h-14 rounded-xl object-cover border"
                  />
                )}
                <label className="px-3 py-2 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-black cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Mengunggah...' : 'Unggah Foto Jasa'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleUpload(e, (assetId, url) =>
                        setServiceModal({
                          ...serviceModal,
                          imageAssetId: assetId,
                          imageUrl: url,
                        })
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setServiceModal(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busyId === 'saving-service' || uploading}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
              >
                Simpan Jasa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {categoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusyId('saving-category')
              const res = await saveCategory(categoryModal)
              setBusyId(null)
              if (res.success) {
                setCategoryModal(null)
                await onRefresh()
              } else alert(res.error)
            }}
            className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-6 w-full max-w-md space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                {categoryModal._id ? 'Edit Kategori' : 'Tambah Kategori'}
              </h3>
              <button
                type="button"
                onClick={() => setCategoryModal(null)}
                className="p-1.5 rounded-lg bg-[var(--vibe-surface-sub)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Nama Kategori *
              </label>
              <input
                required
                type="text"
                value={categoryModal.name}
                onChange={(e) =>
                  setCategoryModal({ ...categoryModal, name: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Deskripsi
              </label>
              <textarea
                rows={2}
                value={categoryModal.description || ''}
                onChange={(e) =>
                  setCategoryModal({
                    ...categoryModal,
                    description: e.target.value,
                  })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Ikon / Gambar Kategori
              </label>
              <div className="flex items-center gap-3">
                {categoryModal.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={categoryModal.imageUrl}
                    alt="Preview"
                    className="w-12 h-12 rounded-xl object-cover border"
                  />
                )}
                <label className="px-3 py-2 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-black cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Mengunggah...' : 'Pilih Gambar'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleUpload(e, (assetId, url) =>
                        setCategoryModal({
                          ...categoryModal,
                          imageAssetId: assetId,
                          imageUrl: url,
                        })
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryModal(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busyId === 'saving-category' || uploading}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
              >
                Simpan Kategori
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
