export async function downloadArchive(ids: string[], filename: string, mode: "all" | "photos" | "videos" = "all", onProgress?: (percent: number | null) => void) {
  const response = await fetch("/api/content-library/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, filename, mode }) });
  if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error || "No se pudo preparar la descarga."); }
  if (!response.body) throw new Error("La descarga no está disponible.");
  const total = Number(response.headers.get("content-length")) || null, reader = response.body.getReader(), chunks: BlobPart[] = []; let received = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value.slice().buffer); received += value.length; onProgress?.(total ? Math.min(100, Math.round(received / total * 100)) : null); }
  const url = URL.createObjectURL(new Blob(chunks, { type: "application/zip" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${filename}.zip`; anchor.click(); URL.revokeObjectURL(url); onProgress?.(100);
}
