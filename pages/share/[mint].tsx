// pages/share/[mint].tsx
// SSR page whose only purpose is to expose Twitter Card / OG meta tags so that
// X embeds the NFT image when the tweet card unfurls.
// Human visitors are immediately redirected to the homepage via client-side nav.

import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

interface Props {
  name: string;
  image: string;
}

export default function SharePage({ name, image }: Props) {
  const router = useRouter();

  // X's crawler ignores JS — only humans get redirected.
  useEffect(() => {
    router.replace('/');
  }, [router]);

  const title = `${name} just joined the flock! 🦩`;
  const description = 'Play, rank, and FREE MINT at LetsFlamingoNFT.';

  return (
    <Head>
      <title>{title}</title>
      <meta property="og:type"        content="website" />
      <meta property="og:title"       content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image"       content={image} />

      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image"       content={image} />
      <meta name="twitter:site"        content="@LetsFlamingoNFT" />
    </Head>
  );
}

function ipfsToHttp(url: string): string {
  return url?.startsWith('ipfs://')
    ? url.replace('ipfs://', 'https://dweb.link/ipfs/')
    : url;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const mint = (context.params?.mint as string) ?? '';

  try {
    const rpc = process.env.NEXT_PUBLIC_RPC!;
    const resp = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'share-card',
        method: 'getAsset',
        params: { id: mint },
      }),
    });
    const { result } = await resp.json();

    const name  = result?.content?.metadata?.name ?? 'My Flamingo';
    const rawImage =
      result?.content?.links?.image ??
      result?.content?.files?.[0]?.uri ??
      '';
    const image = ipfsToHttp(rawImage);

    return { props: { name, image } };
  } catch {
    return { props: { name: 'My Flamingo', image: '' } };
  }
};
