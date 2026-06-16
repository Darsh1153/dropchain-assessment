"use client";

import { useRef, useState } from "react";
import {
  ingestText,
  ingestFile,
  queryKnowledgeBase,
  resetKnowledgeBase,
  type Citation,
  type ProviderMode,
} from "@/lib/api";

interface KbStatus {
  chunks: number;
  sources: string[];
  mode: ProviderMode;
}

export default function Home() {
  const [docText, setDocText] = useState("");
  const [kb, setKb] = useState<KbStatus | null>(null);
  const [ingesting, setIngesting] = useState(false);

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [answerMode, setAnswerMode] = useState<ProviderMode | null>(null);

  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasKb = (kb?.chunks ?? 0) > 0;

  async function handleIngestText() {
    if (!docText.trim()) return;
    setError(null);
    setAnswer(null);
    setCitations([]);
    setAnswerMode(null);
    setIngesting(true);
    try {
      const res = await ingestText(docText, "pasted-text");
      setKb({ chunks: res.totalChunks, sources: res.sources, mode: res.mode });
    } catch (e) {
      setError(messageOf(e));
      setKb(null);
    } finally {
      setIngesting(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith(".txt") && file.type !== "text/plain") {
      setError("Please upload a plain .txt file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setError(null);
    setAnswer(null);
    setCitations([]);
    setAnswerMode(null);
    setIngesting(true);
    try {
      const content = await file.text();
      setDocText(content);
      const res = await ingestFile(file);
      setKb({ chunks: res.totalChunks, sources: res.sources, mode: res.mode });
    } catch (e) {
      setError(messageOf(e));
      setKb(null);
    } finally {
      setIngesting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAsk() {
    if (!question.trim() || !hasKb) return;
    setError(null);
    setAsking(true);
    setAnswer(null);
    setCitations([]);
    try {
      const res = await queryKnowledgeBase(question);
      setAnswer(res.answer);
      setCitations(res.citations);
      setAnswerMode(res.mode);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setAsking(false);
    }
  }

  async function handleClear() {
    setError(null);
    try {
      await resetKnowledgeBase();
    } catch (e) {
      setError(messageOf(e));
    }
    setKb(null);
    setDocText("");
    setAnswer(null);
    setCitations([]);
    setQuestion("");
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          Contextual AI Assistant
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-neutral-600">
          Upload a document, then ask questions answered strictly from its contents.
          Every answer is backed by the exact source snippets it was drawn from.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Knowledge base panel */}
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Knowledge Base
            </h2>
            <StatusBadge kb={kb} />
          </div>

          <textarea
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            placeholder="Paste a policy, product spec, or technical guide here..."
            className="h-56 w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-800 outline-none transition focus:border-neutral-400 focus:bg-white"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleIngestText}
              disabled={ingesting || !docText.trim()}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ingesting ? "Ingesting..." : "Ingest text"}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={ingesting}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
            >
              {ingesting ? "Uploading..." : "Upload .txt"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />

            {hasKb && (
              <button
                onClick={handleClear}
                className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 transition hover:text-red-600"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {/* Query panel */}
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Ask a Question
          </h2>

          <div className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              disabled={!hasKb}
              placeholder={hasKb ? "What would you like to know?" : "Ingest a document first"}
              className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-neutral-400 focus:bg-white disabled:opacity-50"
            />
            <button
              onClick={handleAsk}
              disabled={asking || !question.trim() || !hasKb}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {asking ? "Thinking..." : "Ask"}
            </button>
          </div>

          {!answer && !asking && (
            <p className="mt-6 text-sm text-neutral-400">
              The answer and its supporting citations will appear here.
            </p>
          )}

          {answer && (
            <div className="mt-6">
              <div className="rounded-lg bg-neutral-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Answer
                  {answerMode === "mock" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-700">
                      mock mode
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">
                  {answer}
                </p>
              </div>

              {citations.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Citations ({citations.length})
                  </h3>
                  <ul className="space-y-3">
                    {citations.map((c, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-neutral-200 bg-white p-3"
                      >
                        <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-400">
                          <span className="font-medium text-neutral-500">
                            {c.source} · #{i + 1}
                          </span>
                          <span title="cosine similarity">
                            score {c.score.toFixed(3)}
                          </span>
                        </div>
                        <p className="text-[13px] leading-relaxed text-neutral-600">
                          {c.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ kb }: { kb: KbStatus | null }) {
  if (!kb || kb.chunks === 0) {
    return <span className="text-xs text-neutral-400">empty</span>;
  }
  return (
    <span className="flex items-center gap-2 text-xs text-neutral-500">
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
      {kb.chunks} chunk{kb.chunks === 1 ? "" : "s"} · {kb.mode}
    </span>
  );
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}
