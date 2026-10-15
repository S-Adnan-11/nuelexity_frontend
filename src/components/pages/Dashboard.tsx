import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  Globe,
  LogOut,
  Menu,
  Plus,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";
import {
  ApiError,
  deleteConversation,
  getConversation,
  getModels,
  listConversations,
  search,
  setConversationModel,
} from "@/lib/api";
import { TURNSTILE_SITE_KEY } from "@/lib/config";
import { useGuestSession } from "@/lib/useGuestSession";
import { supabase } from "@/lib/supabase/client";
import type { Conversation, Message, ModelCatalogue } from "@/lib/types";
import { answerModelLabel } from "@/lib/models";
import { useAuth } from "../AuthProvider";
import { Answer, safeSourceUrl } from "../Answer";
import { Turnstile } from "../Turnstile";
import { ModelSelector } from "../ModelSelector";
import { BrandLogo, BrandMark, ThreadSkeleton, WorkspaceSkeleton } from "../Brand";
import { GuestInvitation } from "../GuestInvitation";

const suggestions = [
  "How does an AI search engine find its sources?",
  "What is happening in renewable energy?",
  "Help me understand quantum computing",
];
export default function Dashboard() {
  const { session, loading } = useAuth();
  if (loading) return <WorkspaceSkeleton />;
  // A new identity gets a fresh workspace. Token renewal keeps the same one.
  return <Workspace key={session?.user.id ?? "guest"} />;
}

function Workspace() {
  const { session, loading, error: authError } = useAuth();
  const navigate = useNavigate();
  const token = session?.access_token,
    userId = session?.user.id;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [loadingThread, setLoadingThread] = useState(false);
  const [stage, setStage] = useState(""),
    [error, setError] = useState<string | null>(null);
  const [historyStatus, setHistoryStatus] = useState<"loading" | "refreshing" | "ready" | "failed">("loading");
  const [threadStatus, setThreadStatus] = useState<"idle" | "loading" | "refreshing" | "ready" | "failed">("idle");
  const [threadError, setThreadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [catalogue, setCatalogue] = useState<ModelCatalogue | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelSaveError, setModelSaveError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false),
    [copied, setCopied] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 800px)").matches);
  const sidebarRef = useRef<HTMLElement>(null);
  const guest = useGuestSession(!token && !loading);
  const controllerRef = useRef<AbortController | null>(null);
  const historyController = useRef<AbortController | null>(null);
  const listController = useRef<AbortController | null>(null);
  const modelsController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const conversationRef = useRef<string | null>(null);
  const messageRef = useRef(messages);
  messageRef.current = messages;
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef(new Map<string, number>());
  const pendingScroll = useRef<number | null>(null);
  const nearBottom = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectedRef = useRef<string | null>(null);
  const modelWrites = useRef(Promise.resolve());
  const modelEpoch = useRef(0);
  const modelRevision = useRef(0);
  const activeKey = userId ? `nuelexity:active-thread:${userId}` : null;
  const effectiveModelId = token ? selectedModelId ?? catalogue?.defaultModelId ?? null : catalogue?.defaultModelId ?? null;
  selectedRef.current = effectiveModelId;
  const modelReady = threadStatus !== "failed" && !!catalogue && !modelsLoading && !modelsError && !modelSaving && !modelSaveError &&
    (catalogue.answerMode === "sources-only" || !!catalogue.models.find((model) => model.id === effectiveModelId && model.available));

  const refreshModels = useCallback(async (signal?: AbortSignal) => {
    modelsController.current?.abort();
    const controller = new AbortController();
    modelsController.current = controller;
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    setModelsLoading(true);
    try {
      const result = await getModels(token, controller.signal);
      if (!controller.signal.aborted && mounted.current) { setCatalogue(result); setModelsError(null); }
    } catch (error) {
      if (!controller.signal.aborted && mounted.current) setModelsError((error as Error).message);
    } finally {
      if (!controller.signal.aborted && mounted.current) setModelsLoading(false);
    }
  }, [token]);
  useEffect(() => {
    const controller = new AbortController();
    void refreshModels(controller.signal);
    return () => controller.abort();
  }, [refreshModels]);

  function rememberThread(id: string | null) {
    if (!activeKey) return;
    try {
      if (id) sessionStorage.setItem(activeKey, id);
      else sessionStorage.removeItem(activeKey);
    } catch { /* The server still stores the conversation if browser storage is unavailable. */ }
  }
  function persistModel(id: string, modelId: string) {
    if (!token) return;
    const epoch = modelEpoch.current, revision = ++modelRevision.current;
    setModelSaving(true);
    setModelSaveError(null);
    // Serialize quick changes: an older network response cannot become the saved choice.
    modelWrites.current = modelWrites.current.catch(() => {}).then(async () => {
      if (epoch !== modelEpoch.current) return;
      await setConversationModel(id, modelId, token);
    }).catch((failure) => {
      if (epoch === modelEpoch.current && revision === modelRevision.current)
        setModelSaveError(`Your choice was not saved. Choose a model again to retry. ${(failure as Error).message}`);
    }).finally(() => {
      if (epoch === modelEpoch.current && revision === modelRevision.current) setModelSaving(false);
    });
  }
  function chooseModel(modelId: string) {
    setSelectedModelId(modelId);
    selectedRef.current = modelId;
    setModelSaveError(null);
    if (conversationId) persistModel(conversationId, modelId);
  }

  const refreshHistory = useCallback(async (signal?: AbortSignal) => {
    if (!token) { setHistoryStatus("ready"); return; }
    listController.current?.abort();
    const controller = new AbortController();
    listController.current = controller;
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    setHistoryStatus((current) => current === "ready" || current === "refreshing" ? "refreshing" : "loading");
    setHistoryError(null);
    try {
      const result = await listConversations(token, controller.signal);
      if (controller.signal.aborted || !mounted.current || listController.current !== controller) return;
      setConversations(result);
      setHistoryStatus("ready");
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;
      setHistoryError((error as Error).message);
      setHistoryStatus("failed");
    }
  }, [token]);
  useEffect(() => {
    const controller = new AbortController();
    void refreshHistory(controller.signal);
    return () => controller.abort();
  }, [refreshHistory]);
  useEffect(() => {
    mounted.current = true;
    if (userId) {
      try {
        const saved = sessionStorage.getItem(`nuelexity:active-thread:${userId}`);
        if (saved) void openThread(saved);
      } catch { /* The library remains available without browser storage. */ }
    }
  }, []);
  useEffect(
    () => () => {
      mounted.current = false;
      modelEpoch.current++;
      controllerRef.current?.abort();
      controllerRef.current = null;
      listController.current?.abort();
      modelsController.current?.abort();
      historyController.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const update = () => { setNarrow(media.matches); if (!media.matches) setMobileOpen(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobileOpen || !narrow) return;
    const previous = document.activeElement as HTMLElement | null;
    sidebarRef.current?.querySelector<HTMLButtonElement>(".sidebar-close")?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { setMobileOpen(false); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? []);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [mobileOpen, narrow]);

  function newSearch() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    historyController.current?.abort();
    historyController.current = null;
    setMessages([]);
    setConversationId(null);
    conversationRef.current = null;
    setThreadStatus("idle");
    setThreadError(null);
    setQuery("");
    setError(null);
    setBusy(false);
    setLoadingThread(false);
    setMobileOpen(false);
    modelEpoch.current++;
    setSelectedModelId(null);
    selectedRef.current = catalogue?.defaultModelId ?? null;
    setModelSaving(false);
    setModelSaveError(null);
    rememberThread(null);
    inputRef.current?.focus();
  }
  function saveScroll() {
    const id = conversationRef.current;
    if (!id || !userId || !scrollRef.current || !messageRef.current.length || pendingScroll.current !== null) return;
    const top = scrollRef.current.scrollTop;
    scrollPositions.current.set(id, top);
    try { sessionStorage.setItem(`nuelexity:scroll:${userId}:${id}`, String(top)); } catch {}
  }
  async function openThread(id: string) {
    if (!token || busy) return;
    const same = conversationRef.current === id;
    saveScroll();
    historyController.current?.abort();
    const controller = new AbortController();
    historyController.current = controller;
    modelEpoch.current++;
    setModelSaving(false);
    setModelSaveError(null);
    setError(null);
    setThreadError(null);
    setLoadingThread(true);
    setThreadStatus(same && messageRef.current.length ? "refreshing" : "loading");
    setMobileOpen(false);
    conversationRef.current = id;
    setConversationId(id);
    rememberThread(id);
    if (!same) { setMessages([]); setSelectedModelId(null); }
    try {
      const detail = await getConversation(id, token, controller.signal);
      if (controller.signal.aborted || !mounted.current || historyController.current !== controller) return;
      setMessages(detail.messages);
      setSelectedModelId(detail.conversation.selected_model ?? null);
      selectedRef.current = detail.conversation.selected_model ?? catalogue?.defaultModelId ?? null;
      setThreadStatus("ready");
      if (!same) {
        let saved = scrollPositions.current.get(id);
        try { saved ??= Number(sessionStorage.getItem(`nuelexity:scroll:${userId}:${id}`) ?? NaN); } catch {}
        pendingScroll.current = Number.isFinite(saved) ? saved! : 0;
      }
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;
      setThreadError((error as Error).message);
      setThreadStatus("failed");
    } finally {
      if (historyController.current === controller && mounted.current) {
        historyController.current = null;
        setLoadingThread(false);
      }
    }
  }
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    if (pendingScroll.current !== null) { scroll.scrollTop = pendingScroll.current; pendingScroll.current = null; }
    else if (busy && nearBottom.current) scroll.scrollTop = scroll.scrollHeight;
  }, [messages, busy]);
  useEffect(() => {
    const viewport = window.visualViewport;
    function resize() {
      const height = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--workspace-height", `${height}px`);
      document.documentElement.dataset.compactViewport = String(height < 650);
    }
    resize();
    viewport?.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      document.documentElement.style.removeProperty("--workspace-height");
      delete document.documentElement.dataset.compactViewport;
    };
  }, []);
  async function removeThread(id: string) {
    if (!token || busy || !window.confirm("Delete this conversation and its messages?")) return;
    try {
      await deleteConversation(id, token);
      if (!mounted.current) return;
      if (conversationId === id) newSearch();
      await refreshHistory();
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function submit(value = query) {
    const question = value.trim();
    if (!question || question.length > 1000 || busy || loadingThread || loading) return;
    if (!modelReady) {
      setError("Select an available model and save your choice before sending. If models could not load, refresh them.");
      return;
    }
    if (!token && (!guest.ready || guest.checking || guest.verifying)) {
      setError("Complete the verification before searching.");
      return;
    }
    const controller = new AbortController();
    const requestModelId = effectiveModelId; // Frozen for this request, even if the selector changes.
    controllerRef.current = controller;
    setBusy(true);
    setError(null);
    setQuery("");
    setStage("Preparing your search");
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      sources: [],
      followUps: [],
      status: "complete",
      created_at: new Date().toISOString(),
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      ...userMessage,
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming",
    };
    const guestHistory = !token
      ? messages
          .filter((m) => m.status === "complete")
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }))
      : undefined;
    nearBottom.current = true;
    setMessages((previous) => [...previous, userMessage, assistantMessage]);
    const update = (change: Partial<Message> | ((message: Message) => Partial<Message>)) =>
      setMessages((previous) =>
        previous.map((m) =>
          m.id === assistantId
            ? { ...m, ...(typeof change === "function" ? change(m) : change) }
            : m,
        ),
      );
    try {
      await search(
        {
          query: question,
          ...(catalogue?.answerMode === "ai" && requestModelId ? { modelId: requestModelId } : {}),
          ...(token && conversationId ? { conversationId } : {}),
          ...(guestHistory?.length ? { history: guestHistory } : {}),
        },
        token,
        controller.signal,
        (event) => {
          if (controllerRef.current !== controller) return;
          switch (event.event) {
            case "meta":
              setConversationId(event.data.conversationId);
              conversationRef.current = event.data.conversationId;
              rememberThread(event.data.conversationId);
              if (token && event.data.conversationId && selectedRef.current && selectedRef.current !== requestModelId)
                persistModel(event.data.conversationId, selectedRef.current);
              setRemaining(event.data.remaining);
              break;
            case "status":
              setStage(
                event.data.stage === "searching" ? "Searching the web" : "Reading the sources",
              );
              break;
            case "sources":
              update({ sources: event.data.sources });
              break;
            case "delta":
              update((m) => ({ content: m.content + event.data.text }));
              break;
            case "follow_ups":
              update({ followUps: event.data.questions });
              break;
            case "done":
              update({ status: "complete", model: event.data.model ?? null, answerKind: event.data.answerKind ?? null });
              break;
          }
        },
      );
    } catch (error) {
      if (controllerRef.current !== controller) return;
      update({ status: "failed", followUps: [] });
      setQuery((current) => current || question);
      if (controller.signal.aborted) setError("Search stopped. Any text above may be incomplete.");
      else {
        if (!token && error instanceof ApiError && error.code === "BOT_SESSION_EXPIRED")
          guest.reset();
        if (error instanceof ApiError && ["UNKNOWN_MODEL", "MODEL_UNAVAILABLE", "MODEL_PERMISSION"].includes(error.code))
          void refreshModels();
        const failure = error as Error;
        const retry =
          error instanceof ApiError && error.retryAfter
            ? ` Try again after ${new Date(Date.now() + error.retryAfter * 1000).toLocaleString()}.`
            : "";
        setError(failure.message + retry);
      }
    } finally {
      if (controllerRef.current === controller && mounted.current) {
        controllerRef.current = null;
        setBusy(false);
        setStage("");
        if (token) void refreshHistory();
      }
    }
  }
  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }
  async function signOut() {
    controllerRef.current?.abort();
    const result = await supabase?.auth.signOut();
    if (result?.error) {
      setError("Sign-out failed. Please try again.");
      return;
    }
    navigate("/dashboard");
  }
  async function copy(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
    } catch {
      setError("Couldn't copy the answer. You can select its text to copy it.");
    }
  }

  return (
    <div className="research-app">
      <button
        className="mobile-menu icon-button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu size={21} />
      </button>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside ref={sidebarRef} inert={narrow && !mobileOpen} className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link className="brand" to="/dashboard" onClick={newSearch}>
          <BrandLogo />
        </Link>
        <button
          className="sidebar-close icon-button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        <button className="new-search" onClick={newSearch}>
          <Plus size={18} /> New search <kbd>↗</kbd>
        </button>
        <div className="sidebar-heading">
          <BookOpen size={15} /> Your library
        </div>
        <nav aria-label="Saved conversations" className="thread-list">
          {historyError && (
            <div className="sidebar-note" role="status">
              {historyError}
              <button className="text-button" onClick={() => void refreshHistory()}>
                Retry
              </button>
            </div>
          )}
          {!token && (
            <p className="sidebar-note">
              A home for your curiosity.
              <br />
              Sign in to save your threads.
            </p>
          )}
          {token && historyStatus === "loading" && !conversations.length && <div className="library-skeleton" role="status" aria-label="Loading library"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>}
          {historyStatus === "refreshing" && <p className="sidebar-note" role="status">Refreshing library…</p>}
          {!token && loading && <p role="status">Restoring your workspace…</p>}
          {token && historyStatus === "ready" && !conversations.length && (
            <p className="sidebar-note">Your research will appear here.</p>
          )}
          {conversations.map((conversation) => (
            <div
              className={`thread-row ${conversationId === conversation.id ? "selected" : ""}`}
              key={conversation.id}
            >
              <button
                aria-current={conversationId === conversation.id ? "page" : undefined}
                disabled={busy}
                onClick={() => void openThread(conversation.id)}
                title={conversation.title}
              >
                {conversation.title}
              </button>
              <button
                disabled={busy}
                className="delete-thread icon-button"
                onClick={() => void removeThread(conversation.id)}
                aria-label={`Delete ${conversation.title}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="small-orbit" aria-hidden="true">
            <BrandMark />
          </span>
          {session ? (
            <>
              <span className="account-label">
                {session.user.user_metadata.full_name || session.user.email || "Your account"}
              </span>
              <button className="icon-button" aria-label="Sign out" onClick={() => void signOut()}>
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <Link to="/auth">
              Sign in <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </aside>

      <main className="research-main">
        <header className="topbar">
          <Link className="mobile-brand" to="/dashboard" onClick={newSearch}><BrandMark decorative={false} size={28} /></Link>
          <span>
            <Globe size={14} /> Search the web
          </span>
          <span className="plan-label">{session ? "Personal workspace" : "Guest workspace"}</span>
        </header>
        <div className={`research-content ${(messages.length || threadStatus !== "idle") ? "has-messages" : ""}`}>
          <div className="conversation-scroll" ref={scrollRef} onScroll={() => {
            const scroll = scrollRef.current;
            if (scroll) nearBottom.current = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 100;
            saveScroll();
          }}>
          {!messages.length && threadStatus === "idle" && (
            <section className="welcome">
              <p className="eyebrow">FOR THE CURIOUS MINDS</p>
              <h1>
                Where curiosity
                <br />
                <em>finds its answers.</em>
              </h1>
              <p className="welcome-description">
                Ask a question. Explore the sources. See the bigger picture.
              </p>
            </section>
          )}
          {threadStatus === "loading" && <ThreadSkeleton />}
          {threadStatus === "refreshing" && <p className="quota-note" role="status">Refreshing conversation…</p>}
          {threadStatus === "ready" && !messages.length && <p className="empty-thread">This conversation has no messages yet. Ask your first question below.</p>}
          {threadError && <div role="alert" className="error-notice">{threadError}<button className="text-button" onClick={() => conversationId && void openThread(conversationId)}>Retry conversation</button></div>}
          {!!messages.length && (
            <section className="messages" aria-label="Research conversation">
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  {message.role === "user" ? (
                    <p>{message.content}</p>
                  ) : (
                    <>
                      <div className="answer-heading">
                        <span className="small-orbit" aria-hidden="true">
                          <BrandMark />
                        </span>
                        <span>Nuelexity</span>
                        {message.status === "failed" && (
                          <span className="incomplete-label">Incomplete</span>
                        )}
                      </div>
                      {answerModelLabel(message) && <p className="answer-model">{answerModelLabel(message)}</p>}
                      {!!message.sources.length && (
                        <div className="source-grid" aria-label="Sources">
                          {message.sources.map((source) => {
                            const url = safeSourceUrl(source.url);
                            if (!url) return null;
                            return (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="source-card"
                                key={source.id}
                              >
                                <span className="source-domain">
                                  <span>{source.id}</span>
                                  {new URL(url).hostname.replace(/^www\./, "")}
                                </span>
                                <strong>{source.title}</strong>
                                <ArrowUpRight size={13} />
                              </a>
                            );
                          })}
                        </div>
                      )}
                      <Answer content={message.content} sources={message.sources} />
                      {message.status === "streaming" && (
                        <p className="stream-status" role="status">
                          <span className="status-dot" />
                          {stage}
                        </p>
                      )}
                      {message.status === "complete" && (
                        <button
                          className="copy-answer icon-button"
                          aria-label={copied === message.id ? "Answer copied" : "Copy answer"}
                          onClick={() => void copy(message)}
                        >
                          {copied === message.id ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      )}
                      {!!message.followUps.length && (
                        <div className="follow-ups">
                          <p>Keep exploring</p>
                          {message.followUps.map((question) => (
                            <button
                              disabled={busy || loadingThread || !modelReady}
                              key={question}
                              onClick={() => void submit(question)}
                            >
                              {question}
                              <Plus size={16} />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </article>
              ))}
            </section>
          )}
          {error && (
            <div className="error-notice" role="alert">
              {error}
            </div>
          )}
          </div>
          <div className="composer-dock">
          <form className="composer" onSubmit={onSubmit}>
            <label htmlFor="question" className="sr-only">
              {messages.length ? "Ask a follow-up question" : "Ask anything"}
            </label>
            <textarea
              ref={inputRef}
              id="question"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={messages.length ? "Ask a follow-up…" : "Ask anything…"}
              maxLength={1000}
              rows={2}
              disabled={loadingThread}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  if (!busy) void submit();
                }
              }}
            />
            <ModelSelector catalogue={catalogue} selectedId={effectiveModelId} signedIn={!!token}
              loading={modelsLoading} saving={modelSaving} error={modelsError || modelSaveError}
              disabled={loading || loadingThread}
              onChange={chooseModel} refreshLabel={modelSaveError ? "Retry saving" : "Refresh models"}
              onRefresh={() => {
                if (modelSaveError && conversationId && effectiveModelId) persistModel(conversationId, effectiveModelId);
                else void refreshModels();
              }} />
            <div className="composer-toolbar">
              <span>
                <Globe size={15} /> Web <span className="composer-divider" /> Sources included
              </span>
              {busy ? (
                <button
                  type="button"
                  className="send-button"
                  onClick={() => controllerRef.current?.abort()}
                  aria-label="Stop search"
                >
                  <Square size={15} />
                </button>
              ) : (
                <button
                  className="send-button"
                  disabled={
                    !query.trim() ||
                    loading ||
                    loadingThread ||
                    !modelReady ||
                    (!token && (!guest.ready || guest.checking || guest.verifying))
                  }
                  aria-label="Send question"
                >
                  <ArrowUp size={20} />
                </button>
              )}
            </div>
          </form>
          {!token &&
            !loading &&
            !guest.ready &&
            !guest.checking &&
            !guest.error &&
            TURNSTILE_SITE_KEY && (
              <Turnstile onToken={guest.verify} onError={guest.onError} resetKey={guest.resetKey} />
            )}
          {!token && !loading && (guest.checking || guest.verifying) && (
            <p role="status" className="quota-note">
              Checking guest verification…
            </p>
          )}
          {!token && guest.error && (
            <p role="alert" className="error-notice">
              {guest.error}{" "}
              <button type="button" onClick={guest.reset}>
                Retry verification
              </button>
            </p>
          )}
          {!token &&
            !loading &&
            !guest.ready &&
            !guest.checking &&
            !guest.error &&
            !TURNSTILE_SITE_KEY && (
              <p className="error-notice">Guest search is unavailable. Please sign in.</p>
            )}
          <p className="quota-note">
            {remaining !== null
              ? `${remaining} searches left in your daily allowance.`
              : !token
                ? "Try it as a guest. Sign in to save your research."
                : "Your research is saved to your account."}{" "}
            {!token && <Link to="/auth">Sign in</Link>}
          </p>
          </div>
          {!messages.length && threadStatus === "idle" && (
            <div className="suggestion-list">
              {suggestions.map((question) => (
                <button
                  disabled={
                    busy ||
                    loading ||
                    (!token && (!guest.ready || guest.checking || guest.verifying))
                  }
                  key={question}
                  onClick={() => {
                    setQuery(question);
                    inputRef.current?.focus();
                  }}
                >
                  <Search size={15} />
                  {question}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          )}
        </div>
        {!session && <GuestInvitation />}
        <footer className="page-footer">
          Stay curious. Check the sources.<span>Answers can be imperfect.</span>
        </footer>
      </main>
    </div>
  );
}
