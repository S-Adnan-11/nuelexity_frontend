// The link contains fixed instructions only. No message, model, account or
// thread data is collected, prefilled or sent by the application.
export function ReportAnswer() {
  return <details className="answer-report">
    <summary>Report an inaccurate answer</summary>
    <p>You may voluntarily include the prompt, disputed claim, public source links and model name.
      Reports on GitHub are public; include only what you want to share.</p>
    <a href="https://github.com/S-Adnan-11/nuelexity_backend/issues/new"
      target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open an issue on GitHub ↗</a>
  </details>;
}
