import { useCallback, useEffect, useRef, useState } from "react";
import { listConversations } from "./api";
import type { Conversation } from "./types";

// Match the existing API contract, including its largest accepted offset.
const pageSize = 30;
const maximumOffset = 10000;
const merge = (previous: Conversation[], page: Conversation[]) =>
  [...new Map([...previous, ...page].map(thread => [thread.id, thread])).values()];

export function useConversationLibrary(token?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [status, setStatus] = useState<"loading" | "refreshing" | "ready" | "failed">("loading");
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const request = useRef<AbortController | null>(null);
  const nextOffset = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) { setStatus("ready"); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus(current => current === "ready" || current === "refreshing" ? "refreshing" : "loading");
    setLoadingMore(false);
    setError(null);
    setMoreError(null);
    try {
      // Refresh every loaded page atomically, keeping the visible library while waiting.
      const pages = Math.max(1, Math.ceil(nextOffset.current / pageSize));
      let threads: Conversation[] = [], offset = 0, more = false;
      for (let page = 0; page < pages; page++) {
        const result = await listConversations(token, controller.signal, offset);
        if (controller.signal.aborted) return;
        threads = merge(threads, result);
        offset += result.length;
        more = result.length === pageSize && offset <= maximumOffset;
        if (!more) break;
      }
      if (controller.signal.aborted) return;
      nextOffset.current = offset;
      setConversations(threads);
      setHasMore(more);
      setStatus("ready");
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError((failure as Error).message);
      setStatus("failed");
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [token]);

  async function loadMore() {
    if (!token || !hasMore || request.current || status !== "ready") return;
    const controller = new AbortController();
    request.current = controller;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const result = await listConversations(token, controller.signal, nextOffset.current);
      if (controller.signal.aborted) return;
      nextOffset.current += result.length;
      setConversations(previous => merge(previous, result));
      setHasMore(result.length === pageSize && nextOffset.current <= maximumOffset);
    } catch (failure) {
      if (!controller.signal.aborted) setMoreError((failure as Error).message);
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    void refresh();
    return () => request.current?.abort();
  }, [refresh]);

  return { conversations, status, error, refresh, hasMore, loadingMore, moreError, loadMore };
}
