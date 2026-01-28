import { NextRequest, NextResponse } from "next/server";

type Body = {
  imageUrl: string;
  name?: string;
  description?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
};


function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// Pinata upload helpers (JWT Bearer only)
async function pinFileToIPFS(fileBuffer: ArrayBuffer, filename: string, contentType: string, jwt: string) {
  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: contentType }), filename);
  form.append("pinataMetadata", JSON.stringify({ name: filename }));
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Pinata pinFileToIPFS error", res.status, err);
    throw new Error(`Pinata pinFile failed: ${res.status} ${err}`);
  }
  return (await res.json()).IpfsHash as string;
}

async function pinJSONToIPFS(json: any, jwt: string) {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(json),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Pinata pinJSONToIPFS error", res.status, err);
    throw new Error(`Pinata pinJSON failed: ${res.status} ${err}`);
  }
  return (await res.json()).IpfsHash as string;
}

// Pinata is disabled in the current mint flow. See /api/nft/metadata for the active implementation.
// Mint uses data:application/json;base64 tokenURI; Pinata optional later.
export async function POST(req: NextRequest) {
  return NextResponse.json({
    error: "Pinata upload is disabled. Use /api/nft/metadata for minting."
  }, { status: 400 });
}
