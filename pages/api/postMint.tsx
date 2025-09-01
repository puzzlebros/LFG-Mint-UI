// pages/api/postMint.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { TwitterApi } from 'twitter-api-v2'
import axios from 'axios'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('▶️ Received request to /api/postMint')

  // 0️⃣ Only POSTs
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Only POST allowed' })
  }

  // 1️⃣ Validate all OAuth 1.0a env vars at runtime
  const {
    TWITTER_API_KEY,
    TWITTER_API_SECRET,
    TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_SECRET,
    DISCORD_WEBHOOK_URL,
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

  // 2️⃣ Parse & sanity-check request body
  const { name, imageUrl: rawImageUrl, mintAddress } = req.body as any
  console.log('📦 Payload:', { name, rawImageUrl, mintAddress })
  if (!name || !rawImageUrl || !mintAddress) {
    console.error('❌ Invalid payload')
    return res
      .status(400)
      .json({ error: 'Missing name, imageUrl, or mintAddress' })
  }

  try {
    // 3️⃣ Normalize IPFS → HTTPS
    const imageUrl = rawImageUrl.startsWith('ipfs://')
      ? rawImageUrl.replace('ipfs://', 'https://dweb.link/ipfs/')
      : rawImageUrl
    console.log('🔗 Resolved imageUrl:', imageUrl)

    // 4️⃣ Fetch the image bytes
    console.log('🔄 Fetching image bytes…')
    const imgResp = await axios.get<ArrayBuffer>(imageUrl, {
      responseType: 'arraybuffer',
    })
    const imgBuffer = Buffer.from(imgResp.data)
    console.log('✅ Fetched', imgBuffer.length, 'bytes')

    // 5️⃣ Initialize Twitter client in **user** context
    console.log('🐦 Initializing Twitter client (user context)…')
    const twitter = new TwitterApi({
      appKey:       TWITTER_API_KEY,
      appSecret:    TWITTER_API_SECRET,
      accessToken:  TWITTER_ACCESS_TOKEN,
      accessSecret: TWITTER_ACCESS_SECRET,
    })

    // 6️⃣ Upload media via v2
    console.log('🐦 Uploading media to v2…')
    const mediaId = await twitter.v2.uploadMedia(imgBuffer, {
      media_type: 'image/png',
    })
    console.log('✅ Media uploaded, mediaId=', mediaId)

    // 7️⃣ Post the tweet via v2 with attached media
    const tweetText = [
      '🦩 A new Flamingo minted!',
      `Name: ${name}`,
      `Mint: ${mintAddress}`,
      '#LetsFlamingo #SolanaNFT',
    ].join('\n')
    console.log('🐦 Posting v2 Tweet:', tweetText.replace(/\n/g, ' | '))
    const tweet = await twitter.v2.tweet({
      text:  tweetText,
      media: { media_ids: [mediaId] },
    })
    console.log('✅ Tweet sent, id=', tweet.data.id)

    // 8️⃣ Send Discord embed
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
    // Twitter v2 will include error.data if available
    if (e.data) console.error('→ API error response:', e.data)
    return res.status(500).json({ error: e.message || 'Internal error' })
  }
}
