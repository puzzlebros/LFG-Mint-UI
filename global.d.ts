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

export {};
