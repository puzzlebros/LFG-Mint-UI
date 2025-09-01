declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare global {
  var sessions: { [key: string]: any } | undefined;
}

declare global {
  interface Window {
    currentWalletData: { walletAddress: string; userName: string } | null;
    unityInstance?: any;
    requestWalletData?: () => void;
  }
}

declare module '@metaplex-foundation/umi' {
  // this is the interface that `digital-asset-standard-api` was supposed to patch:
  interface RpcInterface {
    getAssetsByOwner(args: { owner: import("@metaplex-foundation/umi").PublicKey }): Promise<{
      items: import("@metaplex-foundation/digital-asset-standard-api").DasApiAsset[];
      // …you can add count, page, etc if you like
    }>;
  }
}

export {};
