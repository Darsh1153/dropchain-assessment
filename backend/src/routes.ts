import { Router, type Request, type Response } from "express";
import multer from "multer";
import { chunkText } from "./chunker.js";
import { vectorStore } from "./vectorStore.js";
import {
  embed,
  formatProviderError,
  generate,
  providerMode,
  type RetrievedContext,
} from "./provider.js";

const upload = multer({
  limits: { fileSize: 1024 * 1024 }, // 1 MB cap for "small" text files
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const isTextFile =
      file.mimetype === "text/plain" ||
      file.mimetype === "application/octet-stream" ||
      name.endsWith(".txt");

    if (!isTextFile) {
      cb(new Error("Only plain .txt files are supported."));
      return;
    }

    cb(null, true);
  },
});

export const router = Router();

/**
 * POST /api/ingest
 * Accepts either JSON { text, source? } or a multipart .txt upload (field "file").
 * Chunks the text, embeds each chunk, and stores it in the vector store.
 */
router.post("/ingest", upload.single("file"), async (req: Request, res: Response) => {
  try {
    let text = "";
    let source = "pasted-text";

    if (req.file) {
      text = req.file.buffer.toString("utf-8");
      source = req.file.originalname || "uploaded-file.txt";
    } else if (typeof req.body?.text === "string") {
      text = req.body.text;
      if (typeof req.body.source === "string" && req.body.source.trim()) {
        source = req.body.source.trim();
      }
    }

    if (!text.trim()) {
      return res.status(400).json({ error: "No text provided. Send { text } or a file." });
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return res.status(400).json({ error: "Text produced no usable chunks." });
    }

    vectorStore.clear();
    const embeddings = await embed(chunks);
    const added = vectorStore.add(
      chunks.map((chunk, i) => ({ text: chunk, embedding: embeddings[i], source })),
    );

    const stats = vectorStore.stats();
    return res.json({
      ok: true,
      mode: providerMode,
      chunksAdded: added,
      totalChunks: stats.chunkCount,
      sources: stats.sources,
    });
  } catch (err) {
    console.error("Ingest error:", err);
    return res.status(500).json({ error: errorMessage(err) });
  }
});


router.post("/query", async (req: Request, res: Response) => {
  try {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const k = clampK(req.body?.k);

    if (!question) {
      return res.status(400).json({ error: "A non-empty 'question' is required." });
    }
    if (vectorStore.size === 0) {
      return res.status(400).json({ error: "Knowledge base is empty. Ingest a document first." });
    }

    const [queryEmbedding] = await embed([question]);
    const results = vectorStore.search(queryEmbedding, k);

    const contexts: RetrievedContext[] = results.map((r) => ({
      text: r.text,
      source: r.source,
      score: r.score,
    }));

    const answer = await generate(question, contexts);

    return res.json({
      ok: true,
      mode: providerMode,
      answer,
      citations: results.map((r) => ({
        text: r.text,
        source: r.source,
        score: Number(r.score.toFixed(4)),
      })),
    });
  } catch (err) {
    console.error("Query error:", err);
    return res.status(500).json({ error: errorMessage(err) });
  }
});

/** POST /api/reset - clears the in-memory knowledge base. */
router.post("/reset", (_req: Request, res: Response) => {
  vectorStore.clear();
  return res.json({ ok: true, totalChunks: 0 });
});

function clampK(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 4;
  return Math.min(10, Math.max(1, Math.floor(n)));
}

function errorMessage(err: unknown): string {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return "File is too large. Uploads must be under 1 MB.";
    }
    return err.message;
  }

  if (err instanceof Error && err.message === "Only plain .txt files are supported.") {
    return err.message;
  }

  return formatProviderError(err);
}
