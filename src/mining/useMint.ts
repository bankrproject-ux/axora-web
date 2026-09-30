import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { Hash } from "viem";
import {
  AXORA_ABI,
  AXORA_CONTRACT_ADDRESS,
} from "../config/contract";
import { robinhoodChain } from "../config/chain";

type MintInput = {
  blockId: `0x${string}`;
  deadline: number;
};

export function useMint() {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: robinhoodChain.id });
  const { writeContractAsync } = useWriteContract();

  const [isMinting, setIsMinting] = useState(false);
  const [transactionHash, setTransactionHash] = useState<Hash | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mint({ blockId, deadline }: MintInput) {
    setError(null);
    setIsConfirmed(false);
    setTransactionHash(null);

    if (!isConnected || !address) {
      setError("Connect your wallet before minting.");
      return;
    }

    if (chainId !== robinhoodChain.id) {
      setError("Switch your wallet to Robinhood Chain before minting.");
      return;
    }

    if (Date.now() >= deadline * 1000) {
      setError("This block has expired. Start mining again.");
      return;
    }

    if (!publicClient) {
      setError("Unable to connect to Robinhood Chain. Please try again.");
      return;
    }

    setIsMinting(true);

    try {
      const price = await publicClient.readContract({
        address: AXORA_CONTRACT_ADDRESS,
        abi: AXORA_ABI,
        functionName: "currentPrice",
      });

      const hash = await writeContractAsync({
        address: AXORA_CONTRACT_ADDRESS,
        abi: AXORA_ABI,
        functionName: "mintWithBlock",
        args: [blockId, BigInt(deadline)],
        value: price,
        chainId: robinhoodChain.id,
      });

      setTransactionHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        throw new Error("The transaction reverted on-chain.");
      }

      setIsConfirmed(true);
      return hash;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "The mint transaction failed.";

      if (/user rejected|user denied|rejected the request/i.test(message)) {
        setError("Transaction rejected in wallet.");
      } else if (/insufficient funds/i.test(message)) {
        setError("Not enough ETH to cover the mint price and network fee.");
      } else {
        setError(message);
      }
    } finally {
      setIsMinting(false);
    }
  }

  function reset() {
    setTransactionHash(null);
    setIsConfirmed(false);
    setError(null);
  }

  return { mint, isMinting, transactionHash, isConfirmed, error, reset };
}
