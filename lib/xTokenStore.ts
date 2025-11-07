import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,   // URL can be public
  process.env.SUPABASE_SERVICE_KEY!,       // SERVER-ONLY service key
  { auth: { persistSession: false } }
)

export type XTokens = {
  access_token: string
  refresh_token: string
  expires_at: number // epoch ms
}

const ROW_ID = 'mint_poster'

export async function getTokens(): Promise<XTokens | null> {
  const { data, error } = await supa
    .from('x_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('id', ROW_ID)
    .maybeSingle()

  if (error || !data) return null
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(data.expires_at as unknown as string).getTime(),
  }
}

export async function setTokens(tok: XTokens): Promise<void> {
  const { error } = await supa
    .from('x_oauth_tokens')
    .upsert({
      id: ROW_ID,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: new Date(tok.expires_at).toISOString(),
      updated_at: new Date().toISOString(),
    })
  if (error) throw error
}

/** tiny advisory lock so only one lambda refreshes at a time */
export async function tryLockWithRefreshToken(currentRefreshToken: string): Promise<boolean> {
  const { data, error } = await supa
    .from('x_oauth_tokens')
    .update({ updated_at: new Date().toISOString() }) // no-op write
    .eq('id', ROW_ID)
    .eq('refresh_token', currentRefreshToken)
    .select('id')
    .maybeSingle()
  if (error) return false
  return !!data
}
