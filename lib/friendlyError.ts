/**
 * Turns raw errors (Supabase, database, network) into short sentences a
 * customer can act on. Known cases get a specific message; anything else that
 * looks technical becomes the fallback. Never shows codes, stack traces,
 * table names or library jargon.
 */

const GENERIC = "Something went wrong on our side. Please try again in a moment.";
const OFFLINE = "We couldn't reach Litway Picks. Check your internet connection and try again.";

// Supabase Auth error codes → message.
const BY_CODE: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Check them and try again, or reset your password.",
  email_not_confirmed: "Please confirm your email first. Check your inbox for your 6-digit code.",
  user_already_exists: "An account with this email already exists. Sign in instead, or reset your password.",
  email_exists: "An account with this email already exists. Sign in instead, or reset your password.",
  weak_password: "Please choose a stronger password: at least 8 characters.",
  same_password: "Your new password must be different from your current one.",
  over_email_send_rate_limit: "We've sent several emails already. Please wait a few minutes before asking for another.",
  over_request_rate_limit: "Too many attempts. Please wait a few minutes and try again.",
  otp_expired: "That code or link has expired. Please request a new one.",
  email_address_invalid: "Please enter a valid email address.",
  validation_failed: "Please check your details and try again.",
  signup_disabled: "New sign-ups are paused right now. Please try again later.",
  user_not_found: "We couldn't find an account with that email.",
  session_not_found: "Your session has expired. Please sign in again.",
  session_expired: "Your session has expired. Please sign in again.",
  reauthentication_needed: "For your security, please sign in again and retry.",
};

// Message patterns (older errors without a code, and network failures).
const BY_PATTERN: [RegExp, string][] = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials],
  [/email not confirmed/i, BY_CODE.email_not_confirmed],
  [/already registered|already exists|already been registered/i, BY_CODE.email_exists],
  [/password should be at least|password is too short|weak password/i, BY_CODE.weak_password],
  [/should be different from the old password/i, BY_CODE.same_password],
  [/email rate limit|you can only request this after|security purposes/i, BY_CODE.over_email_send_rate_limit],
  [/rate limit|too many requests/i, BY_CODE.over_request_rate_limit],
  [/token has expired|expired or is invalid|otp.*(expired|invalid)|invalid.*otp/i, BY_CODE.otp_expired],
  [/invalid format|unable to validate email/i, BY_CODE.email_address_invalid],
  [/auth session missing|jwt expired|refresh token/i, BY_CODE.session_not_found],
  [/failed to fetch|network ?error|network request failed|fetch failed|load failed|econn|enotfound|timed? ?out|aborted/i, OFFLINE],
];

// Signs a message was written for developers, not customers.
const TECHNICAL = /violates|constraint|policy|relation|column|schema|syntax|null value|undefined|typeerror|referenceerror|json|pgrst|supabase|postgres|duplicate key|status code|\b[45]\d\d\b|[a-z]+_[a-z_]+|[{}<>[\]`]/i;

/**
 * fallback: shown when nothing specific matches.
 * opts.passthrough: keep the original message when it is already
 * customer-friendly (use only for messages from our own API).
 */
export function friendlyError(
  err: unknown,
  fallback: string = GENERIC,
  opts: { passthrough?: boolean } = {},
): string {
  const e = (typeof err === "object" && err !== null ? err : {}) as { code?: string; message?: string };
  const code = e.code;
  const message = typeof err === "string" ? err : e.message || "";

  if (code && BY_CODE[code]) return BY_CODE[code];
  for (const [pattern, text] of BY_PATTERN) {
    if (pattern.test(message)) return text;
  }
  if (opts.passthrough && message && message.length <= 160 && !TECHNICAL.test(message)) {
    return message;
  }
  return fallback;
}
