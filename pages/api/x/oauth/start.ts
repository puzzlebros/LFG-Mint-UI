// pages/api/x/oauth/start.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'

const b64url = (b: Buffer) =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { X_CLIENT_ID, X_OAUTH_REDIRECT_URL } = process.env
  if (!X_CLIENT_ID || !X_OAUTH_REDIRECT_URL) {
    return res.status(500).send('Missing X_CLIENT_ID or X_OAUTH_REDIRECT_URL')
  }

  const isLocal = (req.headers.host || '').startsWith('localhost') || (req.headers.host || '').startsWith('127.0.0.1')

  // PKCE S256
  const code_verifier = b64url(crypto.randomBytes(64))
  const code_challenge = b64url(crypto.createHash('sha256').update(code_verifier).digest())
  const state = b64url(crypto.randomBytes(24))
  const scopes = ['tweet.read','tweet.write','users.read','media.write','offline.access'].join(' ')

  // localhost: don't set Secure so cookies are sent over http
  const common = `HttpOnly; Path=/; Max-Age=600; SameSite=Lax`
  const secure = isLocal ? '' : '; Secure'
  res.setHeader('Set-Cookie', [
    `x_pkce_verifier=${code_verifier}; ${common}${secure}`,
    `x_oauth_state=${state}; ${common}${secure}`,
  ])

  // ✅ UI authorize endpoint
  const u = new URL('https://x.com/i/oauth2/authorize')
  // If needed, fallback:
  // const u = new URL('https://twitter.com/i/oauth2/authorize')

  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', X_CLIENT_ID)
  u.searchParams.set('redirect_uri', X_OAUTH_REDIRECT_URL)
  u.searchParams.set('scope', scopes)
  u.searchParams.set('state', state)
  u.searchParams.set('code_challenge', code_challenge)
  u.searchParams.set('code_challenge_method', 'S256')

  // Optional: log URL (for debugging)
  console.log('Authorize URL:', u.toString())

  res.redirect(u.toString())
}
