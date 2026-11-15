"use client";
import { useEffect, useRef, useState } from "react";
import type { IntakeProposal } from "@/lib/ai/sanitize";
import { Alert, Button } from "./ui";

const MAX_SIDE = 1600;
const MAX_BYTES = 4_000_000;

/** Downscales a photo to a JPEG (max 1600px) so phone photos stay well under the upload limit. */
async function toJpegBase64(file: File): Promise<{ mimeType: string; base64: string }> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const url = canvas.toDataURL("image/jpeg", 0.85);
    return { mimeType: "image/jpeg", base64: url.slice(url.indexOf(",") + 1) };
  } catch {
    // Fall back to the original bytes; the server checks type and size.
    if (file.size > MAX_BYTES) throw new Error("That image is larger than 4 MB. Try a smaller photo.");
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { mimeType: file.type, base64: btoa(bin) };
  }
}

/**
 * Upload or photograph a flyer. The image is read by the configured AI model into a
 * proposal; nothing is applied until the organizer reviews it.
 */
export function FlyerUpload({ onResult, onManual }: { onResult: (transcript: string, proposal: IntakeProposal) => void; onManual: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function read() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const img = await toJpegBase64(file);
      const res = await fetch("/api/ai/flyer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(img) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      onResult(String(data.transcript ?? ""), data.proposal as IntakeProposal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the flyer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line-strong bg-paper text-center hover:border-cardinal sm:w-[200px]"
          aria-label={file ? `Change flyer image (${file.name})` : "Choose a flyer image"}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="px-4 text-sm text-muted">
              <span aria-hidden className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-cardinal text-gold">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </span>
              Upload or snap a photo
            </span>
          )}
        </button>
        <div className="space-y-3 text-sm">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              setError(null);
              setFile(e.target.files?.[0] ?? null);
            }}
          />
          <p className="text-muted">
            A photo of a poster, a screenshot of an Instagram post, or the flyer file itself. The image is sent to this server’s AI model to read the
            event details, then discarded. It isn’t saved to your plan.
          </p>
          <ul className="space-y-1 text-muted">
            <li>· Dates are copied as written and marked for confirmation.</li>
            <li>· Anything not on the flyer stays Unknown.</li>
            <li>· You review every field before it’s applied.</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
              {file ? "Choose another image" : "Choose image"}
            </Button>
            <Button variant="primary" onClick={read} disabled={!file || busy}>
              {busy ? "Reading the flyer…" : "Read this flyer"}
            </Button>
          </div>
        </div>
      </div>
      {error && (
        <Alert tone="error" title="The flyer couldn't be read">
          <p>{error}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={read} disabled={!file || busy}>
              Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={onManual}>
              Fill the form instead
            </Button>
          </div>
        </Alert>
      )}
    </div>
  );
}
