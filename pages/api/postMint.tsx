// pages/api/postMint.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { mintCompletions } from '@/public/data/mintMessages'

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
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
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
  const completion = pickRandom(mintCompletions, 'LFG.')
  const postText = `🦩 A new Flamingo just minted!\n"I believe ${completion}"\n#Solana`

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

  // Discord (always)
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

  const httpOk = (results.discord?.ok ?? false) || (results.telegram?.ok ?? false)
  return res.status(httpOk ? 200 : 502).json({ success: httpOk, results })
}
