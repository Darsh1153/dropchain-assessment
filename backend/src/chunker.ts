export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

const DEFAULT_MAX_CHARS = 800;
const DEFAULT_OVERLAP = 150;

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Prefer splitting on paragraph boundaries, then pack paragraphs into chunks.
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const paragraph of paragraphs) {
    // A single paragraph larger than the window is split by sliding character window.
    if (paragraph.length > maxChars) {
      flush();
      for (const piece of slidingWindow(paragraph, maxChars, overlap)) {
        chunks.push(piece);
      }
      continue;
    }

    if (current.length + paragraph.length + 2 > maxChars) {
      flush();
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  flush();

  return chunks;
}

function slidingWindow(text: string, size: number, overlap: number): string[] {
  const step = Math.max(1, size - overlap);
  const pieces: string[] = [];
  for (let start = 0; start < text.length; start += step) {
    pieces.push(text.slice(start, start + size).trim());
    if (start + size >= text.length) break;
  }
  return pieces.filter(Boolean);
}
