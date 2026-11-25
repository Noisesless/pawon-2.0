'use client'

import React, { useState } from 'react'
import {
  Image as ImageIcon,
  FileText,
  Rocket,
  Plus,
  Edit3,
  Trash2,
  Upload,
  CheckCircle,
  X,
} from 'lucide-react'
import {
  saveBanner,
  saveArticle,
  saveIncubatorService,
  saveIncubatorSettings,
  adminDeleteDocument,
  uploadAdminImage,
} from '@/app/actions/admin'

interface AdminContentTabProps {
  mode: 'content' | 'incubator'
  banners: any[]
  articles: any[]
  incubatorServices: any[]
  incubatorSettings: any | null
  onRefresh: () => Promise<void>
}

function portableTextToPlain(blocks: any[]): string {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .map((b) =>
      Array.isArray(b.children)
        ? b.children.map((c: any) => c.text || '').join('')
        : ''
    )
    .filter(Boolean)
    .join('\n\n')
}

export default function AdminContentTab({
  mode,
  banners,
  articles,
  incubatorServices,
  incubatorSettings,
  onRefresh,
}: AdminContentTabProps) {
  const [subTab, setSubTab] = useState<'banners' | 'articles'>('banners')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [bannerModal, setBannerModal] = useState<any | null>(null)
  const [articleModal, setArticleModal] = useState<any | null>(null)
  const [incServiceModal, setIncServiceModal] = useState<any | null>(null)

  const [incHeroTitle, setIncHeroTitle] = useState(
    incubatorSettings?.heroTitle || ''
  )
  const [incHeroAssetId, setIncHeroAssetId] = useState(
    incubatorSettings?.heroAssetId || ''
  )
  const [incHeroUrl, setIncHeroUrl] = useState(
    incubatorSettings?.heroImageUrl || ''
  )
  const [savedHeroNotice, setSavedHeroNotice] = useState(false)

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

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Hapus ${label} secara permanen?`)) return
    setBusyId(id)
    const res = await adminDeleteDocument(id)
    setBusyId(null)
    if (res.success) await onRefresh()
    else alert(res.error)
  }

  // MODE 2: INCUBATOR TAB
  if (mode === 'incubator') {
    return (
      <div className="space-y-6">
        {/* Hero Inkubator Settings */}
        <div className="bg-[var(--vibe-surface)] p-6 rounded-2xl border border-[var(--vibe-border)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                Banner Utama Halaman Inkubator
              </h3>
              <p className="text-xs font-bold text-[var(--vibe-text-sub)]">
                Gambar latar dan judul utama halaman Inkubator UMKM
              </p>
            </div>
            {savedHeroNotice && (
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-black inline-flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Tersimpan
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Judul Hero Inkubator (Opsional)
              </label>
              <input
                type="text"
                placeholder="Inkubator UMKM PAWON"
                value={incHeroTitle}
                onChange={(e) => setIncHeroTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Gambar Hero Inkubator
              </label>
              <div className="flex items-center gap-3">
                {incHeroUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={incHeroUrl}
                    alt="Hero Inkubator"
                    className="w-20 h-12 rounded-xl object-cover border"
                  />
                )}
                <label className="px-3 py-2 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-black cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Mengunggah...' : 'Unggah Gambar Hero'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleUpload(e, (assetId, url) => {
                        setIncHeroAssetId(assetId)
                        setIncHeroUrl(url)
                      })
                    }
                  />
                </label>

                <button
                  type="button"
                  disabled={busyId === 'saving-inc-hero' || uploading}
                  onClick={async () => {
                    setBusyId('saving-inc-hero')
                    const res = await saveIncubatorSettings({
                      heroTitle: incHeroTitle,
                      heroAssetId: incHeroAssetId || undefined,
                    })
                    setBusyId(null)
                    if (res.success) {
                      setSavedHeroNotice(true)
                      setTimeout(() => setSavedHeroNotice(false), 2500)
                      await onRefresh()
                    } else alert(res.error)
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
                >
                  Simpan Hero
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Daftar Layanan Inkubator */}
        <div className="bg-[var(--vibe-surface)] p-4 rounded-2xl border border-[var(--vibe-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-[var(--vibe-accent-1)]" />
            <h3 className="text-sm font-black text-[var(--vibe-text-main)]">
              Program Layanan Inkubator ({incubatorServices.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() =>
              setIncServiceModal({
                title: '',
                description: '',
                iconName: 'GraduationCap',
                order: incubatorServices.length + 1,
              })
            }
            className="px-4 py-2 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Layanan</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {incubatorServices.map((srv) => (
            <div
              key={srv._id}
              className="bg-[var(--vibe-surface)] p-5 rounded-2xl border border-[var(--vibe-border)] flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-[var(--vibe-surface-sub)] text-xs font-black text-[var(--vibe-text-sub)]">
                    Urutan #{srv.order ?? 0}
                  </span>
                </div>
                <h4 className="text-base font-black text-[var(--vibe-text-main)] mt-2">
                  {srv.title}
                </h4>
                <p className="text-xs text-[var(--vibe-text-sub)] mt-1 line-clamp-3">
                  {srv.description}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--vibe-border)]">
                <button
                  type="button"
                  onClick={() => setIncServiceModal({ ...srv })}
                  className="px-3 py-1.5 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Ubah</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(srv._id, `Layanan ${srv.title}`)}
                  className="p-2 rounded-xl bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {incServiceModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setBusyId('saving-inc-service')
                const res = await saveIncubatorService(incServiceModal)
                setBusyId(null)
                if (res.success) {
                  setIncServiceModal(null)
                  await onRefresh()
                } else alert(res.error)
              }}
              className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-6 w-full max-w-md space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                  {incServiceModal._id
                    ? 'Edit Layanan Inkubator'
                    : 'Tambah Layanan Inkubator'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIncServiceModal(null)}
                  className="p-1.5 rounded-lg bg-[var(--vibe-surface-sub)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Nama Layanan *
                </label>
                <input
                  required
                  type="text"
                  value={incServiceModal.title}
                  onChange={(e) =>
                    setIncServiceModal({
                      ...incServiceModal,
                      title: e.target.value,
                    })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                    Ikon Lucide
                  </label>
                  <select
                    value={incServiceModal.iconName || 'GraduationCap'}
                    onChange={(e) =>
                      setIncServiceModal({
                        ...incServiceModal,
                        iconName: e.target.value,
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold"
                  >
                    <option value="GraduationCap">GraduationCap (Pelatihan)</option>
                    <option value="Palette">Palette (Desain & Kemasan)</option>
                    <option value="Banknote">Banknote (Permodalan)</option>
                    <option value="ShieldCheck">ShieldCheck (Legalitas / Halal)</option>
                    <option value="Globe">Globe (Pemasaran Digital)</option>
                    <option value="Users">Users (Komunitas)</option>
                    <option value="Handshake">Handshake (Kemitraan)</option>
                    <option value="Building">Building (Kelembagaan)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                    Urutan Tampil
                  </label>
                  <input
                    type="number"
                    value={incServiceModal.order ?? 1}
                    onChange={(e) =>
                      setIncServiceModal({
                        ...incServiceModal,
                        order: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                  Manfaat & Penjelasan Program *
                </label>
                <textarea
                  required
                  rows={3}
                  value={incServiceModal.description || ''}
                  onChange={(e) =>
                    setIncServiceModal({
                      ...incServiceModal,
                      description: e.target.value,
                    })
                  }
                  className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIncServiceModal(null)}
                  className="flex-1 py-3 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busyId === 'saving-inc-service'}
                  className="flex-1 py-3 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
                >
                  Simpan Layanan
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    )
  }

  // MODE 1: CONTENT & BANNERS TAB
  return (
    <div className="space-y-6">
      <div className="bg-[var(--vibe-surface)] p-4 rounded-2xl border border-[var(--vibe-border)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSubTab('banners')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black inline-flex items-center gap-2 ${
              subTab === 'banners'
                ? 'bg-[var(--vibe-accent-1)] text-white'
                : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Banner Promosi ({banners.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('articles')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black inline-flex items-center gap-2 ${
              subTab === 'articles'
                ? 'bg-[var(--vibe-accent-1)] text-white'
                : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Info & Pengumuman ({articles.length})</span>
          </button>
        </div>

        {subTab === 'banners' ? (
          <button
            type="button"
            onClick={() =>
              setBannerModal({
                title: '',
                link: '/products',
                isActive: true,
                desktopAssetId: '',
                desktopUrl: '',
                mobileAssetId: '',
                mobileUrl: '',
              })
            }
            className="px-4 py-2.5 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Banner</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              setArticleModal({
                title: '',
                category: 'pengumuman',
                excerpt: '',
                bodyText: '',
                imageAssetId: '',
                imageUrl: '',
              })
            }
            className="px-4 py-2.5 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Tulis Info Baru</span>
          </button>
        )}
      </div>

      {subTab === 'banners' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map((b) => (
            <div
              key={b._id}
              className="bg-[var(--vibe-surface)] p-5 rounded-2xl border border-[var(--vibe-border)] flex flex-col justify-between gap-4"
            >
              <div className="flex gap-4">
                {b.desktopUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.desktopUrl}
                    alt={b.title}
                    className="w-28 h-16 rounded-xl object-cover border flex-shrink-0"
                  />
                )}
                <div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      b.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {b.isActive ? 'Banner Aktif' : 'Nonaktif'}
                  </span>
                  <h4 className="text-base font-black text-[var(--vibe-text-main)] mt-1">
                    {b.title}
                  </h4>
                  <p className="text-xs text-[var(--vibe-text-sub)] font-bold">
                    Link: {b.link || '/products'}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--vibe-border)]">
                <button
                  type="button"
                  onClick={() => setBannerModal({ ...b })}
                  className="px-3 py-1.5 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Ubah</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(b._id, `Banner ${b.title}`)}
                  className="p-2 rounded-xl bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === 'articles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((art) => (
            <div
              key={art._id}
              className="bg-[var(--vibe-surface)] p-5 rounded-2xl border border-[var(--vibe-border)] flex flex-col justify-between gap-3"
            >
              <div>
                {art.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={art.imageUrl}
                    alt={art.title}
                    className="w-full h-32 rounded-xl object-cover border mb-3"
                  />
                )}
                <span className="px-2.5 py-0.5 rounded-md bg-[var(--vibe-accent-1-lt)] text-[var(--vibe-accent-1)] text-[10px] font-black uppercase">
                  {art.category || 'pengumuman'}
                </span>
                <h4 className="text-base font-black text-[var(--vibe-text-main)] mt-1.5">
                  {art.title}
                </h4>
                {art.excerpt && (
                  <p className="text-xs text-[var(--vibe-text-sub)] mt-1 line-clamp-2">
                    {art.excerpt}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--vibe-border)]">
                <button
                  type="button"
                  onClick={() =>
                    setArticleModal({
                      ...art,
                      bodyText: portableTextToPlain(art.content),
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Ubah</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(art._id, `Artikel ${art.title}`)}
                  className="p-2 rounded-xl bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BANNER MODAL */}
      {bannerModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusyId('saving-banner')
              const res = await saveBanner(bannerModal)
              setBusyId(null)
              if (res.success) {
                setBannerModal(null)
                await onRefresh()
              } else alert(res.error)
            }}
            className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-6 w-full max-w-md space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                {bannerModal._id ? 'Edit Banner Promosi' : 'Tambah Banner Promosi'}
              </h3>
              <button
                type="button"
                onClick={() => setBannerModal(null)}
                className="p-1.5 rounded-lg bg-[var(--vibe-surface-sub)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Judul Banner *
              </label>
              <input
                required
                type="text"
                value={bannerModal.title}
                onChange={(e) =>
                  setBannerModal({ ...bannerModal, title: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Link Tujuan
              </label>
              <input
                type="text"
                placeholder="/products"
                value={bannerModal.link || ''}
                onChange={(e) =>
                  setBannerModal({ ...bannerModal, link: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)]">
                Gambar Banner Desktop (Landscape)
              </label>
              <div className="flex items-center gap-3">
                {bannerModal.desktopUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bannerModal.desktopUrl}
                    alt="Desktop"
                    className="w-20 h-12 rounded-xl object-cover border"
                  />
                )}
                <label className="px-3 py-2 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-black cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Unggah Desktop</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleUpload(e, (assetId, url) =>
                        setBannerModal({
                          ...bannerModal,
                          desktopAssetId: assetId,
                          desktopUrl: url,
                          mobileAssetId: bannerModal.mobileAssetId || assetId,
                          mobileUrl: bannerModal.mobileUrl || url,
                        })
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)]">
                Gambar Banner Mobile (Portrait / Square)
              </label>
              <div className="flex items-center gap-3">
                {bannerModal.mobileUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bannerModal.mobileUrl}
                    alt="Mobile"
                    className="w-12 h-12 rounded-xl object-cover border"
                  />
                )}
                <label className="px-3 py-2 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-black cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Unggah Mobile</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleUpload(e, (assetId, url) =>
                        setBannerModal({
                          ...bannerModal,
                          mobileAssetId: assetId,
                          mobileUrl: url,
                        })
                      )
                    }
                  />
                </label>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-black">
              <input
                type="checkbox"
                checked={Boolean(bannerModal.isActive)}
                onChange={(e) =>
                  setBannerModal({ ...bannerModal, isActive: e.target.checked })
                }
              />
              <span>Tampilkan Banner di Beranda</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBannerModal(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busyId === 'saving-banner' || uploading}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
              >
                Simpan Banner
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ARTICLE MODAL */}
      {articleModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setBusyId('saving-article')
              const res = await saveArticle(articleModal)
              setBusyId(null)
              if (res.success) {
                setArticleModal(null)
                await onRefresh()
              } else alert(res.error)
            }}
            className="bg-[var(--vibe-surface)] rounded-2xl border border-[var(--vibe-border)] p-6 w-full max-w-lg space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[var(--vibe-text-main)]">
                {articleModal._id ? 'Edit Info Kalurahan' : 'Tulis Info Kalurahan'}
              </h3>
              <button
                type="button"
                onClick={() => setArticleModal(null)}
                className="p-1.5 rounded-lg bg-[var(--vibe-surface-sub)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Judul Info / Pengumuman *
              </label>
              <input
                required
                type="text"
                value={articleModal.title}
                onChange={(e) =>
                  setArticleModal({ ...articleModal, title: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Kategori Info
              </label>
              <select
                value={articleModal.category || 'pengumuman'}
                onChange={(e) =>
                  setArticleModal({ ...articleModal, category: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold"
              >
                <option value="pengumuman">Pengumuman</option>
                <option value="pelatihan">Pelatihan UMKM</option>
                <option value="panduan">Panduan Warga</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Ringkasan Singkat (Tampil di Kartu Depan)
              </label>
              <textarea
                rows={2}
                value={articleModal.excerpt || ''}
                onChange={(e) =>
                  setArticleModal({ ...articleModal, excerpt: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Isi Artikel Lengkap (Pisahkan paragraf dengan Enter) *
              </label>
              <textarea
                required
                rows={5}
                value={articleModal.bodyText || ''}
                onChange={(e) =>
                  setArticleModal({ ...articleModal, bodyText: e.target.value })
                }
                className="w-full p-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--vibe-text-sub)] mb-1">
                Gambar Sampul
              </label>
              <div className="flex items-center gap-3">
                {articleModal.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={articleModal.imageUrl}
                    alt="Sampul"
                    className="w-16 h-12 rounded-xl object-cover border"
                  />
                )}
                <label className="px-3 py-2 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-black cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Mengunggah...' : 'Pilih Gambar Sampul'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleUpload(e, (assetId, url) =>
                        setArticleModal({
                          ...articleModal,
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
                onClick={() => setArticleModal(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-surface-sub)] text-xs font-black"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busyId === 'saving-article' || uploading}
                className="flex-1 py-3 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black"
              >
                Terbitkan Info
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
