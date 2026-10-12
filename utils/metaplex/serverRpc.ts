// utils/metaplex/serverRpc.ts
//
// The Helius endpoint, for SERVER-SIDE use only (API routes,
// getServerSideProps). Never import this into anything that reaches the
// browser: the URL carries the API key.
//
// HELIUS_RPC is the real home for it. NEXT_PUBLIC_RPC is accepted only as a
// migration fallback — any NEXT_PUBLIC_* value is inlined into the client
// bundle, so while it is set the key is still public.
export function serverRpcUrl(): string | undefined {
  return process.env.HELIUS_RPC ?? process.env.NEXT_PUBLIC_RPC;
}
