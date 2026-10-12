// pages/api/postMint.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { mintCompletions } from '@/public/data/mintMessages'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { publicKey } from '@metaplex-foundation/umi'
import { fetchAssetV1 } from '@metaplex-foundation/mpl-core'
import { mplCandyMachine, fetchCandyMachine } from '@metaplex-foundation/mpl-core-candy-machine'
import { serverRpcUrl } from '@/utils/metaplex/serverRpc'

// Mints already announced, so a repeated POST cannot double-post.
const alreadyPosted = new Set<string>()
let cachedCollection: string | null = null

/**
 * Prove the mint is real before announcing it, and read what to announce off
 * the chain rather than out of the request body.
 *
 * This route is called from the browser, so a shared secret would be just as
 * public as the old RPC key. Verification is the durable fix: a fabricated
 * POST — like the "test" mint posted against the all-ones system-program
 * address — cannot produce an asset that belongs to the collection.
 */
async function verifyMint(mintAddress: string): Promise<{ name: string; image: string }> {
  const rpc = serverRpcUrl()
  if (!rpc) throw new Error('Missing HELIUS_RPC')
  const cmId = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID
  if (!cmId) throw new Error('Missing NEXT_PUBLIC_CANDY_MACHINE_ID')

  const umi = createUmi(rpc).use(mplCandyMachine())

  if (!cachedCollection) {
    const cm = await fetchCandyMachine(umi, publicKey(cmId))
    cachedCollection = cm.collectionMint.toString()
  }

  // Throws if the address is not an mpl-core asset at all.
  const asset = await fetchAssetV1(umi, publicKey(mintAddress))

  const ua = asset.updateAuthority
  if (ua.type !== 'Collection' || ua.address?.toString() !== cachedCollection) {
    throw new Error('asset does not belong to the LFG collection')
  }

  const metaResp = await fetch(ipfsToHttp(asset.uri))
  if (!metaResp.ok) throw new Error(`metadata fetch failed: ${metaResp.status}`)
  const meta = await metaResp.json()
  const image = meta?.image ?? meta?.properties?.files?.[0]?.uri
  if (!image) throw new Error('asset metadata has no image')

  return { name: asset.name, image }
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
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
  } = process.env

  if (!DISCORD_WEBHOOK_URL) {
    return res.status(500).json({ error: 'Missing DISCORD_WEBHOOK_URL' })
  }

  const { mintAddress } = req.body as { mintAddress?: string }
  if (!mintAddress) {
    return res.status(400).json({ error: 'Missing mintAddress' })
  }

  if (alreadyPosted.has(mintAddress)) {
    return res.status(200).json({ success: true, skipped: 'already announced' })
  }

  // Nothing from the request body is trusted — name and image come from chain.
  let name: string
  let rawImageUrl: string
  try {
    const verified = await verifyMint(mintAddress)
    name = verified.name
    rawImageUrl = verified.image
  } catch (e: any) {
    console.warn(`[postMint] rejected ${mintAddress}: ${e?.message ?? e}`)
    return res.status(403).json({ error: 'Mint could not be verified on chain' })
  }

  if (alreadyPosted.size > 10_000) alreadyPosted.clear()
  alreadyPosted.add(mintAddress)

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
