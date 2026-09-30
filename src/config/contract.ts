import type { Address } from "viem";

export const AXORA_CONTRACT_ADDRESS: Address =
  "0xe1B617Ff8C71912fb79EA4adBc4CA63154a61C34";

export const NFT_NAME = "AXORA";
export const NFT_SYMBOL = "AXR";
export const CHAIN_ID = 4663;

export const AXORA_ABI = [
  {
    type: "function",
    name: "mintWithBlock",
    stateMutability: "payable",
    inputs: [
      { name: "blockId", type: "bytes32" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "totalMinted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "currentEpoch",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "currentPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "remainingSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "epochMinted",
    stateMutability: "view",
    inputs: [{ name: "epoch", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
