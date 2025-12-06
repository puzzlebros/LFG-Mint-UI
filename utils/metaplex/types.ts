// utils/metaplex/types.ts
import type { PublicKey } from "@metaplex-foundation/umi";
import type { JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";

export type MintedNft = {
  mint: PublicKey;
  // required property, but value can be undefined
  offChainMetadata: JsonMetadata | undefined;
};
