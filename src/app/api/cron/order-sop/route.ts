import { NextResponse } from 'next/server'
import { runOrderSopEvaluation } from '@/lib/orderSopEngine'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get('authorization')
      const url = new URL(request.url)
      const querySecret = url.searchParams.get('secret')
      if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const url = new URL(request.url)
    const dryRun = url.searchParams.get('dryRun') === 'true'
    const force = url.searchParams.get('force') === 'true'

    const result = await runOrderSopEvaluation({ dryRun, force })
    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    console.error('[Cron Order SOP] Error:', error)
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
