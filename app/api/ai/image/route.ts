import { NextRequest, NextResponse } from "next/server";

const PLACEHOLDER_IMAGES = [
  "https://placehold.co/512x512?text=AI+Image+1",
  "https://placehold.co/512x512?text=AI+Image+2",
  "https://placehold.co/512x512?text=AI+Image+3",
];

const REPLICATE_MODEL = "stability-ai/sdxl";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseSize(size?: string) {
  if (!size) return { width: 1024, height: 1024 };
  const m = size.match(/^(\d+)x(\d+)$/);
  if (!m) return { width: 1024, height: 1024 };
  return {
    width: Math.min(2048, Math.max(256, Number(m[1]))),
    height: Math.min(2048, Math.max(256, Number(m[2]))),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageCount = 1, style, size } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    const provider = process.env.IMAGE_AI_PROVIDER;

    if (provider !== "replicate" || !token) {
      console.warn("[AI IMAGE] Missing Replicate config, returning placeholders");
      return NextResponse.json({
        images: PLACEHOLDER_IMAGES.slice(0, imageCount),
      });
    }

    // 1️⃣ Fetch model to get latest version
    const modelRes = await fetch(
      `https://api.replicate.com/v1/models/${REPLICATE_MODEL}`,
      {
        headers: {
          Authorization: `Token ${token}`,
        },
      }
    );

    if (!modelRes.ok) {
      const text = await modelRes.text();
      return NextResponse.json(
        { error: `Failed to fetch model: ${text}` },
        { status: 500 }
      );
    }

    const modelData = await modelRes.json();
    const version = modelData.latest_version?.id;

    if (!version) {
      return NextResponse.json(
        { error: "No usable model version found" },
        { status: 500 }
      );
    }

    const { width, height } = parseSize(size);
    const finalPrompt = style ? `${prompt}\nStyle: ${style}` : prompt;

    // 2️⃣ Create prediction using REAL version
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version,
        input: {
          prompt: finalPrompt,
          width,
          height,
          num_outputs: imageCount,
        },
      }),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      return NextResponse.json(
        { error: `Create failed: ${text}` },
        { status: 500 }
      );
    }

    let prediction = await createRes.json();

    // 3️⃣ Poll until done
    while (prediction.status === "starting" || prediction.status === "processing") {
      await sleep(1200);

      const pollRes = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      prediction = await pollRes.json();
    }

    if (prediction.status !== "succeeded") {
      return NextResponse.json(
        { error: prediction.error || "Generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ images: prediction.output });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
