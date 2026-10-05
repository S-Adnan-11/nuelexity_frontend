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
  listConversations,
  search,
} from "@/lib/api";
import { TURNSTILE_SITE_KEY } from "@/lib/config";
import { supabase } from "@/lib/supabase/client";
import type { Conversation, Message } from "@/lib/types";
import { useAuth } from "../AuthProvider";
import { Answer, safeSourceUrl } from "../Answer";
import { Turnstile } from "../Turnstile";

const suggestions = [
  "How does an AI search engine find its sources?",
  "What is happening in renewable energy?",
  "Help me understand quantum computing",
];
export default function Dashboard() {
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
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false),
    [copied, setCopied] = useState<string | null>(null);
  const [botToken, setBotToken] = useState(""),
    [botReset, setBotReset] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const historyController = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refreshHistory = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) {
        setConversations([]);
        return;
      }
      try {
        setConversations(await listConversations(token, signal));
        setHistoryError(null);
      } catch (error) {
        if (!signal?.aborted) setHistoryError((error as Error).message);
      }
    },
    [token],
  );
  useEffect(() => {
    const controller = new AbortController();
    void refreshHistory(controller.signal);
    return () => controller.abort();
  }, [refreshHistory]);
  useEffect(() => {
    controllerRef.current?.abort();
    historyController.current?.abort();
    controllerRef.current = null;
    historyController.current = null;
    setMessages([]);
    setConversationId(null);
    setRemaining(null);
    setBusy(false);
    setLoadingThread(false);
  }, [userId]);
  useEffect(
    () => () => {
      controllerRef.current?.abort();
      historyController.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  function newSearch() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    historyController.current?.abort();
    historyController.current = null;
    setMessages([]);
    setConversationId(null);
    setQuery("");
    setError(null);
    setBusy(false);
    setLoadingThread(false);
    setMobileOpen(false);
    inputRef.current?.focus();
  }
  async function openThread(id: string) {
    if (!token || busy) return;
    historyController.current?.abort();
    const controller = new AbortController();
    historyController.current = controller;
    setError(null);
    setLoadingThread(true);
    setMobileOpen(false);
    try {
      const detail = await getConversation(id, token, controller.signal);
      if (!controller.signal.aborted) {
        setConversationId(id);
        setMessages(detail.messages);
      }
    } catch (error) {
      if (!controller.signal.aborted) setError((error as Error).message);
    } finally {
      if (historyController.current === controller) {
        historyController.current = null;
        setLoadingThread(false);
      }
    }
  }
  async function removeThread(id: string) {
    if (!token || busy || !window.confirm("Delete this conversation and its messages?")) return;
    try {
      await deleteConversation(id, token);
      if (conversationId === id) newSearch();
      await refreshHistory();
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function submit(value = query) {
    const question = value.trim();
    if (!question || question.length > 1000 || busy || loadingThread || loading) return;
    if (!token && TURNSTILE_SITE_KEY && !botToken) {
      setError("Complete the verification before searching.");
      return;
    }
    const controller = new AbortController();
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
          ...(token && conversationId ? { conversationId } : {}),
          ...(guestHistory?.length ? { history: guestHistory } : {}),
          ...(!token && botToken ? { turnstileToken: botToken } : {}),
        },
        token,
        controller.signal,
        (event) => {
          if (controllerRef.current !== controller) return;
          switch (event.event) {
            case "meta":
              setConversationId(event.data.conversationId);
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
              update({ status: "complete" });
              break;
          }
        },
      );
    } catch (error) {
      if (controllerRef.current !== controller) return;
      update({ status: "failed", followUps: [] });
      if (controller.signal.aborted) setError("Search stopped. Any text above may be incomplete.");
      else {
        const failure = error as Error;
        const retry =
          error instanceof ApiError && error.retryAfter
            ? ` Try again after ${new Date(Date.now() + error.retryAfter * 1000).toLocaleString()}.`
            : "";
        setError(failure.message + retry);
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setBusy(false);
        setStage("");
        setBotToken("");
        setBotReset((k) => k + 1);
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
    newSearch();
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
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link className="brand" to="/dashboard" onClick={newSearch}>
          <span className="brand-mark" aria-hidden="true">
            ✳
          </span>{" "}
          nuelexity
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
          {token && !conversations.length && !historyError && (
            <p className="sidebar-note">Your research will appear here.</p>
          )}
          {conversations.map((conversation) => (
            <div
              className={`thread-row ${conversationId === conversation.id ? "selected" : ""}`}
              key={conversation.id}
            >
              <button
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
            ✳
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
          <span>
            <Globe size={14} /> Search the web
          </span>
          <span className="plan-label">{session ? "Personal workspace" : "Guest workspace"}</span>
        </header>
        <div className={`research-content ${messages.length ? "has-messages" : ""}`}>
          {!messages.length && (
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
          {loadingThread && (
            <p role="status" className="loading-thread">
              Opening your thread…
            </p>
          )}
          {!!messages.length && (
            <section className="messages" aria-label="Research conversation">
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  {message.role === "user" ? (
                    <h2>{message.content}</h2>
                  ) : (
                    <>
                      <div className="answer-heading">
                        <span className="small-orbit" aria-hidden="true">
                          ✳
                        </span>
                        <span>Answer</span>
                        {message.status === "failed" && (
                          <span className="incomplete-label">Incomplete</span>
                        )}
                      </div>
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
                              disabled={busy || loadingThread}
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
                    (!token && !!TURNSTILE_SITE_KEY && !botToken)
                  }
                  aria-label="Send question"
                >
                  <ArrowUp size={20} />
                </button>
              )}
            </div>
          </form>
          {!token && TURNSTILE_SITE_KEY && (
            <Turnstile onToken={setBotToken} onError={setError} resetKey={botReset} />
          )}
          <p className="quota-note">
            {remaining !== null
              ? `${remaining} searches left in your daily allowance.`
              : !token
                ? "Try it as a guest. Sign in to save your research."
                : "Your research is saved to your account."}{" "}
            {!token && <Link to="/auth">Sign in</Link>}
          </p>
          {!messages.length && (
            <div className="suggestion-list">
              {suggestions.map((question) => (
                <button
                  disabled={busy || loading}
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
        <footer className="page-footer">
          Stay curious. Check the sources.<span>Answers can be imperfect.</span>
        </footer>
      </main>
    </div>
  );
}
