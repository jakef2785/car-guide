// Asserts the header set that next.config.mjs applies to every route. lib/security-headers.js is
// the single source of truth (plain CJS so the ESM next config and jest can both load it), so
// covering the module covers what ships. NODE_ENV is "test" here, i.e. the production branch of
// the dev-only relaxations — exactly the variant that must hold in prod.
const { securityHeaders } = require("@/lib/security-headers.js") as {
  securityHeaders: { key: string; value: string }[];
};

const header = (key: string): string => {
  const found = securityHeaders.find((h) => h.key === key);
  if (!found) throw new Error(`missing header: ${key}`);
  return found.value;
};

describe("securityHeaders", () => {
  it("includes every required header", () => {
    expect(securityHeaders.map((h) => h.key).sort()).toEqual(
      [
        "Content-Security-Policy",
        "Referrer-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
      ].sort(),
    );
  });

  it("blocks framing both ways (clickjacking on the admin panel)", () => {
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("ships a restrictive CSP without dev-only relaxations", () => {
    const csp = header("Content-Security-Policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("sets HSTS, nosniff and a strict referrer policy", () => {
    expect(header("Strict-Transport-Security")).toContain("max-age=");
    expect(header("Strict-Transport-Security")).toContain("includeSubDomains");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});
