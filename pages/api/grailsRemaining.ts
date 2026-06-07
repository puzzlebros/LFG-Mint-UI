// pages/api/grailsRemaining.ts
// Counts minted NFTs in the collection that carry the "Grail" trait,
// then returns how many of the fixed total are still unminted.
// Response is CDN-cached for 2 minutes to avoid hammering the DAS endpoint.
import type { NextApiRequest, NextApiResponse } from "next";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCandyMachine, fetchCandyMachine } from "@metaplex-foundation/mpl-core-candy-machine";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { publicKey } from "@metaplex-foundation/umi";

const GRAIL_TOTAL      = 12;
const GRAIL_TRAIT_TYPE = "Grail";

type Ok  = { remaining: number };
type Err = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");

  const rpc  = process.env.NEXT_PUBLIC_RPC;
  const cmId = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID;
  if (!rpc || !cmId) return res.status(500).json({ error: "Missing env vars" });

  try {
    const umi = createUmi(rpc).use(mplCandyMachine()).use(dasApi());
    const cm  = await fetchCandyMachine(umi, publicKey(cmId));
    const collection = cm.collectionMint.toString();

    let grailsMinted = 0;
    let page = 1;
    const limit = 1000;

    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await (umi.rpc as any).getAssetsByGroup({
        groupKey: "collection",
        groupValue: collection,
        page,
        limit,
      });

      for (const asset of result.items ?? []) {
        // Attributes live at content.metadata.attributes in standard DAS responses.
        const attrs: Array<{ trait_type: string; value: string }> =
          asset?.content?.metadata?.attributes ?? [];
        if (attrs.some(a => a.trait_type === GRAIL_TRAIT_TYPE)) {
          grailsMinted++;
        }
      }

      if ((result.items?.length ?? 0) < limit) break;
      page++;
    }

    return res.status(200).json({ remaining: Math.max(0, GRAIL_TOTAL - grailsMinted) });
  } catch (e: any) {
    console.error("[grailsRemaining]", e);
    return res.status(500).json({ error: e?.message ?? "Failed" });
  }
}
