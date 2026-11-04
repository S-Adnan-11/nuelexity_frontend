# Chat refinement delivery — 2026-10-15

The historical verification below originally used Bun; runnable command examples now use the supported npm workflow. See the backend `NPM_SUPPORT.md` for the Node migration results.
Implemented against the actual dirty checkouts, preserving the owner's “Researching” status/copy changes, model-test edits, Return Cat identity and pre-existing SQL whitespace edit. Neither checkout was clean, so no pull/replacement of working files was attempted. No real search/generation calls, paid service, database mutation, migration, push or deployment was performed for these changes.

## Causes and resulting layout

The old `.research-content` constrained the whole scroller to 820px. Padding, its own 8px inner gutters and a native 15px scrollbar left approximately 733px of answer text. The scrollbar therefore appeared immediately beside the answer. `.conversation-scroll` now spans the main pane, with one centered `.reading-column` inside; the composer uses the same column. The sidebar keeps its own independent library scrolling. Code, tables, long drafts and menus retain their necessary local overflow.

The new column is 880px including 16px gutters on both sides, giving **848px of answer/composer content**, about 15.7% above the old 733px text area. On the 1440px fixture, the pane and scrollbar both end at x=1440; the answer and composer both start at x=407.5. The short composer measures **109px high** (the previous layout was about 202px). Native/overlay scrollbar width is measured with ResizeObserver so both columns align on different systems. Guest-card space affects the reading column, not the full-width scroll owner.

The existing per-user/thread ID and scroll-offset storage remains. New history replaces old thread content immediately; revalidation keeps valid same-user content. Stream updates scroll only when the reader was within 100px of the bottom. A final completion/suggestion update also follows if the reader was already following; a reader looking at earlier content stays there. No private chat cache was added.

The textarea starts at 40px and automatically grows to the smaller of 180px or 28% of the visual viewport, with a compact lower bound for very small viewports. It then scrolls internally. It has no manual resize handle. Enter, Shift+Enter, IME composition, Stop, focus, disabled states and guest clearance remain. A synchronous active-request guard prevents duplicate suggestion/submission clicks before React's busy state renders.

## Model menu and attribution

`ModelSelector.tsx` uses the already-installed Radix Select primitive, with managed focus, Escape, Home/End/arrow keys, typeahead and portal collision handling. It prefers opening above the bottom composer. Model labels/default/availability come from the verified backend catalogue; no reference-only providers/plans were introduced.

Guests can open the trigger. The configured default is identified, alternate choices show a lock and “Sign in required,” and a keyboard-accessible “Sign in to choose a model” action opens `/auth`. Restricted items remain focusable for discovery but pointer/key activation is prevented. Both the selector callback and workspace callback reject restricted/unavailable changes. Genuine unavailability has its own description, separate from sign-in; signing in does not promise to restore a missing provider model. Existing backend rejection of forged/unknown/guest overrides still runs before provider/quota work.

The shared `answerModelLabel` formatter now emits the actual recorded name, plus `· Preview` for Qwen, with no provider suffix. New completion and reopened messages use this formatter. `provider: "Groq"` remains in catalogue, SSE completion and stored model JSON. No historical records were rewritten. Unknown historical models remain “Model unknown,” and partial/failed turns still do not claim successful attribution. Fresh production JS was checked for stale “Served by” / “via Groq” label suffixes.

## Contextual suggestions: one call, optional metadata

The repeated three templates lived in backend `prompts.ts` and used only the latest query. They have been removed. The existing system instructions now ask for a concise sourced answer, followed by one private protocol footer, with up to three natural questions using the latest request, the same bounded complete history, the answer just written and supplied evidence. The footer is part of the same Groq HTTP response; no SDK, tool call, second generation, retry or fallback was added.

`AnswerSections` holds possible delimiter prefixes across arbitrary chunk boundaries, then hides the footer permanently. The route applies this before sending any `delta` and before persisting text, including failure paths. Malformed/truncated/oversized footer text cannot become visible answer text. Footer buffering is capped at 2,048 characters. Validation requires a strict object containing at most three `{question, anchor}` entries: each question is 12–160 characters and its 3–64-character substantive anchor must occur in both the question and bounded answer/context. Duplicates/near-duplicates, previously asked/exactly answered questions, old templates, markup/control characters and ungrounded entries are omitted. The instructions ask for no suggestions when evidence is insufficient or conflicting; explicit insufficient-evidence phrases are also filtered. Sources-only/no-sources results produce none. There is no generic replacement for missing/invalid metadata.

These text checks are conservative relevance guards, **not a semantic proof** that a candidate is useful, true or unanswered. Meaning, language and level are also addressed in the generation instructions. No live model quality evaluation was run; actual production suggestion quality remains unverified.

The browser still receives the existing `follow_ups: {questions: string[]}` event. There are now zero to three strings. It independently bounds optional text, ignores malformed optional JSON and stages questions until the matching `done`. Errors/cancellation discard staged questions. React renders strings as text. Selection goes through the normal `submit` path, including auth, model-save state, Turnstile/IP-bound pass and quotas. Signed-in answers persist suggestions in the existing `follow_ups` array and reload them through the existing owner-filtered detail query. Old absent arrays remain empty; old generic templates are filtered at display time. No historical suggestions are invented.

The input bound remains **6,000 combined UTF-8 bytes**, including the existing 128-byte framing allowance. Longer protocol instructions therefore leave less room for history/evidence; the existing builder trims those within its original bounds. The output cap remains **1,024 tokens total**, including suggestions. A typical three-question English footer spends roughly 100–220 of those tokens; language and wording vary. The prompt aims below 750 answer tokens. Neither the answer character limit (12,000), request deadline, lease, shared quota subject nor failed-attempt policy was increased.

A token cap before the complete footer delimiter remains an incomplete answer. A token cap *inside* the optional footer may preserve the explicitly completed answer, provided the exact requested model is confirmed and `[DONE]` still arrives; malformed/truncated suggestions are dropped. Transport interruption, model mismatch or missing confirmation/completion still fail. This distinction is tested; metadata failure does not turn an otherwise completed answer into a failure.

## Verification and wording inspection

- Frontend `npm run check`: TypeScript, **22 tests**, production build pass. New tests cover optional count/length, duplicate/markup/template rejection and malformed metadata without loss of a good completion.
- Backend `npm run check`: TypeScript and **77 tests** pass, including existing quota/guest/ownership/provider/migration regressions. New tests cover every footer split and one-character chunks, missing/partial/malformed/oversized metadata, rejected unrelated candidates, duplicate/previous questions, multi-turn context, French, one reservation/one answer call, persistence/reopening, interruptions and the metadata-only token-limit case.
- `npm run test:browser`: updated model-menu suite, research regressions and real Node asset/route smoke tests pass against the production build with fictional auth/provider/history fixtures. Checks include far-right scroll coordinates and aligned width, scroll-up versus bottom streaming, final suggestion visibility, single submission after a double activation, compact/growing drafts and IME, model persistence/reopening, provider-free labels, guest locks, sign-in action, separate provider unavailability, menu bounds/focus/Escape, 1440px desktop, 390px mobile and 320px narrow/keyboard-sized views. Existing refresh/account-change/sign-out races, errors/empty states, OAuth action wiring, safe Markdown, reduced motion and local assets remain covered.

Wording was inspected in the fixtures rather than accepted solely because an array had three strings. RSA candidates ask for a small-number key-generation walkthrough, the reason decryption recovers a message, and how factoring reveals the private key. The answer fixture only sketches those mechanisms, so these deepen the discussion rather than restating its opening question. The solar/wind fixture asks how battery storage changes availability. French multi-turn fixtures ask how roots share nutrients and how mycorrhizal networks compare with roots. Unrelated football suggestions, repeated prior questions, generic source templates, markup and insufficient-evidence cases are rejected. These are **human-authored mock outputs used to test the pipeline and inspect example wording**, not evidence that a real model generated good questions.

## Application screenshots

These are rendered production-app screenshots with fictional fixture content, not static design previews or actual research results. The local evidence directory remains ignored under the owner's Git rules. Run `BROWSER_EVIDENCE=/tmp/nuelexity-chat-refinement npm run test:browser` to regenerate it. The working copy also has the captured evidence under `docs/evidence/chat-refinement/`.

| Surface | Local evidence |
| --- | --- |
| Wide RSA conversation and far-right scrollbar | `docs/evidence/chat-refinement/desktop-rsa.png` |
| Desktop model menu | `docs/evidence/chat-refinement/desktop-model-menu.png` |
| Mobile RSA conversation | `docs/evidence/chat-refinement/mobile-rsa.png` |
| Mobile menu above composer | `docs/evidence/chat-refinement/mobile-model-menu.png` |
| Guest padlocks / sign-in action | `docs/evidence/chat-refinement/guest-model-padlocks.png` |
| Unavailable provider distinct from sign-in | `docs/evidence/chat-refinement/guest-model-unavailable.png` |
| Completed contextual suggestions | `docs/evidence/chat-refinement/contextual-follow-ups.png` |
| Home composer / guest invitation | `docs/evidence/chat-refinement/guest-home.png`, `mobile-guest-card.png` |
| Keyboard-sized and narrow draft views | `docs/evidence/chat-refinement/mobile-keyboard-sized.png`, `mobile-keyboard-model-menu.png`, `narrow-guest-composing.png` |
| Measured layout / contrast / requests | `docs/evidence/chat-refinement/layout.json`, `contrast.json`, `after-timeline.json` |

No new migration, secret, external service or account action is needed for these refinements. Deploy the updated backend pieces together for contextual generation and rebuild the frontend to replace stale bundles. Existing hosting/domain/OAuth-origin setup remains external to this task. Physical iOS/Android keyboards, a full screen-reader audit and live multilingual suggestion quality are not verified by headless fixtures.
