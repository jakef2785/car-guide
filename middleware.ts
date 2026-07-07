// Session refresh middleware (@supabase/ssr pattern). Expired JWTs are refreshed here so
// Server Components can read auth state from cookies without being able to write them —
// see the setAll try/catch note in lib/supabase/server.ts.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() (not getSession()) — validates the JWT against Supabase and triggers the
  // refresh-token exchange when expired. Do not remove: Server Components rely on it.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip static assets; run everywhere else (auth state can matter on any page).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ico)$).*)"],
};
