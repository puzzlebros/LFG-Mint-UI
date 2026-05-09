// pages/share/[mint].tsx
// Thin SSR page whose only job is to serve Twitter Card / OG meta tags so that
// X (Twitter) embeds the NFT image when the tweet is rendered.
// Real users who land here are immediately redirected to the homepage.

import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

interface Props {
  mint: string;
  name: string;
  image: string;
}

export default function SharePage({ name, image }: Props) {
  const router = useRouter();

  // Redirect human visitors away; X's crawler ignores JS so it sees the OG tags.
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

export const getServerSideProps: GetServerSideProps = async (context) => {
  const mint  = (context.params?.mint as string) ?? '';
  const image = decodeURIComponent((context.query.image as string) ?? '');
  const name  = decodeURIComponent((context.query.name  as string) ?? 'My Flamingo');

  return { props: { mint, image, name } };
};
