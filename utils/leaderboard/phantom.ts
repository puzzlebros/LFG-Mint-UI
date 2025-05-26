// utils/leaderboard/phantom.ts
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const STORAGE_KEY = 'phantomDappKey';

// 1️⃣ Ensure a persistent keypair exists in localStorage
export function ensureDappKeypair(): void {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem(STORAGE_KEY)) {
    const kp = nacl.box.keyPair();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(kp.secretKey)));
  }
}

// 2️⃣ Expose the public key for deep-linking
export function getDappPublicKey(): Uint8Array {
  const secretArr = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  const kp = nacl.box.keyPair.fromSecretKey(Uint8Array.from(secretArr));
  return kp.publicKey;
}

// 3️⃣ Decrypt the payload Phantom sends back
export function decryptPhantomPayload(
  dataB58: string,
  nonceB58: string,
  phantomPubKeyB58: string
): { publicKey: string } | null {
  const secretArr = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  const secretKey = Uint8Array.from(secretArr);
  const phantomPubKey = bs58.decode(phantomPubKeyB58);
  const msg   = bs58.decode(dataB58);
  const nonce = bs58.decode(nonceB58);

  const decrypted = nacl.box.open(msg, nonce, phantomPubKey, secretKey);
  if (!decrypted) return null;

  const decoded = new TextDecoder().decode(decrypted);
  return JSON.parse(decoded);
}
