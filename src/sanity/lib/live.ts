import { client } from './client'

/**
 * Mengambil data Sanity secara real-time tanpa terjebak Data Cache maupun prerender statis Next.js.
 */
export async function sanityFetch<T = any>({
  query,
  params = {},
}: {
  query: string
  params?: Record<string, any>
}): Promise<{ data: T }> {
  try {
    const { connection } = await import('next/server')
    await connection()
  } catch {
    // Aman ketika dipanggil di luar Next.js request context (misal saat unit test)
  }
  const data = await client.fetch<T>(query, params, { cache: 'no-store' })
  return { data }
}

/**
 * Komponen placeholder kompatibilitas (data selalu segar per permintaan).
 */
export function SanityLive() {
  return null
}
