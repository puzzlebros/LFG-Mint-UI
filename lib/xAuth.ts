import { getTokens, setTokens, tryLockWithRefreshToken, XTokens } from './xTokenStore'

const earlySkewMs = 60_000 // refresh 60s early
const now = () => Date.now()

async function tokenPOST(body: URLSearchParams) {
  const { X_CLIENT_ID, X_CLIENT_SECRET } = process.env
  if (!X_CLIENT_ID || !X_CLIENT_SECRET) throw new Error('Missing X_CLIENT_ID / X_CLIENT_SECRET')
  const basic = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')

  for (const host of ['api.x.com', 'api.twitter.com']) {
    const r = await fetch(`https://${host}/2/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body,
    })
    const j = await r.json()
    if (r.ok) return j
    if (host === 'api.twitter.com') throw new Error(`Token endpoint failed: ${r.status} ${JSON.stringify(j)}`)
  }
}

async function refreshWith(tok: XTokens): Promise<XTokens> {
  // prevent refresh stampede across lambdas
  const won = await tryLockWithRefreshToken(tok.refresh_token)
  if (!won) {
    const latest = await getTokens()
    if (!latest) throw new Error('Lost refresh race and no tokens found')
    return latest
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tok.refresh_token,
    redirect_uri: process.env.X_OAUTH_REDIRECT_URL!, // X requires it again
  })
  const j: any = await tokenPOST(body)

  const out: XTokens = {
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? tok.refresh_token, // rotate if provided
    expires_at: now() + Number(j.expires_in ?? 7200) * 1000,
  }
  await setTokens(out)
  return out
}

async function ensureFresh(): Promise<XTokens> {
  const tok = await getTokens()
  if (!tok) throw new Error('X tokens not initialized. Run the OAuth flow once.')
  if (tok.expires_at && now() < tok.expires_at - earlySkewMs) return tok
  return refreshWith(tok)
}

export async function xFetchWithAutoRefresh(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  let tok = await ensureFresh()
  let resp = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${tok.access_token}` },
  })

  if (resp.status === 401 || resp.status === 403) {
    tok = await refreshWith(tok)
    resp = await fetch(url, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${tok.access_token}` },
    })
  }
  return resp
}
