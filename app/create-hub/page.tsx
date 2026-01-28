
"use client";
import { useState } from "react";

// Mint uses data:application/json;base64 tokenURI; Pinata is not used in this flow.
async function prepareMint(imageUrl: string, prompt: string, model: string, style: string, size: string, ratio: string) {
  const res = await fetch("/api/nft/metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl,
      name: "NovaTok AI NFT",
      description: prompt,
      attributes: [
        { trait_type: "source", value: "Create Hub" },
        { trait_type: "generator", value: "replicate" },
      ],
      model,
      style,
      size,
      ratio,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Prepare mint failed");
  // Return tokenURI and preview image URL (imageUrl)
  return { tokenUri: data.tokenURI, preview: imageUrl };
}

const TABS = ["Image", "Video", "Character", "Audio", "Assets"];

export default function CreateHubPage() {
  const [selectedTab, setSelectedTab] = useState("Image");
  const [prompt, setPrompt] = useState("");
  const [imageCount, setImageCount] = useState(1);
  const [model, setModel] = useState("");
  const [style, setStyle] = useState("");
  const [size, setSize] = useState("");
  const [ratio, setRatio] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultImages, setResultImages] = useState<string[]>([]);

  function handleSurpriseMe() {
    setPrompt("A futuristic city skyline at sunset, vibrant colors, ultra-detailed");
  }

  async function handleGenerate() {
    setToast("");
    setLoading(true);
    setResultImages([]);
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          imageCount,
          model,
          style,
          size,
          ratio,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate image");
      }
      const data = await res.json();
      setResultImages(Array.isArray(data.images) ? data.images : []);
    } catch (e: any) {
      setToast(e.message || "Failed to generate image");
    } finally {
      setLoading(false);
    }
  }

  function handleTab(tab: string) {
    setSelectedTab(tab);
    if (tab !== "Image") {
      setToast("This feature is not available yet.");
      setTimeout(() => setToast(""), 2000);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black p-8">
      <h1 className="text-3xl font-bold mb-6 text-black dark:text-zinc-50">Create Hub</h1>
      <div className="flex gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 rounded-t-lg font-medium border-b-2 transition-colors ${selectedTab === tab ? "border-blue-500 bg-white dark:bg-zinc-900" : "border-transparent bg-zinc-100 dark:bg-zinc-800"}`}
            onClick={() => handleTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      {selectedTab === "Image" ? (
        <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-lg shadow p-6 flex flex-col gap-4">
          <textarea
            className="w-full h-24 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-black dark:text-zinc-50"
            placeholder="Describe your NFT (e.g. 'A cyberpunk cat riding a motorcycle')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            className="self-end px-3 py-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-sm"
            onClick={handleSurpriseMe}
            type="button"
          >
            Surprise me
          </button>
          <div className="flex flex-wrap gap-4 mt-2">
            <div>
              <label className="block text-xs mb-1">Image count</label>
              <input
                type="number"
                min={1}
                max={10}
                value={imageCount}
                onChange={(e) => setImageCount(Number(e.target.value))}
                className="w-16 p-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-24 p-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Style</label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-24 p-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Size</label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-20 p-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Ratio</label>
              <input
                type="text"
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
                className="w-20 p-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
              />
            </div>
          </div>
          <button
            className="mt-6 w-full py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            onClick={handleGenerate}
            type="button"
            disabled={loading || !prompt.trim()}
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-lg shadow p-6 flex items-center justify-center text-zinc-400">
          {toast ? toast : "Feature coming soon."}
        </div>
      )}
      {loading && (
        <div className="mt-6 text-blue-600">Generating images...</div>
      )}
      {resultImages.length > 0 && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {resultImages.map((url: string, idx: number) => (
            <div key={idx} className="rounded-xl overflow-hidden border border-white/10 bg-white/5">
              <img src={url} alt={`AI ${idx + 1}`} className="w-full h-auto" />

              <div className="p-3 flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      // Pass all prompt settings for full metadata
                      const prepared = await prepareMint(url, prompt, model, style, size, ratio);
                      const qs = new URLSearchParams({
                        tokenUri: prepared.tokenUri,
                        preview: prepared.preview,
                      });
                      window.location.href = `/mint?${qs.toString()}`;
                    } catch (e: any) {
                      alert(e?.message || "Mint failed");
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm"
                >
                  Mint
                </button>

                <a
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
