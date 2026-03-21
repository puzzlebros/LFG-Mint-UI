//utils/metaplex/verifyTx.ts
import {
  BlockhashWithExpiryBlockHeight,
  PublicKey,
  Signer,
  Some,
  Transaction,
  TransactionWithMeta,
  Umi,
} from "@metaplex-foundation/umi";
import { createStandaloneToast } from "@chakra-ui/react";
import { base58 } from "@metaplex-foundation/umi/serializers";

const detectBotTax = (logs: string[]) => {
  if (logs.find((l) => l.includes("Candy Guard Botting"))) {
    return true;
  }
  return false;
};

type VerifySignatureResult =
  | { success: true; mintedAssets: PublicKey[]; reason?: never }
  | { success: false; mint?: never; reason: string };

export const verifyTx = async (
  umi: Umi,
  signatures: Uint8Array[],
  nftSigners: Signer[],
  blockhash: BlockhashWithExpiryBlockHeight,
  commitment: "processed" | "confirmed" | "finalized"
) => {
  const verifySignature = async (
    signature: Uint8Array
  ): Promise<VerifySignatureResult> => {
    const sigStr = base58.deserialize(signature)[0];
    console.log("[verifyTx] Checking signature:", sigStr);

    let transaction: TransactionWithMeta | null | undefined;
    for (let i = 0; i < 30; i++) {
      transaction = await umi.rpc.getTransaction(signature);
      if (transaction) {
        console.log(`[verifyTx] Found tx on try ${i + 1} for sig:`, sigStr);
        break;
      }
      console.log(`[verifyTx] Waiting for tx to land... try ${i + 1}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!transaction) {
      console.error("[verifyTx] No TX found for signature:", sigStr);
      return { success: false, reason: "No TX found" };
    }

    if (transaction.meta.err) {
      console.error("[verifyTx] TX failed on-chain:", transaction.meta.err, "logs:", transaction.meta.logs);
      return { success: false, reason: `Transaction failed on-chain: ${JSON.stringify(transaction.meta.err)}` };
    }

    if (detectBotTax(transaction.meta.logs)) {
      console.error("[verifyTx] Bot tax detected in logs!");
      return { success: false, reason: "Bot Tax detected!" };
    }

    // Which mint was this?
    const mintedAssets = nftSigners
      .filter((signer) =>
        transaction?.message.accounts.some(
          (account) => account === signer.publicKey
        )
      )
      .map((signer) => signer.publicKey);

    console.log("[verifyTx] Minted assets for sig:", sigStr, mintedAssets);

    return { success: true, mintedAssets };
  };

  console.log("[verifyTx] Will confirm", signatures.length, "txs");

  // 1. Confirm all transactions
  const promises = [];
  for (let i = 0; i < signatures.length; i++) {
    promises.push(
      umi.rpc.confirmTransaction(signatures[i], {
        commitment,
        strategy: { type: "blockhash", ...blockhash },
      })
    );
  }

  try {
    await Promise.all(promises);
    console.log("[verifyTx] All txs confirmed at RPC");
  } catch (e) {
    console.error("[verifyTx] Error in umi.rpc.confirmTransaction:", e);
  }

  // 2. Fetch & match to mint signers
  const stati = await Promise.all(signatures.map(verifySignature));
  let successful: PublicKey[] = [];
  let failed: string[] = [];
  stati.forEach((status) => {
    if (status.success === true) {
      successful.push(...status.mintedAssets);
    } else {
      failed.push(status.reason);
    }
  });

  if (failed && failed.length > 0) {
    createStandaloneToast().toast({
      title: `${failed.length} Mints failed!`,
      status: "error",
      duration: 3000,
    });
    failed.forEach((fail) => {
      console.error(fail);
    });
  }

  if (successful.length > 0) {
    createStandaloneToast().toast({
      title: `${successful.length} Mints successful!`,
      status: "success",
      duration: 3000,
    });
  }

  return successful;
};