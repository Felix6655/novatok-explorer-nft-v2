import { NextRequest, NextResponse } from "next/server";

function toBase64(str: string) {
  return Buffer.from(str, "utf-8").toString("base64");
}

// Mint uses data:application/json;base64 tokenURI; Pinata is not used in this flow.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, imageUrl, attributes, model, style, size, ratio } = body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
    }

    // Build ERC721 metadata JSON with all prompt settings as attributes
    const metadata = {
      name: name || "NovaTok Create Hub NFT",
      description: description || "Generated in NovaTok Create Hub.",
      image: imageUrl, // Use HTTPS URL for now; can embed data:image/...;base64 later if available
      attributes: [
        ...(Array.isArray(attributes) ? attributes : []),
        ...(model ? [{ trait_type: "Model", value: model }] : []),
        ...(style ? [{ trait_type: "Style", value: style }] : []),
        ...(size ? [{ trait_type: "Size", value: size }] : []),
        ...(ratio ? [{ trait_type: "Ratio", value: ratio }] : []),
      ],
    };

    const json = JSON.stringify(metadata);
    const tokenURI = `data:application/json;base64,${toBase64(json)}`;

    return NextResponse.json({ tokenURI, metadata });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
