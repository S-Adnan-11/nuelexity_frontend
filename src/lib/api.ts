import { BACKEND_URL } from "./config";
import { readSearchEvents } from "./stream";
import type { Conversation, Message, SearchEvent } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
async function request(path: string, token: string | undefined, options: RequestInit = {}) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    signal: options.signal || AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string };
    } | null;
    throw new ApiError(
      body?.error?.message || "This request failed. Please try again later.",
      response.status,
      body?.error?.code || "REQUEST_FAILED",
      Number(response.headers.get("Retry-After")) || undefined,
    );
  }
  return response;
}
export async function listConversations(
  token: string,
  signal?: AbortSignal,
  offset = 0,
): Promise<Conversation[]> {
  const response = await request(`/conversations?offset=${offset}`, token, { signal });
  return ((await response.json()) as { conversations: Conversation[] }).conversations;
}
export async function getConversation(
  id: string,
  token: string,
  signal?: AbortSignal,
): Promise<{ conversation: Conversation; messages: Message[] }> {
  const response = await request(`/conversations/${encodeURIComponent(id)}`, token, { signal });
  return response.json();
}
export async function deleteConversation(id: string, token: string) {
  await request(`/conversations/${encodeURIComponent(id)}`, token, { method: "DELETE" });
}
export async function search(
  input: {
    query: string;
    conversationId?: string;
    turnstileToken?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  },
  token: string | undefined,
  signal: AbortSignal,
  onEvent: (event: SearchEvent) => void,
) {
  const response = await request("/nuelexity_ask", token, {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  });
  if (!response.body || !response.headers.get("Content-Type")?.includes("text/event-stream"))
    throw new Error("The server didn't return an answer stream.");
  for await (const event of readSearchEvents(response.body)) {
    if (event.event === "error") throw new ApiError(event.data.message, 503, event.data.code);
    onEvent(event);
  }
}
