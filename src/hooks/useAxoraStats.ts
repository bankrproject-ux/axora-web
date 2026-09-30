import { useReadContract, useReadContracts } from "wagmi";
import {
  AXORA_ABI,
  AXORA_CONTRACT_ADDRESS,
} from "../config/contract";
import { robinhoodChain } from "../config/chain";

export function useAxoraStats() {
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      {
        address: AXORA_CONTRACT_ADDRESS,
        abi: AXORA_ABI,
        functionName: "totalMinted",
        chainId: robinhoodChain.id,
      },
      {
        address: AXORA_CONTRACT_ADDRESS,
        abi: AXORA_ABI,
        functionName: "currentEpoch",
        chainId: robinhoodChain.id,
      },
      {
        address: AXORA_CONTRACT_ADDRESS,
        abi: AXORA_ABI,
        functionName: "currentPrice",
        chainId: robinhoodChain.id,
      },
      {
        address: AXORA_CONTRACT_ADDRESS,
        abi: AXORA_ABI,
        functionName: "remainingSupply",
        chainId: robinhoodChain.id,
      },
    ],
    query: {
      refetchInterval: 15_000,
    },
  });

  const currentEpoch =
    data?.[1]?.status === "success" ? data[1].result : undefined;

  const epochMintedQuery = useReadContract({
    address: AXORA_CONTRACT_ADDRESS,
    abi: AXORA_ABI,
    functionName: "epochMinted",
    args: [currentEpoch ?? 1n],
    chainId: robinhoodChain.id,
    query: {
      enabled: currentEpoch !== undefined,
      refetchInterval: 15_000,
    },
  });

  return {
    totalMinted: data?.[0]?.status === "success" ? data[0].result : undefined,
    currentEpoch,
    currentPrice: data?.[2]?.status === "success" ? data[2].result : undefined,
    remainingSupply:
      data?.[3]?.status === "success" ? data[3].result : undefined,
    epochMinted: epochMintedQuery.data,
    isLoading: isLoading || epochMintedQuery.isLoading,
    error: error ?? epochMintedQuery.error,
    refresh: async () => {
      await Promise.all([refetch(), epochMintedQuery.refetch()]);
    },
  };
}
