"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function MintPage() {
  const sp = useSearchParams();
  const tokenUriFromQS = sp.get("tokenUri") || "";
  const previewFromQS = sp.get("preview") || "";
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageGatewayUrl, setImageGatewayUrl] = useState<string>(previewFromQS);
  const [metadataIpfsUri, setMetadataIpfsUri] = useState<string>(tokenUriFromQS);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");

  // Wallet + mint state
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
    const [tokenId, setTokenId] = useState<string>("");
    const [mintState, setMintState] = useState<'idle'|'preparing'|'wallet'|'pending'|'success'|'error'>('idle');

  const EXPECTED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111");

  const CONTRACT_ADDRESS =
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ||
    "";

  // Mint flow helpers for on-chain base64 tokenURI or IPFS fallback
  const hasTokenUriFromQS = !!tokenUriFromQS;
  const hasOnChainTokenUri = tokenUriFromQS.startsWith("data:application/json;base64,");
  const tokenUriToMint = tokenUriFromQS || metadataIpfsUri;

  const hasMetaMask = typeof window !== "undefined" && !!window.ethereum;

  // Minimal ABI that covers the most common ERC-721 mint patterns
  // We try these, in this order:
  // 1) safeMint(address to, string uri)
  // 2) mint(address to, string uri)
  // 3) safeMint(string uri)
  // 4) mint(string uri)
  const ABI = useMemo(
    () => [
      "function safeMint(address to, string uri) public returns (uint256)",
      "function mint(address to, string uri) public returns (uint256)",
      "function safeMint(string uri) public returns (uint256)",
      "function mint(string uri) public returns (uint256)",
    ],
    []
  );

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

      setUploadError(""); 
      setUploading(true); 
      setImageUrl(""); 
      setImageGatewayUrl(""); 
      setMetadataIpfsUri(""); 

    try {
      // 1. Upload image to IPFS
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/ipfs/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data?.imageIpfsUri || !data?.imageGatewayUrl) throw new Error(data?.error || "Image upload failed");
      setImageUrl(data.imageIpfsUri);
      setImageGatewayUrl(data.imageGatewayUrl);

      // 2. Upload metadata to IPFS
      const name = f.name;
      const metadata = {
        name,
        description: "Minted with Novatok Explorer",
        image: data.imageIpfsUri,
      };
      const metaRes = await fetch("/api/ipfs/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });
      const metaData = await metaRes.json();
      if (!metaData?.metadataIpfsUri) throw new Error(metaData?.error || "Metadata upload failed");
      setMetadataIpfsUri(metaData.metadataIpfsUri);
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function refreshWalletState() {
    if (!hasMetaMask) return;

    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    const chainHex = await window.ethereum.request({ method: "eth_chainId" });

    setWalletAddress(accounts?.[0] || "");
    setChainId(chainHex ? parseInt(chainHex, 16) : null);
  }

  async function connectWallet() {
    setMintError("");
    setTxHash("");

    if (!hasMetaMask) {
      setMintError("MetaMask not detected. Install MetaMask to mint.");
      return;
    }

    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await refreshWalletState();
    } catch (e: any) {
      setMintError(e?.message || "Failed to connect wallet");
    }
  }

  async function switchToSepolia() {
    if (!hasMetaMask) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // 11155111
      });
      await refreshWalletState();
    } catch (e: any) {
      // If chain isn't added yet
      if (e?.code === 4902) {
        setMintError("Sepolia is not added in MetaMask. Add it and try again.");
      } else {
        setMintError(e?.message || "Failed to switch network");
      }
    }
  }

  async function mintNft() {
    setMintError("");
    setTxHash("");

    if (!tokenUriToMint) {
      setMintError("Provide tokenUri via link (Create Hub) or upload an image to generate one.");
      return;
    }
    if (!CONTRACT_ADDRESS) {
      setMintError(
        "Missing contract address env var. Set NEXT_PUBLIC_CONTRACT_ADDRESS (or NEXT_PUBLIC_NFT_CONTRACT_ADDRESS) in Vercel."
      );
      return;
    }
    if (!hasMetaMask) {
      setMintError("MetaMask not detected.");
      return;
    }
    if (!walletAddress) {
      setMintError("Connect your wallet first.");
      return;
    }
    if (chainId !== null && chainId !== EXPECTED_CHAIN_ID) {
      setMintError(`Wrong network. Switch to Sepolia (${EXPECTED_CHAIN_ID}).`);
      return;
    }

    setMinting(true);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      // Try calling common mint variants with metadataIpfsUri only
      let tx;
      try {
        tx = await contract.safeMint(walletAddress, metadataIpfsUri);
      } catch {
        try {
          tx = await contract.mint(walletAddress, metadataIpfsUri);
        } catch {
          try {
            tx = await contract.safeMint(metadataIpfsUri);
          } catch {
            tx = await contract.mint(metadataIpfsUri);
          }
        }
      }

      setTxHash(tx.hash);

      const receipt = await tx.wait();
      if (!receipt) {
        setMintError("Transaction sent but no receipt returned.");
        return;
      }
    } catch (e: any) {
      const msg =
        e?.shortMessage || e?.reason || e?.message || "Mint failed (unknown error)";

      if (String(msg).toLowerCase().includes("is not a function")) {
        setMintError(
          msg +
            " — Your contract mint function name/signature is different. Tell me the contract mint function name and I’ll adjust this file."
        );
      } else {
        setMintError(msg);
      }
    } finally {
      setMinting(false);
    }
      setTokenId("");
      setMintState('preparing');
  }

  useEffect(() => {
    if (!hasMetaMask) return;

    refreshWalletState();

    const onAccountsChanged = () => refreshWalletState();
    const onChainChanged = () => refreshWalletState();

    window.ethereum.on?.("accountsChanged", onAccountsChanged);
    window.ethereum.on?.("chainChanged", onChainChanged);

    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", onChainChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ FIX: force boolean (prevents string|boolean type)
  const wrongNetwork = Boolean(
    walletAddress && chainId !== null && chainId !== EXPECTED_CHAIN_ID
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black px-4">
      <h1 className="text-3xl font-bold mb-6 text-black dark:text-zinc-50">
        Mint NFT
      </h1>

      {/* Upload card */}
      <div
        className="w-64 h-64 flex items-center justify-center border-2 border-dashed border-zinc-400 rounded-lg cursor-pointer bg-white dark:bg-zinc-900 mb-4"
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <span className="text-zinc-500">Uploading...</span>
        ) : imageGatewayUrl ? (
          <img
            src={imageGatewayUrl}
            alt="Preview"
            className="max-w-full max-h-full rounded"
          />
        ) : (
          <span className="text-zinc-400">Click to upload image</span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          className="hidden"
          onChange={onPickFile}
        />
      </div>

      {uploadError && <div className="text-red-500 mb-2">{uploadError}</div>}
      {imageGatewayUrl && <div className="text-green-600 mb-4">Image uploaded!</div>}

      {/* Wallet + Mint controls */}
      <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-700 dark:text-zinc-200">
            {walletAddress ? (
              <>
                Connected:{" "}
                <span className="font-mono">
                  {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                </span>
              </>
            ) : (
              "Wallet not connected"
            )}
          </div>

          {!walletAddress ? (
            <button
              onClick={connectWallet}
              className="px-3 py-2 rounded-md bg-black text-white dark:bg-zinc-50 dark:text-black"
            >
              Connect Wallet
            </button>
          ) : wrongNetwork ? (
            <button
              onClick={switchToSepolia}
              className="px-3 py-2 rounded-md bg-amber-600 text-white"
            >
              Switch to Sepolia
            </button>
          ) : (
            <span className="text-xs text-zinc-500">Chain: {chainId ?? "?"}</span>
          )}
        </div>

        <div className="mt-4">
          <button
            onClick={mintNft}
            disabled={minting || !walletAddress || wrongNetwork || !metadataIpfsUri}
            className="w-full px-4 py-3 rounded-lg bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {minting ? "Minting..." : "Mint NFT"}
          </button>
        </div>

        {txHash && (
          <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-200">
            Tx:{" "}
            <a
              className="underline"
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </a>
          </div>
        )}

        {mintError && (
          <div className="mt-3 text-red-500 text-sm">{mintError}</div>
        )}

        {/* Helpful config display (non-secret) */}
        <div className="mt-4 text-xs text-zinc-500 space-y-1">
          <div>Expected chain: {EXPECTED_CHAIN_ID}</div>
          <div>
            Contract:{" "}
            {CONTRACT_ADDRESS ? (
              <span className="font-mono">
                {CONTRACT_ADDRESS.slice(0, 6)}…{CONTRACT_ADDRESS.slice(-4)}
              </span>
            ) : (
              <span className="text-red-400">missing</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
