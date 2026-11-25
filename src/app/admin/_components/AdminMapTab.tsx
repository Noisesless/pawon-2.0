'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import {
  MapPin,
  Search,
  Store,
  CheckCircle,
  Loader2,
  Compass,
  Layers,
  X,
} from 'lucide-react'
import { updateVendorLocationAction } from '@/app/actions/admin'

interface AdminMapTabProps {
  vendors: any[]
  onRefresh: () => Promise<void>
}

type VendorFilter = 'all' | 'pinned' | 'unpinned' | 'open'

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatWaHref(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return '#'
  const norm = digits.startsWith('0') ? '62' + digits.slice(1) : digits
  return `https://wa.me/${norm}`
}

export default function AdminMapTab({ vendors, onRefresh }: AdminMapTabProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const leafletRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const boundaryLayerRef = useRef<any>(null)
  const toponimiLayerRef = useRef<any>(null)
  const vendorLayerRef = useRef<any>(null)
  const previewLayerRef = useRef<any>(null)
  const tileLayersRef = useRef<{ osm?: any; satellite?: any }>({})

  const [mapReady, setMapReady] = useState(false)
  const [baseMode, setBaseMode] = useState<'osm' | 'satellite'>('osm')
  const [showToponimi, setShowToponimi] = useState(true)
  const [filterMode, setFilterMode] = useState<VendorFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [pinningVendor, setPinningVendor] = useState<any | null>(null)
  const [draftCoords, setDraftCoords] = useState<{ lat: number; lng: number } | null>(
    null
  )
  const [savingPin, setSavingPin] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const pinningVendorRef = useRef<any | null>(null)
  pinningVendorRef.current = pinningVendor

  const hasValidCoord = (v: any) =>
    typeof v?.latitude === 'number' &&
    Number.isFinite(v.latitude) &&
    typeof v?.longitude === 'number' &&
    Number.isFinite(v.longitude)

  const pinnedVendors = useMemo(
    () => (vendors || []).filter(hasValidCoord),
    [vendors]
  )
  const unpinnedCount = Math.max(0, (vendors || []).length - pinnedVendors.length)

  const filteredVendors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return (vendors || []).filter((v) => {
      if (filterMode === 'pinned' && !hasValidCoord(v)) return false
      if (filterMode === 'unpinned' && hasValidCoord(v)) return false
      if (filterMode === 'open' && !v.isOpen) return false
      if (!q) return true
      return (
        String(v.name || '').toLowerCase().includes(q) ||
        String(v.address || '').toLowerCase().includes(q)
      )
    })
  }, [vendors, filterMode, searchQuery])

  // Inisialisasi Leaflet + muat GeoJSON resmi Pondokrejo
  useEffect(() => {
    let cancelled = false

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return
      const L = (await import('leaflet')).default
      if (cancelled || !mapContainerRef.current) return

      leafletRef.current = L

      const map = L.map(mapContainerRef.current, {
        center: [-7.66577, 110.3059],
        zoom: 14,
        zoomControl: true,
      })

      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      })
      const satLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '&copy; Esri',
        }
      )

      osmLayer.addTo(map)
      tileLayersRef.current = { osm: osmLayer, satellite: satLayer }

      const vendorLayer = L.layerGroup().addTo(map)
      const toponimiLayer = L.layerGroup().addTo(map)
      const previewLayer = L.layerGroup().addTo(map)

      vendorLayerRef.current = vendorLayer
      toponimiLayerRef.current = toponimiLayer
      previewLayerRef.current = previewLayer
      mapInstanceRef.current = map

      map.on('click', (e: any) => {
        if (!pinningVendorRef.current) return
        setDraftCoords({
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        })
      })

      // Muat batas Kalurahan Pondokrejo & label padukuhan
      try {
        const [boundaryRes, toponimiRes] = await Promise.all([
          fetch('/geo/pondokrejo-boundary.geojson'),
          fetch('/geo/pondokrejo-toponimi.geojson'),
        ])
        if (!cancelled && boundaryRes.ok) {
          const boundaryGeo = await boundaryRes.json()
          const boundary = L.geoJSON(boundaryGeo, {
            style: {
              color: '#15803d',
              weight: 3,
              opacity: 0.9,
              fillColor: '#15803d',
              fillOpacity: 0.08,
              dashArray: '6 4',
            },
          }).addTo(map)
          boundaryLayerRef.current = boundary
          const bounds = boundary.getBounds()
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [24, 24] })
          }
        }

        if (!cancelled && toponimiRes.ok) {
          const toponimiGeo = await toponimiRes.json()
          for (const feat of toponimiGeo?.features || []) {
            const coords = feat?.geometry?.coordinates
            const label = feat?.properties?.NAMOBJ
            if (!Array.isArray(coords) || coords.length < 2 || !label) continue
            const icon = L.divIcon({
              className: 'pawon-toponimi-pin',
              html: `<div style="display:inline-block;padding:2px 7px;border-radius:9999px;background:rgba(255,255,255,0.9);border:1px solid #cbd5e1;color:#334155;font-size:10px;font-weight:800;white-space:nowrap;transform:translate(-50%,-50%);">${escapeHtml(label)}</div>`,
              iconSize: [0, 0],
            })
            L.marker([coords[1], coords[0]], { icon, interactive: false }).addTo(
              toponimiLayer
            )
          }
        }
      } catch (err) {
        console.warn('Gagal memuat layer GeoJSON Pondokrejo:', err)
      }

      if (!cancelled) setMapReady(true)
    }

    initMap()

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
      setMapReady(false)
    }
  }, [])

  // Switch basemap OSM vs Satelit
  useEffect(() => {
    const map = mapInstanceRef.current
    const tiles = tileLayersRef.current
    if (!map || !tiles.osm || !tiles.satellite) return
    if (baseMode === 'satellite') {
      if (map.hasLayer(tiles.osm)) map.removeLayer(tiles.osm)
      if (!map.hasLayer(tiles.satellite)) tiles.satellite.addTo(map)
    } else {
      if (map.hasLayer(tiles.satellite)) map.removeLayer(tiles.satellite)
      if (!map.hasLayer(tiles.osm)) tiles.osm.addTo(map)
    }
  }, [baseMode, mapReady])

  // Toggle toponimi padukuhan
  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = toponimiLayerRef.current
    if (!map || !layer) return
    if (showToponimi) {
      if (!map.hasLayer(layer)) layer.addTo(map)
    } else {
      if (map.hasLayer(layer)) map.removeLayer(layer)
    }
  }, [showToponimi, mapReady])

  // Render marker UMKM pada peta
  useEffect(() => {
    const L = leafletRef.current
    const layer = vendorLayerRef.current
    if (!L || !layer || !mapReady) return

    layer.clearLayers()

    for (const v of filteredVendors) {
      if (!hasValidCoord(v)) continue
      const isSelected = v._id === selectedVendorId || v._id === pinningVendor?._id
      const bgColor = isSelected ? '#f59e0b' : v.isOpen ? '#15803d' : '#64748b'
      const ringSize = isSelected ? 22 : 16

      const icon = L.divIcon({
        className: 'pawon-vendor-pin',
        html: `<div style="width:${ringSize}px;height:${ringSize}px;border-radius:9999px;background:${bgColor};border:3px solid #ffffff;box-shadow:0 2px 6px rgba(15,23,42,0.35);transform:translate(-50%,-50%);"></div>`,
        iconSize: [ringSize, ringSize],
      })

      const marker = L.marker([v.latitude, v.longitude], { icon }).addTo(layer)
      const statusBadge = v.isOpen ? 'Buka' : 'Tutup'
      const typeLabel = v.businessType === 'service' ? 'Jasa & Layanan' : 'Produk UMKM'
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}`
      const storefrontUrl = v.slug ? `/vendor/${encodeURIComponent(v.slug)}` : '/vendors'

      marker.bindPopup(
        `<div style="min-width:190px;font-family:sans-serif;line-height:1.45;">
          <div style="font-weight:900;font-size:13px;color:#0f172a;">${escapeHtml(v.name)}</div>
          <div style="font-size:11px;font-weight:700;color:#475569;margin-top:2px;">
            ${escapeHtml(typeLabel)} | ${statusBadge}${v.isVerified ? ' (Terverifikasi)' : ''}
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">${escapeHtml(v.address || 'Pondokrejo')}</div>
          <div style="display:flex;gap:8px;margin-top:8px;font-size:11px;font-weight:800;">
            <a href="${formatWaHref(v.phone)}" target="_blank" rel="noopener noreferrer" style="color:#15803d;text-decoration:none;">WA Penjual</a>
            <a href="${storefrontUrl}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:none;">Etalase</a>
            <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" style="color:#0f172a;text-decoration:none;">Rute Maps</a>
          </div>
        </div>`
      )
    }
  }, [filteredVendors, selectedVendorId, pinningVendor, mapReady])

  // Render preview marker saat Admin klik lokasi baru di peta
  useEffect(() => {
    const L = leafletRef.current
    const layer = previewLayerRef.current
    if (!L || !layer || !mapReady) return
    layer.clearLayers()

    if (pinningVendor && draftCoords) {
      const icon = L.divIcon({
        className: 'pawon-preview-pin',
        html: `<div style="width:22px;height:22px;border-radius:9999px;background:#f59e0b;border:3px solid #0f172a;transform:translate(-50%,-50%);"></div>`,
        iconSize: [22, 22],
      })
      L.marker([draftCoords.lat, draftCoords.lng], { icon }).addTo(layer)
    }
  }, [pinningVendor, draftCoords, mapReady])

  const handleFitBoundary = () => {
    const map = mapInstanceRef.current
    const boundary = boundaryLayerRef.current
    if (!map) return
    if (boundary && boundary.getBounds().isValid()) {
      map.fitBounds(boundary.getBounds(), { padding: [24, 24] })
    } else {
      map.setView([-7.66577, 110.3059], 14)
    }
  }

  const handleSelectVendor = (v: any) => {
    setSelectedVendorId(v._id)
    setFeedback(null)
    if (hasValidCoord(v) && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([v.latitude, v.longitude], 17, { duration: 0.6 })
    }
  }

  const handleStartPinning = (v: any) => {
    setPinningVendor(v)
    setSelectedVendorId(v._id)
    setFeedback(null)
    if (hasValidCoord(v)) {
      setDraftCoords({ lat: v.latitude, lng: v.longitude })
      mapInstanceRef.current?.flyTo([v.latitude, v.longitude], 17, { duration: 0.6 })
    } else {
      setDraftCoords(null)
    }
  }

  const handleSavePin = async () => {
    if (!pinningVendor || !draftCoords) return
    setSavingPin(true)
    setFeedback(null)
    const res = await updateVendorLocationAction({
      vendorId: pinningVendor._id,
      latitude: draftCoords.lat,
      longitude: draftCoords.lng,
    })
    setSavingPin(false)
    if (res.success) {
      setFeedback(
        `Titik lokasi ${pinningVendor.name} berhasil disimpan (${draftCoords.lat}, ${draftCoords.lng}).`
      )
      setPinningVendor(null)
      setDraftCoords(null)
      await onRefresh()
    } else {
      alert(res.error || 'Gagal menyimpan titik lokasi UMKM.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="bg-[var(--vibe-surface)] p-5 rounded-2xl border border-[var(--vibe-border)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-[var(--vibe-text-main)]">
            Peta Wilayah Pondokrejo &amp; Sebaran UMKM
          </h2>
          <p className="text-xs font-bold text-[var(--vibe-text-sub)] mt-0.5">
            {pinnedVendors.length} dari {vendors.length} UMKM sudah terpasang di peta |{' '}
            {unpinnedCount} belum memiliki titik lokasi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBaseMode((m) => (m === 'osm' ? 'satellite' : 'osm'))}
            className="px-3.5 py-2 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-black text-[var(--vibe-text-main)] inline-flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4" />
            <span>{baseMode === 'osm' ? 'Tampilan Jalan (OSM)' : 'Citra Satelit'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowToponimi((v) => !v)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-black ${
              showToponimi
                ? 'bg-[var(--vibe-accent-1-lt)] border-green-200 text-[var(--vibe-accent-1)]'
                : 'bg-[var(--vibe-surface-sub)] border-[var(--vibe-border)] text-[var(--vibe-text-sub)]'
            }`}
          >
            {showToponimi ? 'Label Wilayah Aktif' : 'Label Wilayah Mati'}
          </button>

          <button
            type="button"
            onClick={handleFitBoundary}
            className="px-3.5 py-2 rounded-xl bg-[var(--vibe-text-main)] text-white text-xs font-black inline-flex items-center gap-1.5"
          >
            <Compass className="w-4 h-4" />
            <span>Fokus Pondokrejo</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-[var(--vibe-accent-1-lt)] border border-green-200 text-green-800 text-xs font-bold">
          {feedback}
        </div>
      )}

      {pinningVendor && (
        <div className="p-4 rounded-2xl bg-[var(--vibe-accent-2-lt)] border border-amber-300 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-amber-900">
              Mode Tandai Lokasi: {pinningVendor.name}
            </p>
            <p className="text-xs font-bold text-amber-800 mt-0.5">
              {draftCoords
                ? `Titik dipilih: ${draftCoords.lat}, ${draftCoords.lng}`
                : 'Klik langsung pada area peta Pondokrejo tempat lapak UMKM berada.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPinningVendor(null)
                setDraftCoords(null)
              }}
              className="px-3 py-2 rounded-xl bg-white border border-amber-200 text-xs font-black text-slate-700 inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Batal</span>
            </button>
            <button
              type="button"
              disabled={!draftCoords || savingPin}
              onClick={handleSavePin}
              className="px-4 py-2 rounded-xl bg-[var(--vibe-accent-1)] text-white text-xs font-black inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingPin ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Simpan Titik Lokasi</span>
            </button>
          </div>
        </div>
      )}

      {/* Grid Peta + Sidebar UMKM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Sidebar Daftar UMKM */}
        <div className="lg:col-span-4 bg-[var(--vibe-surface)] p-4 rounded-2xl border border-[var(--vibe-border)] flex flex-col gap-3 max-h-[600px]">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--vibe-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama UMKM / padukuhan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--vibe-surface-sub)] border border-[var(--vibe-border)] text-xs font-bold outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', `Semua (${vendors.length})`],
                ['pinned', `Di Peta (${pinnedVendors.length})`],
                ['unpinned', `Belum Dipin (${unpinnedCount})`],
                ['open', 'Toko Buka'],
              ] as Array<[VendorFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterMode(key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black ${
                  filterMode === key
                    ? 'bg-[var(--vibe-text-main)] text-white'
                    : 'bg-[var(--vibe-surface-sub)] text-[var(--vibe-text-sub)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto space-y-2 pr-1 flex-1">
            {filteredVendors.length === 0 ? (
              <p className="text-xs font-bold text-[var(--vibe-text-sub)] text-center py-8">
                Tidak ada UMKM yang sesuai filter.
              </p>
            ) : (
              filteredVendors.map((v) => {
                const pinned = hasValidCoord(v)
                const isActivePin = pinningVendor?._id === v._id
                return (
                  <div
                    key={v._id}
                    className={`p-3 rounded-xl border transition-colors ${
                      selectedVendorId === v._id || isActivePin
                        ? 'bg-[var(--vibe-accent-1-lt)] border-green-300'
                        : 'bg-[var(--vibe-surface-sub)] border-[var(--vibe-border)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectVendor(v)}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-[var(--vibe-accent-1)] flex-shrink-0" />
                          <p className="text-xs font-black text-[var(--vibe-text-main)] truncate">
                            {v.name}
                          </p>
                        </div>
                        <p className="text-[11px] font-bold text-[var(--vibe-text-sub)] truncate mt-0.5">
                          {v.address || 'Pondokrejo'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-[10px] font-black ${
                              v.isOpen ? 'text-green-700' : 'text-slate-500'
                            }`}
                          >
                            {v.isOpen ? 'Buka' : 'Tutup'}
                          </span>
                          <span
                            className={`text-[10px] font-black ${
                              pinned ? 'text-blue-700' : 'text-amber-700'
                            }`}
                          >
                            {pinned ? 'Terpin' : 'Belum dipin'}
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartPinning(v)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-[var(--vibe-border)] text-[11px] font-black text-[var(--vibe-text-main)] hover:bg-slate-50 inline-flex items-center gap-1 flex-shrink-0"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>{pinned ? 'Ubah Pin' : 'Tandai'}</span>
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Canvas Peta Leaflet */}
        <div className="lg:col-span-8 bg-[var(--vibe-surface)] p-3 rounded-2xl border border-[var(--vibe-border)] space-y-2.5">
          <div
            ref={mapContainerRef}
            className={`w-full h-[520px] rounded-xl overflow-hidden z-10 ${
              pinningVendor ? 'cursor-crosshair' : ''
            }`}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-bold text-[var(--vibe-text-sub)]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#15803d] inline-block border border-white" />
                <span>UMKM Buka</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#64748b] inline-block border border-white" />
                <span>UMKM Tutup</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#f59e0b] inline-block border border-white" />
                <span>Terpilih / Draft Pin</span>
              </span>
            </div>
            <span>Sumber batas wilayah: GeoJSON Kalurahan Pondokrejo (SRGI 2013)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
