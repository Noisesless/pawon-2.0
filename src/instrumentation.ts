export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const isProd = process.env.NODE_ENV === 'production'
  const isExplicitDevWorker = process.env.ENABLE_ORDER_SOP_WORKER === 'true'

  // Pengaman Dev vs Production: di Local Dev (npm run dev), worker background NONAKTIF secara default
  // agar tidak menabrak dataset Sanity production atau mengirim WA ganda bersama server VPS.
  if (!isProd && !isExplicitDevWorker) {
    return
  }

  const globalState = globalThis as unknown as {
    __pawonSopInterval?: ReturnType<typeof setInterval>
    __pawonCourierInterval?: ReturnType<typeof setInterval>
  }

  if (globalState.__pawonSopInterval) return

  const { runOrderSopEvaluation, runCourierTimeoutCheck } = await import(
    '@/lib/orderSopEngine'
  )

  const executeSopTick = async () => {
    try {
      const res = await runOrderSopEvaluation({ dryRun: false, force: false })
      if (!res.skipped && res.counts.totalAffected > 0) {
        console.log(
          `[PAWON SOP Worker] Resolved ${res.counts.totalAffected} orders (cancelPending=${res.counts.cancelPending}, completeDelivered=${res.counts.completeDelivered}, cancelStuck=${res.counts.cancelStuck})`
        )
      }
    } catch (err) {
      console.error('[PAWON SOP Worker] Tick error:', err)
    }
  }

  const executeCourierQueueTick = async () => {
    try {
      const res = await runCourierTimeoutCheck({ dryRun: false })
      if (res.skippedCount > 0) {
        console.log(`[PAWON Courier Queue] Auto-skipped ${res.skippedCount} unanswered offer(s).`)
      }
    } catch (err) {
      console.error('[PAWON Courier Queue] Tick error:', err)
    }
  }

  // Cek SOP utama 30 detik setelah startup, lalu tiap 10 menit
  setTimeout(executeSopTick, 30 * 1000)
  globalState.__pawonSopInterval = setInterval(executeSopTick, 10 * 60 * 1000)

  // Cek cepat antrean kurir tidak merespons setiap 1 menit
  if (!globalState.__pawonCourierInterval) {
    globalState.__pawonCourierInterval = setInterval(executeCourierQueueTick, 60 * 1000)
  }
}
