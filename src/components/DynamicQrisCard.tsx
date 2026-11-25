'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  Download,
  Copy,
  Check,
  Clock,
  RefreshCw,
} from 'lucide-react'
import {
  generateDynamicQRIS,
  DEFAULT_PAWON_STATIC_QRIS,
} from '@/lib/qrisEngine'

interface DynamicQrisCardProps {
  amount: number
  merchantName?: string
  nmid?: string
  staticPayload?: string
  expiryMinutes?: number
}

export default function DynamicQrisCard({
  amount,
  merchantName = 'PAWON PONDOKREJO',
  nmid = 'ID1026574925990',
  staticPayload = DEFAULT_PAWON_STATIC_QRIS,
  expiryMinutes = 15,
}: DynamicQrisCardProps) {
  const [secondsLeft, setSecondsLeft] = useState(expiryMinutes * 60)
  const [copiedAmount, setCopiedAmount] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const qrWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSecondsLeft(expiryMinutes * 60)
  }, [amount, expiryMinutes])

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const dynamicPayload = useMemo(() => {
    const basePayload = staticPayload?.trim() || DEFAULT_PAWON_STATIC_QRIS
    if (!amount || amount < 500) return basePayload
    try {
      return generateDynamicQRIS(basePayload, amount, {
        merchantNameOverride: merchantName,
      })
    } catch {
      return basePayload
    }
  }, [staticPayload, amount, merchantName])

  const handleCopyNominal = async () => {
    try {
      await navigator.clipboard.writeText(String(Math.round(amount)))
      setCopiedAmount(true)
      setTimeout(() => setCopiedAmount(false), 2000)
    } catch {
      // Fallback silent
    }
  }

  const handleDownloadQrImage = () => {
    const sourceCanvas = qrWrapperRef.current?.querySelector('canvas')
    if (!sourceCanvas) return

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = 480
    exportCanvas.height = 540
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)

    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(merchantName.toUpperCase(), exportCanvas.width / 2, 56)

    ctx.fillStyle = '#475569'
    ctx.font = '14px monospace'
    ctx.fillText(`NMID: ${nmid}`, exportCanvas.width / 2, 82)

    const qrSize = 300
    const qrX = (exportCanvas.width - qrSize) / 2
    const qrY = 105
    ctx.drawImage(sourceCanvas, qrX, qrY, qrSize, qrSize)

    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 26px monospace'
    ctx.fillText(
      `Rp ${Math.round(amount).toLocaleString('id-ID')}`,
      exportCanvas.width / 2,
      465
    )

    const link = document.createElement('a')
    link.download = `QRIS-PAWON-Rp${Math.round(amount)}.png`
    link.href = exportCanvas.toDataURL('image/png')
    link.click()

    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2500)
  }

  return (
    <div
      style={{
        background: 'var(--vibe-surface-sub)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--vibe-border)',
      }}
      className="p-6 text-center space-y-4"
    >
      {/* Merchant Identity */}
      <div>
        <h3 className="text-base font-black text-[var(--vibe-text-main)] tracking-tight">
          {merchantName.toUpperCase()}
        </h3>
        <p
          style={{ fontFamily: 'var(--vibe-font-mono)' }}
          className="text-xs font-bold text-[var(--vibe-text-sub)] mt-0.5"
        >
          NMID: {nmid}
        </p>
      </div>

      {/* QR Code Canvas Container */}
      <div
        ref={qrWrapperRef}
        style={{
          background: 'var(--vibe-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--vibe-border)',
        }}
        className="p-4 inline-flex items-center justify-center mx-auto"
      >
        <QRCodeCanvas
          value={dynamicPayload}
          size={216}
          level="M"
          includeMargin={true}
        />
      </div>

      {/* Total Amount Display */}
      <div
        style={{
          background: 'var(--vibe-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--vibe-border)',
        }}
        className="p-4 flex items-center justify-between gap-2 text-left"
      >
        <div>
          <p className="text-xs font-bold text-[var(--vibe-text-sub)]">
            Total Bayar
          </p>
          <p
            style={{ fontFamily: 'var(--vibe-font-mono)' }}
            className="text-xl font-black text-[var(--vibe-accent-1)]"
          >
            Rp {Math.round(amount).toLocaleString('id-ID')}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopyNominal}
          style={{
            background: 'var(--vibe-surface-sub)',
            borderRadius: 'var(--radius-sm)',
          }}
          className="px-3 py-2 text-xs font-black text-[var(--vibe-text-main)] hover:opacity-80 transition-opacity inline-flex items-center gap-1.5"
        >
          {copiedAmount ? (
            <>
              <Check className="w-4 h-4 text-[var(--vibe-success)]" />
              <span>Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-[var(--vibe-text-sub)]" />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>

      {/* Action Buttons: Download QR & Timer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleDownloadQrImage}
          style={{
            background: 'var(--vibe-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--vibe-border)',
          }}
          className="w-full sm:w-auto flex-1 py-3 px-4 text-xs font-black text-[var(--vibe-text-main)] hover:bg-[var(--vibe-accent-1-lt)] transition-colors inline-flex items-center justify-center gap-2"
        >
          {downloaded ? (
            <>
              <Check className="w-4 h-4 text-[var(--vibe-success)]" />
              <span>Tersimpan</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-[var(--vibe-accent-1)]" />
              <span>Unduh QR</span>
            </>
          )}
        </button>

        <div
          style={{
            background: 'var(--vibe-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--vibe-border)',
          }}
          className="w-full sm:w-auto py-3 px-4 inline-flex items-center justify-center gap-2 text-xs font-bold text-[var(--vibe-text-sub)]"
        >
          <Clock className="w-4 h-4 text-[var(--vibe-accent-2)]" />
          <strong
            style={{ fontFamily: 'var(--vibe-font-mono)' }}
            className="text-[var(--vibe-text-main)]"
          >
            {formatTimer(secondsLeft)}
          </strong>
          {secondsLeft === 0 && (
            <button
              type="button"
              onClick={() => setSecondsLeft(expiryMinutes * 60)}
              className="ml-1 text-[var(--vibe-accent-1)] hover:underline inline-flex items-center gap-1"
              title="Perbarui QR"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
