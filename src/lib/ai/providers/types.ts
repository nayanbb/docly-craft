import type { ExtractedDocument } from "@/lib/ai/document/document-types";

export interface SummaryOptions {
  length?: "short" | "medium" | "detailed";
  focus?: "general" | "key_points" | "executive";
}

export interface SummaryResult {
  overview: string;
  keyPoints: string[];
  importantDetails: string[];
  conclusion: string;
  rawMarkdown: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sourcePages?: number[];
  timestamp?: number;
}

export interface ChatAnswer {
  answer: string;
  sourcePages: number[];
  relevantSnippets: Array<{ pageNumber: number; snippet: string }>;
}

export interface NotesOptions {
  style?: "cornell" | "outline" | "concept" | "brief";
}

export interface NoteConcept {
  term: string;
  definition: string;
}

export interface NoteSection {
  heading: string;
  subheadings?: Array<{ title: string; points: string[] }>;
  bulletPoints: string[];
  concepts?: NoteConcept[];
  keyFacts?: string[];
}

export interface NotesResult {
  title: string;
  summary: string;
  sections: NoteSection[];
  rawMarkdown: string;
}

export type QuestionType = "mcq" | "short" | "long" | "mixed";
export type QuestionDifficulty = "easy" | "medium" | "hard" | "mixed";

export interface QuestionOptions {
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  count?: 5 | 10 | 20 | 30;
}

export interface QuestionItem {
  id: string;
  type: "mcq" | "short" | "long";
  question: string;
  options?: string[]; // 4 items for MCQ (A, B, C, D)
  correctAnswer?: string;
  explanation?: string;
  expectedAnswerPoints?: string[];
  sourcePage?: number;
}

export interface QuestionResult {
  questions: QuestionItem[];
  summary?: string;
}

export interface TranslateOptions {
  sourceLanguage?: string;
}

export interface TranslateResult {
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage: string;
  pages: Array<{ pageNumber: number; text: string }>;
}

export interface ResumeAnalysisOptions {
  jobDescription?: string;
  targetRole?: string;
}

export interface ResumeAnalysisResult {
  candidateName?: string;
  overallScore: number; // 0 - 100 Docly Resume Score
  summary: string;
  detectedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
  bulletPointFeedback: Array<{ original: string; suggested: string; reason: string }>;
  formattingIssues: string[];
  keywordMatches: Array<{ keyword: string; matched: boolean; importance: "high" | "medium" | "low" }>;
  actionableRecommendations: string[];
  rawMarkdown: string;
}

export interface DocumentGenerationOptions {
  prompt: string;
  documentType: "cover_letter" | "project_report" | "meeting_notes" | "agreement" | "resume" | "general";
  tone?: "professional" | "casual" | "academic" | "persuasive";
  length?: "short" | "medium" | "detailed";
  variables?: Record<string, string>;
}

export interface DocumentGenerationResult {
  title: string;
  documentType: string;
  contentMarkdown: string;
  sections: Array<{ heading: string; body: string }>;
  suggestedFilename: string;
}

export interface DocumentAssistantOptions {
  mode: "explain" | "action_items" | "key_takeaways" | "custom";
  query?: string;
  selectedText?: string;
}

export interface DocumentAssistantResult {
  answer: string;
  sourcePages: number[];
  actionItems?: string[];
  keyTakeaways?: string[];
  rawMarkdown: string;
}

/**
 * Universal AI Provider Interface.
 * Applications code to this interface rather than binding directly to any specific AI vendor.
 * Guarantees that no API keys or secrets need to live in frontend client code.
 */
export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly isConfigured: boolean;
  readonly statusMessage?: string;

  summarize(doc: ExtractedDocument, options?: SummaryOptions): Promise<SummaryResult>;
  chat(doc: ExtractedDocument, query: string, history?: ChatMessage[]): Promise<ChatAnswer>;
  generateNotes(doc: ExtractedDocument, options?: NotesOptions): Promise<NotesResult>;
  generateQuestions(doc: ExtractedDocument, options?: QuestionOptions): Promise<QuestionResult>;
  translate(
    doc: ExtractedDocument,
    targetLanguage: string,
    options?: TranslateOptions,
  ): Promise<TranslateResult>;
  analyzeResume(
    resumeText: string,
    options?: ResumeAnalysisOptions,
  ): Promise<ResumeAnalysisResult>;
  generateDocument(
    options: DocumentGenerationOptions,
  ): Promise<DocumentGenerationResult>;
  assistDocument(
    doc: ExtractedDocument,
    options: DocumentAssistantOptions,
  ): Promise<DocumentAssistantResult>;
}

export class AIProviderNotConfiguredError extends Error {
  constructor(
    message: string = "AI provider is not configured yet. To enable generative AI output, connect a secure AI provider.",
  ) {
    super(message);
    this.name = "AIProviderNotConfiguredError";
  }
}
