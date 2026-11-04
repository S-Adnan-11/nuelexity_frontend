# Policy review for V1 publication — 2026-10-28

Visual presentation is approved. This document presents the **complete current rendered policy**, followed by the decisions and precise proposed edits needed before publication. It is a draft for the owner, not legal approval or a new product design. No replacement wording below has been silently adopted.

Confirmed: **Adnan Muhammad Sadiq** operates Nuelexity; approved public developer display **S. Adnan**; privacy/support **s.adnan.werk@gmail.com**; existing GitHub/portfolio links; **public learning beta accessible to anyone within shared limits**. The operator field is populated from that confirmation. These details need no resubmission. Google branding verification is a separate publication gate, not a privacy-policy decision; working GitHub sign-in is unchanged.

## Complete current policy wording

The text below is exported from `dist/legal/index.html` after the current build, excluding only site navigation/footer. Its displayed update date remains 2026-10-20; editorial verification on 2026-10-28 does not create an effective date.

---

# Privacy, storage & terms.

How this research project handles information, and what to expect when using it.

Updated 2026-10-20 · Local pre-release review; not yet effective

Policy draft for review. These terms are not yet in effect.

Operated by Adnan Muhammad Sadiq.

Privacy and access requests: [s.adnan.werk@gmail.com](mailto:s.adnan.werk@gmail.com).

## Privacy

### Information used to provide research

Signing in through Google or GitHub supplies Supabase Auth with identity information such as an account identifier, name, available email and profile picture. Nuelexity displays the fields already supplied. A private or missing email may be unavailable. No additional permissions are requested for the account page.

Signed-in questions, answers (including incomplete attempts), source links and excerpts, suggested follow-ups, model metadata and timestamps are saved in Supabase PostgreSQL under your account ID. Conversation titles come from the first question. Guest threads stay in the current workspace’s memory and are not automatically imported after sign-in.

### Where questions go

The backend sends Tavily the current question, with up to 400 characters of the preceding user question for follow-ups, within a 1,000-character retrieval query. When AI is enabled, Groq receives the question, clipped search titles and excerpts, and up to six clipped complete conversation turns, further trimmed to fit a bounded input. Google and GitHub provide sign-in; they do not receive your research conversation through this integration.

Cloudflare Turnstile checks guest requests. Its browser widget receives browser/network signals, which Cloudflare also processes to improve bot detection under its privacy addendum; the backend sends the verification token and raw IP address to Cloudflare’s verification service. The host and network providers also receive connection information. Opening a source or loading a provider avatar contacts that site.

### Security and limits

The application uses account IDs and secret-keyed IP hashes for quotas, plus temporary request leases. These are pseudonymous records, not anonymous data. Raw IP addresses are used transiently by the API and its in-memory throttle; they are not written to the application quota tables. Hosting and provider logs may handle IP addresses separately.

### Backend hosting

The backend is hosted on Render’s Free Web Service. Render and its network providers receive connection information. The application has no request logger or analytics exporter and does not log research text, authentication tokens or guest passes. Render documents seven-day application-log visibility for Hobby workspaces and HTTP request logs for Pro workspaces and above. Infrastructure security processing is separate; actual region and account settings still need deployment verification.

### Retention and control

Saved conversations have no automatic expiry in the current application. You can delete individual threads and their messages from the library. There is no self-service account deletion or full export feature. Clearing browser storage or signing out does not delete server history.

Quota cleanup runs on successful reservations: day/month records older than 62 days and minute records older than a day become eligible for removal. Expired leases are released or cleaned later. This is not a guaranteed deletion schedule during inactivity. Provider logs and backups follow separate arrangements; deleting a thread cannot promise their immediate erasure.

### Providers and international processing

Supabase, Tavily, Groq and Cloudflare process information to operate the features above. Processing may cross borders, including outside Nigeria. Groq documents default non-retention of inference content with limited reliability/abuse exceptions and separately retained usage metadata. We have not verified this project’s dashboard retention settings. Tavily’s policy permits some query data to improve responses and limited sharing with search indexes; this project’s contract settings and a fixed API-query deletion deadline have not been verified.

See [Supabase privacy](https://supabase.com/privacy), [Tavily privacy](https://www.tavily.com/privacy), [Groq data handling](https://console.groq.com/docs/your-data) and [Cloudflare privacy](https://www.cloudflare.com/privacypolicy/) for their own practices.

### Purposes, requests and updates

Information is used for requested search and account features, saving research, preventing abuse and maintaining service reliability. The intended legal basis for core requested features is providing the service; security processing requires an assessed legitimate interest or other applicable basis. The operator’s final legal assessment and cross-border arrangements must be approved before public beta.

Access, correction and deletion requests need identity verification and operator handling. Contact s.adnan.werk@gmail.com; never send passwords or session tokens. The manual request workflow still needs final approval. Provider-held records may require separate requests. Policy changes will update this page and its dates; material changes should be brought to users’ attention.

## Cookies & storage

Nuelexity currently has no advertising, optional analytics or error-tracking service. Nuelexity does not set application cookies for authentication. Its Supabase browser client stores the session in localStorage to keep you signed in and refresh it. OAuth providers and bot protection may use their own cookies or storage in their respective contexts.
- **Sign-in:** Supabase’s project-scoped auth session and temporary PKCE verifier in localStorage. Removed on successful sign-out or exchange as appropriate; the session otherwise persists until cleared or invalidated.
- **Guest verification:** a signed, IP-bound pass in sessionStorage, valid for up to two hours. Clearing it does not reset server quotas.
- **Navigation:** account-scoped active-thread IDs and scroll positions in sessionStorage. These contain identifiers and positions, not saved messages, and are cleared on account replacement/sign-out in open tabs.
- **Interface state:** a per-tab dismissed sign-in invitation and a validated one-use sign-in return destination. No marketing profile is created.

Browser storage supports sign-in, security and the interface features described above. These uses still need review under the rules applicable to the intended audience. If optional tracking is introduced, the policy and any required prior consent must be reviewed first.

You can clear site storage through your browser. This signs you out or resets local interface/verification state; it does not erase saved server conversations. External identity and source sites have their own controls.

## Terms

### A research project in beta

Nuelexity is an independent learning project with limited free provider capacity. Features may change, fail or be unavailable. Quotas and technical limits apply to guests and accounts. An interrupted or failed attempt may still consume allowance; requests are not automatically retried.

The intended beta is public and accessible to anyone within shared limits. Render Free can sleep after inactivity, take time to start, restart or suspend service when allowances are exhausted. Starting the service may add a wait before research can begin.

### Use your judgement

AI output and retrieved sources can be wrong, outdated, biased or incomplete. Citations help you inspect evidence and do not certify an answer. Verify important claims with original sources and qualified advice where appropriate.

### Use the service responsibly

Do not attempt to access someone else’s conversations, bypass quotas or bot checks, attack the service, submit unlawful content, or infringe others’ rights. Do not submit credentials, confidential material or personal information you lack permission to share. Access may be restricted to protect users and the service.

### Your content and other people’s work

You remain responsible for what you submit and for having the rights needed to do so. Providing a question permits the processing needed to return and, for signed-in threads, store the research described above. Third-party pages, excerpts and trademarks belong to their respective rights holders; a citation does not grant a licence to republish them. Output may resemble other output and is not guaranteed to be exclusive.

### Changes and applicable rights

Changes to these terms will be recorded with updated dates. Nothing here removes rights that applicable law does not allow to be waived. Final operator responsibility, eligibility and governing-law decisions remain part of the pre-release review.

---

## Actual decisions still needed

These five decisions cover the existing implementation. They do not request a new name/contact/audience choice or authorize a new feature. The proposed wording is conditional on the owner choosing the stated approach and resolving the indicated facts.

| Decision | What the application does now | Proposed wording consistent with it |
| --- | --- | --- |
| 1. Eligibility and children handling within the confirmed public beta | No date-of-birth field, age gate, parental-consent flow or school deployment exists. Public access does not establish that every age/use is legally eligible. | Retain “The beta is public and accessible within shared limits.” If the owner retains the current general-public implementation, add “Nuelexity does not collect a date of birth or verify age. Do not submit children’s personal information or research you do not have permission to share.” This is a factual disclosure and restriction on submitted data, **not** a substitute for deciding applicable child-consent requirements. The owner must decide whether this implementation is appropriate for the intended use; any age eligibility restriction requires an explicit choice rather than an invented number. |
| 2. Lawful bases, applicable markets and cross-border processing | Questions/identity go to the providers disclosed above. No geography gate or transfer-consent mechanism exists; Nigeria-based operation/public access is confirmed. Actual Supabase/Render regions, provider contractual controls and transfers have not been inspected in accounts. | Proposed purpose text: “We use your information to provide the searches, sign-in and saved research you request, protect the service from abuse and keep it reliable. Our providers may process it outside Nigeria.” Assess whether contract for requested features and legitimate interests for security are appropriate **before** making those legal-basis claims final. Identify the applicable transfer arrangements and any required notices from the actual provider accounts/contracts; do not assert adequacy, compliance certification, exclusive courts or a transfer safeguard that has not been established. Keep applicable mandatory rights protected. |
| 3. Accept the current application retention and accurately record provider/hosting controls | Saved conversations have no automatic expiry. Users can delete a thread/messages. The SQL cleanup thresholds are eligibility rules triggered on reservations, not scheduled deletion promises. Provider logs/backups are separate. No optional analytics is configured. | Retain: “Saved conversations have no automatic expiry. You can delete individual threads and their messages from the library. Signing out or clearing browser storage does not delete server history.” Add to the hosting section **when publishing on Pages**: “Cloudflare Pages serves the website; Render hosts the research API. These providers process connection information to deliver and protect the service.” Preserve the limitation: “Provider logs and backups follow their own arrangements; deleting a thread does not promise immediate erasure of those records.” Approve that retention model or request a separately scoped implementation; no new expiry is invented. Record actual provider controls/regions and whether any optional host logging is enabled before final approval. |
| 4. Adopt an operator-run access/correction/deletion workflow | The email contact exists; there is no account deletion or complete-export button. Thread deletion exists. No automated rights-ticket, identity-verification or provider-deletion workflow is implemented. | Proposed replacement for the pending-workflow sentence: “For access, correction or deletion requests, email s.adnan.werk@gmail.com. We will verify that the request concerns your account and review it manually. Do not send passwords or session tokens. Some provider-held records may require separate requests; applicable legal obligations and backup limitations may affect what can be removed.” Adopt a monitored, private handling process using existing authenticated identity/verified contact; decide the applicable response obligations rather than promise an invented deadline. This does not add a self-service deletion/export capability or authorize deleting anyone’s data now. |
| 5. Approve the final assembled text and effective date | `publicationApproved`, `ownerDecisionsReviewed` and Google verification remain false. `effectiveDate` is null. Both Node publication and the Pages release command fail closed. | After decisions 1–4, apply the approved replacements, update the review date, set the owner-chosen effective date and remove draft/pending language. The final date line can read “Updated YYYY-MM-DD · Effective YYYY-MM-DD” using the actual approved dates. Set policy flags only after reviewing that complete assembled text. Google’s separate confirmation must also arrive before publication. |

## Provider-dependent facts checked against official sources

Checked 2026-10-28; provider documentation describes their general practices, not this project’s private dashboard settings. No paid calls, settings changes or deletion requests were made.

- **Groq:** its [data-handling documentation](https://console.groq.com/docs/your-data) distinguishes retained usage metadata from inference inputs/outputs, which it says are not retained by default except for specified features and reliability/abuse cases. It documents up to 30 days for those exception logs, subject to legal preservation, and optional Data Controls/ZDR. The [official trust FAQ](https://trust.groq.com/faq) also describes possible 30-day input/output storage. These are conditional provider statements, not a verified project setting. **Proposed final clause:** “Groq may retain usage metadata and, in limited reliability or abuse cases, inputs/outputs under its documented controls. This project’s retention controls must be confirmed before we make a stronger promise.” Do not advertise project ZDR or no retention without account confirmation.
- **Tavily:** the [privacy policy](https://www.tavily.com/privacy), dated November 24, 2025, permits some query use for response improvement unless the contract says otherwise and limited sharing with search-index providers. It provides retention criteria rather than a universal API-query expiry. The existing qualified wording remains appropriate; no fixed deletion period is added.
- **Supabase:** [data residency/transfers FAQ](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq) and [backup documentation](https://supabase.com/docs/guides/platform/backups) tie core hosting to the selected project region and backup availability/retention to plan. No automatic paid-plan backup schedule or immediate downstream erasure is promised for this project. Auth storage behavior above is also verified in the installed single browser client.
- **Render:** [logging documentation](https://render.com/docs/logging) currently states seven-day log visibility for Hobby workspaces and HTTP request logs for Pro and above. This supports the existing qualified backend-hosting paragraph; it does not establish the deployed account’s region, plan or every infrastructure security log’s retention.
- **Cloudflare:** the [Turnstile privacy addendum](https://www.cloudflare.com/turnstile-privacy-policy/) describes browser/network signals and separate bot-protection/improvement purposes. The [verification API](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) accepts the visitor IP; the backend actually supplies it. [Cloudflare privacy](https://www.cloudflare.com/privacypolicy/) also applies to proposed Pages hosting. No zero-log, purely anonymous or fixed-erasure claim is made.

The [NDPC Act page](https://ndpc.gov.ng/ndp-act-2023/) and [final 2025 implementation guidance](https://ndpc.gov.ng/wp-content/uploads/2025/03/NDP-ACT-GAID-2025-MARCH-20TH.pdf) are the primary starting points for the operator’s lawful-basis/children/transfers assessment. The older draft guidance is not relied on as final law. This review does not decide legal compliance on the operator’s behalf.

## How to respond

Approve or amend decisions 1–4 and give the intended effective date when approving the resulting final policy. There is no request to repeat operator/contact/audience details. The Google-branding confirmation can be supplied separately. Until then, keep the current draft and publication gates intact.
