import { BACKEND_URL } from "./config";
import { readSearchEvents } from "./stream";
import type { Conversation, Message, ModelCatalogue, SearchEvent } from "./types";
import { isModelAttribution } from "./models";
import { guestPassStore } from "./guest-pass";
import { safeFollowUps } from "./follow-ups";
import { BackendStartup, withAbort } from "./startup";

const raw = (path: string, options: RequestInit = {}) => fetch(`${BACKEND_URL}${path}`, {
  ...options, signal: options.signal || AbortSignal.timeout(15000),
});
export const backendStartup = new BackendStartup((path, signal) => raw(path, { signal }));

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
  const settings = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };
  let early: Response | undefined;
  if (!options.method || options.method === "GET") {
    await withAbort(backendStartup.ensure(async signal => {
      early = await raw(path, { ...settings, signal });
      return early;
    }), options.signal ?? undefined);
  }
  options.signal?.throwIfAborted();
  const response = early || await raw(path, settings);
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
  const detail = await response.json() as { conversation: Conversation; messages: Message[] };
  return { ...detail, messages: detail.messages.map(message => ({ ...message, followUps: safeFollowUps(message.followUps) })) };
}
export async function deleteConversation(id: string, token: string, signal?: AbortSignal) {
  await request(`/conversations/${encodeURIComponent(id)}`, token, { method: "DELETE", signal });
}
export async function getModels(token?: string, signal?: AbortSignal): Promise<ModelCatalogue> {
  const response = await request("/models", token, { signal });
  const body = await response.json();
  if (typeof body.defaultModelId !== "string" || typeof body.canSelect !== "boolean" ||
      !["ai", "sources-only"].includes(body.answerMode) || !Array.isArray(body.models) ||
      !body.models.every((model: unknown) => isModelAttribution(model) && typeof (model as {available?: unknown}).available === "boolean"))
    throw new Error("Model availability returned an invalid response.");
  return body;
}
export async function setConversationModel(id: string, modelId: string, token: string, signal?: AbortSignal) {
  await request(`/conversations/${encodeURIComponent(id)}/model`, token, {
    method: "PUT", body: JSON.stringify({ modelId }), signal,
  });
}
const guestHeaders = (): Record<string, string> => {
  const pass = guestPassStore.read();
  return pass ? { "X-Guest-Pass": pass } : {};
};
export interface GuestSession {
  verified: boolean;
  verificationRequired: boolean;
  expiresAt: number | null;
}
export async function getGuestSession(signal?: AbortSignal): Promise<GuestSession> {
  const response = await request("/guest/session", undefined, { headers: guestHeaders(), signal });
  const body = await response.json();
  if (
    typeof body.verified !== "boolean" ||
    typeof body.verificationRequired !== "boolean" ||
    !(body.expiresAt === null || typeof body.expiresAt === "number")
  )
    throw new Error("Guest verification returned an invalid response.");
  if (!body.verified) guestPassStore.clear();
  return body;
}
export async function verifyGuestChallenge(turnstileToken: string, signal: AbortSignal) {
  const response = await request("/guest/session", undefined, {
    method: "POST",
    body: JSON.stringify({ turnstileToken }),
    signal,
  });
  const body = await response.json();
  signal.throwIfAborted();
  if (
    typeof body.pass !== "string" ||
    body.pass.length > 1024 ||
    !body.pass.startsWith("v1.") ||
    typeof body.expiresAt !== "number" ||
    body.expiresAt <= Date.now()
  )
    throw new Error("Guest verification returned an invalid response.");
  guestPassStore.save(body.pass);
  return body.expiresAt as number;
}
export async function search(
  input: {
    query: string;
    conversationId?: string;
    modelId?: string;
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
    signal: AbortSignal.any([signal, AbortSignal.timeout(75000)]),
    headers: token ? {} : guestHeaders(),
  });
  if (!response.body || !response.headers.get("Content-Type")?.includes("text/event-stream"))
    throw new Error("The server didn't return an answer stream.");
  for await (const event of readSearchEvents(response.body)) {
    if (event.event === "error") throw new ApiError(event.data.message, 503, event.data.code, event.data.retryAfter);
    onEvent(event);
  }
}
