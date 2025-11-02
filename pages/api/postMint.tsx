// pages/api/postMint.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { TwitterApi } from 'twitter-api-v2'
import axios from 'axios'
import { mintMessages, defaultHashtags, type DayBucket } from '@/public/data/mintMessages'

/** Return "GM!" for 05:00–11:59, otherwise "GN!" in the given IANA TZ. */
function getGreeting(tz: string): 'GM!' | 'GN!' {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false })
      .format(new Date())
  )
  return (hour >= 5 && hour < 12) ? 'GM!' : 'GN!'
}

/** Morning (05–11) vs Night (else) bucket to index message sets. */
function getDayBucket(tz: string): DayBucket {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false })
      .format(new Date())
  )
  return (hour >= 5 && hour < 12) ? 'morning' : 'night'
}

function pickRandom<T>(arr: T[], fallback: T): T {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('▶️ Received request to /api/postMint')

  // Allow only POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Only POST allowed' })
  }

  // Env validation
  const {
    TWITTER_API_KEY,
    TWITTER_API_SECRET,
    TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_SECRET,
    DISCORD_WEBHOOK_URL,
    POST_TIMEZONE, // optional IANA TZ (e.g., "America/Argentina/Buenos_Aires")
  } = process.env

  if (
    !TWITTER_API_KEY ||
    !TWITTER_API_SECRET ||
    !TWITTER_ACCESS_TOKEN ||
    !TWITTER_ACCESS_SECRET ||
    !DISCORD_WEBHOOK_URL
  ) {
    console.error('❌ Missing one of required env vars:', {
      TWITTER_API_KEY:        !!TWITTER_API_KEY,
      TWITTER_API_SECRET:     !!TWITTER_API_SECRET,
      TWITTER_ACCESS_TOKEN:   !!TWITTER_ACCESS_TOKEN,
      TWITTER_ACCESS_SECRET:  !!TWITTER_ACCESS_SECRET,
      DISCORD_WEBHOOK_URL:    !!DISCORD_WEBHOOK_URL,
    })
    return res.status(500).json({
      error: 'Server misconfiguration: missing Twitter or Discord credentials',
    })
  }

  // Payload validation
  const { name, imageUrl: rawImageUrl, mintAddress } = req.body as {
    name?: string
    imageUrl?: string
    mintAddress?: string
  }

  console.log('📦 Payload:', { name, rawImageUrl, mintAddress })

  if (!name || !rawImageUrl || !mintAddress) {
    console.error('❌ Invalid payload')
    return res.status(400).json({ error: 'Missing name, imageUrl, or mintAddress' })
  }

  try {
    // Normalize IPFS → HTTPS
    const imageUrl = rawImageUrl.startsWith('ipfs://')
      ? rawImageUrl.replace('ipfs://', 'https://dweb.link/ipfs/')
      : rawImageUrl

    console.log('🔗 Resolved imageUrl:', imageUrl)

    // Fetch image bytes
    console.log('🔄 Fetching image bytes…')
    const imgResp = await axios.get<ArrayBuffer>(imageUrl, { responseType: 'arraybuffer' })
    const imgBuffer = Buffer.from(imgResp.data)
    console.log('✅ Fetched', imgBuffer.length, 'bytes')

    // Init Twitter
    console.log('🐦 Initializing Twitter client (user context)…')
    const twitter = new TwitterApi({
      appKey:      TWITTER_API_KEY,
      appSecret:   TWITTER_API_SECRET,
      accessToken: TWITTER_ACCESS_TOKEN,
      accessSecret: TWITTER_ACCESS_SECRET,
    })

    // Upload media
    console.log('🐦 Uploading media to v2…')
    const mediaId = await twitter.v2.uploadMedia(imgBuffer, { media_type: 'image/png' })
    console.log('✅ Media uploaded, mediaId=', mediaId)

    // Time-aware prefix + random body line
    const tz = POST_TIMEZONE || 'America/Argentina/Buenos_Aires'
    const greet = getGreeting(tz)                          // "GM!" or "GN!"
    const bucket = getDayBucket(tz)                        // "morning" or "night"
    const bodyLine = pickRandom(mintMessages[bucket], 'A new Flamingo minted!')
    const hashtagsText = (defaultHashtags?.length ? defaultHashtags : ['#LetsFlamingo', '#SolanaNFT']).join(' ')

    // Compose tweet
    const tweetText = [
      `${greet} 🦩 ${bodyLine}`,
      `Name: ${name}`,
      `Mint: ${mintAddress}`,
      hashtagsText,
    ].join('\n')

    console.log('🐦 Posting v2 Tweet:', tweetText.replace(/\n/g, ' | '))
    const tweet = await twitter.v2.tweet({
      text:  tweetText,
      media: { media_ids: [mediaId] },
    })
    console.log('✅ Tweet sent, id=', tweet.data.id)

    // Discord embed (neutral; customize if you want greet/body here too)
    console.log('🤖 Sending Discord webhook…')
    await axios.post(
      DISCORD_WEBHOOK_URL,
      {
        embeds: [
          {
            title: '🦩 New Flamingo Minted!',
            description: `**Name:** ${name}\n**Mint Address:** ${mintAddress}`,
            image: { url: imageUrl },
            color: 0xff79a6,
            timestamp: new Date().toISOString(),
          },
        ],
      },
      { headers: { 'Content-Type': 'application/json' } }
    )
    console.log('✅ Discord webhook sent')

    return res.status(200).json({ success: true, tweetId: tweet.data.id })
  } catch (e: any) {
    console.error('❌ postMint error:', e)
    if (e?.data) console.error('→ API error response:', e.data)
    return res.status(500).json({ error: e?.message || 'Internal error' })
  }
}
