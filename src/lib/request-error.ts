// Shared codes work with the current and previous API. Timing comes from the
// server; displaying it never schedules a replay of the refused question.
export function requestErrorMessage(error: { message: string; code?: string; retryAfter?: number }, now = Date.now()) {
  const messages: Record<string, string> = {
    DAILY_LIMIT: "Your daily search allowance is used up. Your question is saved in the draft.",
    IP_DAILY_LIMIT: "This network's daily search allowance is used up. Your question is saved in the draft.",
    GLOBAL_DAILY_LIMIT: "Nuelexity's shared daily search capacity is used up. Your question is saved in the draft.",
    GLOBAL_MONTHLY_LIMIT: "Nuelexity's shared monthly search capacity is used up. Your question is saved in the draft.",
    GLOBAL_MINUTE_LIMIT: "Nuelexity's shared search capacity is busy. Your question is saved in the draft.",
    MODEL_RATE_LIMIT: "The selected model's provider is busy or has reached its allowance. Your question is saved in the draft.",
    SEARCH_RATE_LIMIT: "The search provider is busy or has reached its allowance. Your question is saved in the draft.",
  };
  const message = (error.code && messages[error.code]) || error.message;
  const retry = error.retryAfter && Number.isFinite(error.retryAfter) && error.retryAfter > 0
    ? ` Try again after ${new Date(now + error.retryAfter * 1000).toLocaleString()}.` : "";
  return message + retry;
}
