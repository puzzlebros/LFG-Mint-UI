// pages/api/postMint.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { xFetchWithAutoRefresh } from '@/lib/xAuth' // auto-refresh + retry helper
import { mintMessages, defaultHashtags, type DayBucket } from '@/public/data/mintMessages'

/** ───────── compact night window helpers ─────────
 * Default: GN only from 02:00–03:59 in the given TZ (2 hours).
 * Override with env:
 *   POST_NIGHT_START=2   // inclusive hour (0–23)
 *   POST_NIGHT_END=4     // exclusive hour (0–24), can wrap (e.g., 23 → 2)
 */
function hourInTz(tz: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date()))
}
function inNightWindow(hour: number, start: number, end: number): boolean {
  start = Math.max(0, Math.min(23, Number.isFinite(start) ? start : 2))
  end   = Math.max(1, Math.min(24,  Number.isFinite(end)   ? end   : 4))
  if (start < end) return hour >= start && hour < end        // e.g., 2..4
  return hour >= start || hour < end                         // wrap, e.g., 23..2
}
function getGreeting(tz: string): 'GM!' | 'GN!' {
  const h = hourInTz(tz)
  const start = Number(process.env.POST_NIGHT_START ?? 2)   // default 02:00
  const end   = Number(process.env.POST_NIGHT_END   ?? 4)   // default 04:00 (exclusive)
  return inNightWindow(h, start, end) ? 'GN!' : 'GM!'
}
function getDayBucket(tz: string): DayBucket {
  const h = hourInTz(tz)
  const start = Number(process.env.POST_NIGHT_START ?? 2)
  const end   = Number(process.env.POST_NIGHT_END   ?? 4)
  return inNightWindow(h, start, end) ? 'night' : 'morning'
}

function pickRandom<T>(arr: T[], fallback: T): T {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback
}
function ipfsToHttp(u: string) {
  return u?.startsWith('ipfs://') ? u.replace('ipfs://', 'https://dweb.link/ipfs/') : u
}
function guessMimeFromUrl(url: string): string | undefined {
  const lower = (url || '').split('?')[0].toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  return undefined
}
async function safeJson(res: Response) {
  try { return await res.json() } catch { return null }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Only POST allowed' })
  }

  const {
    DISCORD_WEBHOOK_URL,
    POST_TIMEZONE,
    TELEGRAM_BOT_TOKEN,       // optional (kept, but safe to remove)
    TELEGRAM_CHAT_ID,         // optional (kept, but safe to remove)
  } = process.env

  if (!DISCORD_WEBHOOK_URL) {
    return res.status(500).json({ error: 'Missing DISCORD_WEBHOOK_URL' })
  }

  const { name, imageUrl: rawImageUrl, mintAddress } = req.body as {
    name?: string; imageUrl?: string; mintAddress?: string
  }
  if (!name || !rawImageUrl || !mintAddress) {
    return res.status(400).json({ error: 'Missing name, imageUrl, or mintAddress' })
  }

  // Compose message
  const imageUrl = ipfsToHttp(rawImageUrl)
  const tz = POST_TIMEZONE || 'America/Argentina/Buenos_Aires'
  const greet = getGreeting(tz)
  const bucket = getDayBucket(tz)
  const bodyLine = pickRandom(mintMessages[bucket], 'A new Flamingo minted!')
  const hashtags = (defaultHashtags?.length ? defaultHashtags : ['#LetsFlamingo', '#SolanaNFT']).join(' ')
  const postText = `${greet} 🦩 ${bodyLine}\n${hashtags}`

  // Fetch image once (shared)
  let imgBuf: ArrayBuffer | null = null
  let imgMime = 'image/png'
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 20_000)
    const imgResp = await fetch(imageUrl, { signal: ac.signal })
    clearTimeout(t)
    if (!imgResp.ok) throw new Error(`Image fetch failed: ${imgResp.status} ${imgResp.statusText}`)
    imgBuf = await imgResp.arrayBuffer()
    imgMime = imgResp.headers.get('content-type') || guessMimeFromUrl(imageUrl) || 'image/png'
  } catch (e: any) {
    console.warn('⚠️ Image fetch issue:', e?.message || e)
  }

  const results: Record<string, any> = {}

  // 1) X (best effort)
  try {
    if (!imgBuf) throw new Error('No image buffer for X')

    const form = new FormData()
    form.append('media', new Blob([imgBuf], { type: imgMime }), 'asset')
    form.append('media_category', 'tweet_image')
    form.append('media_type', imgMime)

    const uploadResp = await xFetchWithAutoRefresh('https://api.x.com/2/media/upload', {
      method: 'POST',
      body: form,
    })
    const uploadJson = await safeJson(uploadResp)
    if (!uploadResp.ok) throw new Error(`Media upload failed: ${uploadResp.status} ${JSON.stringify(uploadJson)}`)

    const mediaId = uploadJson?.data?.id as string
    if (!mediaId) throw new Error('No media id returned by X')

    const tweetResp = await xFetchWithAutoRefresh('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: postText, media: { media_ids: [mediaId] } }),
    })
    const tweetJson = await safeJson(tweetResp)
    if (!tweetResp.ok) throw new Error(`Tweet failed: ${tweetResp.status} ${JSON.stringify(tweetJson)}`)

    results.x = { ok: true, tweetId: tweetJson?.data?.id ?? null }
  } catch (e: any) {
    console.error('❌ X post error:', e?.message || e)
    results.x = { ok: false, error: e?.message || String(e) }
  }

  // 2) Discord (always)
  try {
    await fetch(DISCORD_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🦩 New Flamingo Minted!',
          description: `**Name:** ${name}\n**Mint Address:** ${mintAddress}\n\n${postText}`,
          image: { url: imageUrl },
          color: 0xff79a6,
          timestamp: new Date().toISOString(),
        }],
      }),
    })
    results.discord = { ok: true }
  } catch (e: any) {
    console.error('❌ Discord error:', e?.message || e)
    results.discord = { ok: false, error: e?.message || String(e) }
  }

  // 3) Telegram block is optional — can be removed safely for now.
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      if (imgBuf) {
        const tf = new FormData()
        tf.append('chat_id', TELEGRAM_CHAT_ID)
        tf.append('caption', `${postText}\n\nName: ${name}\nMint: ${mintAddress}`)
        tf.append('parse_mode', 'HTML')
        tf.append('photo', new Blob([imgBuf], { type: imgMime }), 'mint.png')
        const tgResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: tf })
        const tgJson = await safeJson(tgResp)
        if (!tgResp.ok) throw new Error(`Telegram sendPhoto failed: ${tgResp.status} ${JSON.stringify(tgJson)}`)
      }
      results.telegram = { ok: true }
    } catch (e: any) {
      console.error('❌ Telegram error:', e?.message || e)
      results.telegram = { ok: false, error: e?.message || String(e) }
    }
  } else {
    results.telegram = { ok: false, skipped: true, reason: 'TELEGRAM_* not set' }
  }

  const httpOk = (results.discord?.ok ?? false) || (results.x?.ok ?? false) || (results.telegram?.ok ?? false)
  return res.status(httpOk ? 200 : 502).json({ success: httpOk, results })
}
