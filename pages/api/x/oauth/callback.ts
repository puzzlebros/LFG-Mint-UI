import type { NextApiRequest, NextApiResponse } from 'next'
import { setTokens } from '@/lib/xTokenStore'

const readCookie = (req: NextApiRequest, name: string) => {
  const raw = req.headers.cookie || ''
  const m = raw.split(';').map(s => s.trim()).find(v => v.startsWith(name + '='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : ''
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = (req.query.code as string) || ''
  const returnedState = (req.query.state as string) || ''
  const code_verifier = readCookie(req, 'x_pkce_verifier')
  const storedState   = readCookie(req, 'x_oauth_state')

  if (!code || !code_verifier || returnedState !== storedState) {
    return res.status(400).send('Invalid or missing OAuth parameters')
  }

  const { X_CLIENT_ID, X_CLIENT_SECRET, X_OAUTH_REDIRECT_URL } = process.env
  if (!X_CLIENT_ID || !X_CLIENT_SECRET || !X_OAUTH_REDIRECT_URL) {
    return res.status(500).send('Missing client credentials or redirect URL')
  }

  const basic = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: X_OAUTH_REDIRECT_URL,
    code_verifier,
  })

  let resp = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
    body,
  })
  let json: any = await resp.json()
  if (!resp.ok) {
    resp = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
      body,
    })
    json = await resp.json()
  }

  if (resp.ok && json?.access_token) {
    await setTokens({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: Date.now() + Number(json.expires_in ?? 7200) * 1000,
    })
  }

  // Clear temp cookies
  res.setHeader('Set-Cookie', [
    'x_pkce_verifier=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
    'x_oauth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
  ])

  const isLocal = (req.headers.host || '').startsWith('localhost')
  return isLocal
    ? res.status(resp.ok ? 200 : 400).json(json)
    : res.status(resp.ok ? 200 : 400).send(resp.ok ? 'Tokens stored.' : 'Token exchange failed.')
}
