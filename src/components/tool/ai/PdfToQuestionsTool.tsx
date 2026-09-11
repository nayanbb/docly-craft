import { useState } from "react";
import {
  FileQuestion,
  Copy,
  Download,
  Check,
  RotateCcw,
  Sparkles,
  BookOpen,
  Eye,
  EyeOff,
} from "lucide-react";
import type { ExtractedDocument } from "@/lib/ai/document/document-types";
import {
  useAiProviderStatus,
  type QuestionOptions,
  type QuestionResult,
  type QuestionType,
  type QuestionDifficulty,
} from "@/lib/ai/providers";
import { generateDocumentQuestions, formatQuestionsAsText } from "@/lib/ai/questions";
import { downloadBlob } from "@/lib/files/download";
import { AiToolHeader } from "@/components/tool/ai/AiToolHeader";
import { ProviderNotice } from "@/components/tool/ai/ProviderNotice";

interface PdfToQuestionsToolProps {
  document: ExtractedDocument;
  onReset: () => void;
}

export function PdfToQuestionsTool({ document, onReset }: PdfToQuestionsToolProps) {
  const [type, setType] = useState<QuestionType>("mixed");
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("medium");
  const [count, setCount] = useState<5 | 10 | 20 | 30>(5);
  const [result, setResult] = useState<QuestionResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});

  const { configured: providerReady } = useAiProviderStatus();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await generateDocumentQuestions(document, { type, difficulty, count });
      setResult(res);
      setRevealedAnswers({});
      setSelectedOptions({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate questions.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectOption = (questionId: string, optionIdx: number) => {
    setSelectedOptions((prev) => ({ ...prev, [questionId]: optionIdx }));
  };

  const handleCopy = () => {
    if (!result) return;
    const text = formatQuestionsAsText(result, document.filename);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const text = formatQuestionsAsText(result, document.filename);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const name = document.filename.replace(/\.[^/.]+$/, "") + "-questions.txt";
    downloadBlob(blob, name);
  };

  return (
    <div className="space-y-6">
      <AiToolHeader document={document} />

      {!providerReady && !result && (
        <ProviderNotice
          featureName="question generation"
          customMessage="Docly has extracted and structured your document content. Select your desired question parameters below. Generating targeted practice questions and test quizzes requires a configured AI provider backend."
        />
      )}

      {/* Options Bar */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Question Configuration</h3>
          </div>

          <div className="flex items-center gap-2">
            {providerReady && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {isGenerating ? "Generating Questions..." : "Generate Practice Questions"}
              </button>
            )}

            {result && (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download TXT
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              New PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Question Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Question Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as QuestionType)}
              className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-xs text-foreground focus:outline-none"
            >
              <option value="mcq">Multiple Choice (MCQ)</option>
              <option value="short">Short Answer</option>
              <option value="long">Long Answer / Essay</option>
              <option value="mixed">Mixed Formats</option>
            </select>
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Difficulty Level</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
              className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-xs text-foreground focus:outline-none"
            >
              <option value="easy">Easy (Recall & Facts)</option>
              <option value="medium">Medium (Comprehension)</option>
              <option value="hard">Hard (Analysis & Synthesis)</option>
              <option value="mixed">Mixed Difficulty</option>
            </select>
          </div>

          {/* Number of Questions */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Number of Questions</label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value) as 5 | 10 | 20 | 30)}
              className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-xs text-foreground focus:outline-none"
            >
              <option value={5}>5 Questions</option>
              <option value={10}>10 Questions</option>
              <option value={20}>20 Questions</option>
              <option value={30}>30 Questions</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Questions List */}
      {result && result.questions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Generated Questions ({result.questions.length})
            </span>
          </div>

          {result.questions.map((q, idx) => {
            const isRevealed = Boolean(revealedAnswers[q.id]);
            const selectedOpt = selectedOptions[q.id];

            return (
              <div
                key={q.id || idx}
                className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="inline-block rounded px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider bg-secondary text-muted-foreground mb-1">
                        {q.type.toUpperCase()}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground leading-snug">
                        {q.question}
                      </h4>
                    </div>
                  </div>

                  {q.sourcePage && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface border border-border px-2 py-1 text-[0.7rem] font-medium text-muted-foreground">
                      <BookOpen className="h-3 w-3 text-primary" />
                      Page {q.sourcePage}
                    </span>
                  )}
                </div>

                {/* MCQ Options */}
                {q.type === "mcq" && q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pl-9">
                    {q.options.map((opt, optIdx) => {
                      const letters = ["A", "B", "C", "D"];
                      const isSelected = selectedOpt === optIdx;

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => selectOption(q.id, optIdx)}
                          className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs text-left transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border bg-surface text-foreground hover:border-primary/40"
                          }`}
                        >
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[0.7rem] font-bold ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {letters[optIdx] || "•"}
                          </span>
                          <span className="leading-snug">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Answer Reveal Toggle */}
                <div className="pl-9 pt-2">
                  <button
                    type="button"
                    onClick={() => toggleReveal(q.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    {isRevealed ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    {isRevealed ? "Hide Answer & Explanation" : "Reveal Correct Answer"}
                  </button>

                  {isRevealed && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-2">
                      {q.correctAnswer && (
                        <div>
                          <span className="font-bold text-foreground">Answer: </span>
                          <span className="text-primary font-semibold">{q.correctAnswer}</span>
                        </div>
                      )}

                      {q.explanation && (
                        <p className="text-muted-foreground leading-relaxed">
                          <span className="font-bold text-foreground">Explanation: </span>
                          {q.explanation}
                        </p>
                      )}

                      {q.expectedAnswerPoints && q.expectedAnswerPoints.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-bold text-foreground block">
                            Key Evaluation Points:
                          </span>
                          <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                            {q.expectedAnswerPoints.map((pt, pIdx) => (
                              <li key={pIdx}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
