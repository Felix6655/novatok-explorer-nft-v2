"use client";

import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { ipfsToHttp } from "../../lib/ipfs";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || "";
const ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)"
];

export default function MyNFTsPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      setWalletAddress(accounts[0] || "");
    });
  }, []);

  useEffect(() => {
    if (!walletAddress || !CONTRACT_ADDRESS) return;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
        const balance = await contract.balanceOf(walletAddress);
        const nftList = [];
        for (let i = 0; i < balance; i++) {
          const tokenId = await contract.tokenOfOwnerByIndex(walletAddress, i);
          let tokenUri = await contract.tokenURI(tokenId);
          if (tokenUri.startsWith("ipfs://")) {
            tokenUri = ipfsToHttp(tokenUri);
          }
          let metadata = null;
          try {
            const res = await fetch(tokenUri);
            metadata = await res.json();
          } catch {}
          nftList.push({ tokenId: tokenId.toString(), tokenUri, metadata });
        }
        setNfts(nftList);
      } catch (e: any) {
        setError(e.message || "Failed to fetch NFTs");
      } finally {
        setLoading(false);
      }
    })();
  }, [walletAddress]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">My NFTs</h1>
      {!walletAddress && <div>Connect your wallet to view your NFTs.</div>}
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        {nfts.map((nft) => (
          <div key={nft.tokenId} className="border rounded-lg p-4 bg-white dark:bg-zinc-900">
            {nft.metadata?.image && (
              <img src={nft.metadata.image} alt="NFT" className="w-full h-48 object-cover rounded mb-2" />
            )}
            <div className="font-mono text-xs mb-1">Token ID: {nft.tokenId}</div>
            <div className="text-sm font-semibold mb-1">{nft.metadata?.name || "Unnamed NFT"}</div>
            <div className="text-xs text-zinc-500 mb-2">{nft.metadata?.description}</div>
            <a href={nft.tokenUri} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">View Metadata</a>
          </div>
        ))}
      </div>
    </div>
  );
}
