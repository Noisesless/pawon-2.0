import { normalizePhoneTo62 } from '@/lib/actionToken'

export interface AssignedCourier {
  _id: string
  name: string
  phone: string
  lastAssignedAt?: string | null
}

/**
 * Memilih kurir aktif secara adil berbasis antrean bergiliran (Round-Robin):
 * - Hanya kurir dengan `isActive === true` DAN `status === 'active'` DAN punya nomor WA.
 * - Mengecualikan kurir yang sudah menolak atau melewati batas waktu pada pesanan ini (`excludedIds`).
 * - Mengurutkan dari `lastAssignedAt` terlama/kosong ke terbaru, lalu memperbarui `lastAssignedAt`.
 */
export async function pickNextRoundRobinCourier(
  client: any,
  excludedIds: string[] = [],
  preferredCourierId?: string
): Promise<{
  courier: AssignedCourier | null
  totalActiveCount: number
  remainingCount: number
}> {
  const cleanExcluded = new Set(excludedIds.map((id) => id.replace(/^drafts\./, '')))

  const rawCouriers: any[] =
    (await client.fetch(
      `*[_type == "courier" && !(_id in path("drafts.**"))]{ _id, name, phone, isActive, status, isSettlementBlocked, lastAssignedAt, _createdAt }`,
      {},
      { cache: 'no-store' }
    )) || []

  const activePool = rawCouriers
    .filter(
      (c) =>
        c &&
        c.isActive === true &&
        c.status !== 'inactive' &&
        c.isSettlementBlocked !== true &&
        Boolean(normalizePhoneTo62(c.phone || ''))
    )
    .sort((a, b) => {
      const ta = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0
      const tb = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0
      if (ta !== tb) return ta - tb
      const ca = a._createdAt ? new Date(a._createdAt).getTime() : 0
      const cb = b._createdAt ? new Date(b._createdAt).getTime() : 0
      return ca - cb
    })

  const availablePool = activePool.filter(
    (c) => !cleanExcluded.has(String(c._id).replace(/^drafts\./, ''))
  )

  let chosen: any = null
  if (preferredCourierId) {
    const cleanPref = preferredCourierId.replace(/^drafts\./, '')
    chosen =
      availablePool.find(
        (c) => String(c._id).replace(/^drafts\./, '') === cleanPref
      ) || null
  }

  if (!chosen && availablePool.length > 0) {
    chosen = availablePool[0]
  }

  if (!chosen) {
    return {
      courier: null,
      totalActiveCount: activePool.length,
      remainingCount: 0,
    }
  }

  const nowIso = new Date().toISOString()
  if (typeof client.patch === 'function') {
    await client
      .patch(chosen._id.replace(/^drafts\./, ''))
      .set({ lastAssignedAt: nowIso })
      .commit()
      .catch(() => {})
  }

  return {
    courier: {
      _id: chosen._id.replace(/^drafts\./, ''),
      name: chosen.name || 'Kurir PAWON',
      phone: chosen.phone,
      lastAssignedAt: nowIso,
    },
    totalActiveCount: activePool.length,
    remainingCount: availablePool.length,
  }
}
