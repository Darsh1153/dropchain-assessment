import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import multer from "multer";
import { router } from "./routes.js";
import { formatProviderError, providerMode } from "./provider.js";
import path from "path";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

dotenv.config({
  path: path.resolve(process.cwd(), "../.env"),
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", mode: providerMode });
});

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is too large. Uploads must be under 1 MB."
        : err.message;
    res.status(400).json({ error: message });
    return;
  }

  if (err instanceof Error && err.message === "Only plain .txt files are supported.") {
    res.status(400).json({ error: err.message });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: formatProviderError(err) });
});

app.listen(PORT, () => {
  console.log(`RAG backend listening on port ${PORT} (provider mode: ${providerMode})`);
});
