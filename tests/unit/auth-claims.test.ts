import { isAdmin } from "@/lib/auth/claims";

describe("isAdmin", () => {
  it("accepts a user whose app_metadata role is admin", () => {
    expect(isAdmin({ app_metadata: { role: "admin" } })).toBe(true);
  });

  it("rejects a missing or non-admin role", () => {
    expect(isAdmin({ app_metadata: {} })).toBe(false);
    expect(isAdmin({ app_metadata: { role: "user" } })).toBe(false);
    expect(isAdmin({})).toBe(false);
  });

  it("rejects null/undefined users", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("NEVER trusts user_metadata — users can edit that themselves", () => {
    // Supabase lets any signed-in user update their own user_metadata via the client SDK.
    // An admin claim there is attacker-controlled and must be ignored.
    expect(isAdmin({ user_metadata: { role: "admin" } })).toBe(false);
    expect(
      isAdmin({ app_metadata: { role: "user" }, user_metadata: { role: "admin" } }),
    ).toBe(false);
  });

  it("requires the exact admin role string", () => {
    expect(isAdmin({ app_metadata: { role: "Admin" } })).toBe(false);
    expect(isAdmin({ app_metadata: { role: ["admin"] } })).toBe(false);
  });
});
