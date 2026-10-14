export interface Source {
  id: number;
  title: string;
  url: string;
  snippet: string;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  followUps: string[];
  status: "complete" | "failed" | "streaming";
  created_at: string;
  model?: ModelAttribution | null;
  answerKind?: "ai" | "sources-only" | "no-sources" | null;
}
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  selected_model?: string | null;
}
export interface ModelAttribution {
  id: string;
  name: string;
  provider: "Groq";
  preview: boolean;
}
export interface ModelOption extends ModelAttribution {
  available: boolean;
  unavailableReason?: string;
  maxInputBytes: number;
  maxOutputTokens: number;
}
export interface ModelCatalogue {
  defaultModelId: string;
  models: ModelOption[];
  canSelect: boolean;
  answerMode: "ai" | "sources-only";
}
export type SearchEvent =
  | {
      event: "meta";
      data: {
        requestId: string;
        conversationId: string | null;
        answerMode: "ai" | "sources-only";
        remaining: number;
        requestedModelId?: string | null;
      };
    }
  | { event: "status"; data: { stage: "searching" | "answering" } }
  | { event: "sources"; data: { sources: Source[] } }
  | { event: "delta"; data: { text: string } }
  | { event: "follow_ups"; data: { questions: string[] } }
  | { event: "done"; data: { conversationId: string | null; model?: ModelAttribution | null; answerKind?: Message["answerKind"] } }
  | { event: "error"; data: { code: string; message: string; retryAfter?: number } };
