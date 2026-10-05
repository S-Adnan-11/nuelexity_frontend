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
}
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
export type SearchEvent =
  | {
      event: "meta";
      data: {
        requestId: string;
        conversationId: string | null;
        answerMode: "ai" | "sources-only";
        remaining: number;
      };
    }
  | { event: "status"; data: { stage: "searching" | "answering" } }
  | { event: "sources"; data: { sources: Source[] } }
  | { event: "delta"; data: { text: string } }
  | { event: "follow_ups"; data: { questions: string[] } }
  | { event: "done"; data: { conversationId: string | null } }
  | { event: "error"; data: { code: string; message: string } };
