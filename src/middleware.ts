import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/contracts",
  "/analytics",
  "/calendar",
  "/settings",
];
const authRoutes = ["/login", "/signup"];

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const signupStep = request.nextUrl.searchParams.get("step");
  const allowAuthenticatedSignupFlow =
    pathname === "/signup" && signupStep === "persona";

  if (!user && matchesRoute(pathname, protectedRoutes)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);

    return NextResponse.redirect(url);
  }

  if (
    user &&
    matchesRoute(pathname, authRoutes) &&
    !allowAuthenticatedSignupFlow
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";

    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/contracts/:path*",
    "/analytics/:path*",
    "/calendar/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
  ],
};
