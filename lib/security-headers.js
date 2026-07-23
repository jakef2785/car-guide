// HTTP security headers applied to every route — wired up in next.config.mjs, asserted in
// tests/unit/security-headers.test.ts. Plain CJS so the ESM next config and the CJS jest runtime
// can both load it without a transform step.
//
// CSP notes:
// - script-src needs 'unsafe-inline' for Next's inline bootstrap scripts (no nonce plumbing), and
//   'unsafe-eval' only in dev (React Refresh). Production stays eval-free.
// - style-src 'unsafe-inline' for Tailwind/Next inline styles.
// - connect-src includes the Supabase project URL — auth token refresh goes straight to it from
//   the browser. ws: in dev only, for HMR.
// - frame-ancestors 'none' + X-Frame-Options DENY: the admin moderation panel and auth forms must
//   never be framable (clickjacking).

const isDev = process.env.NODE_ENV === "development";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl}` : ""}${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

module.exports = { securityHeaders };
