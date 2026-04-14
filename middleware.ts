import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/** Якщо змінні Supabase не задані — пропускаємо запит без оновлення сесії. */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  if (pathname === "/dashboard" || pathname === "/dashboard/appointments") {
    const target = new URL("/appointments", request.url);
    return NextResponse.redirect(target);
  }
  if (pathname === "/dashboard/clients") {
    const target = new URL("/clients", request.url);
    return NextResponse.redirect(target);
  }
  if (pathname === "/u" || pathname.startsWith("/u/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/запис" || pathname === "/zapis") {
    const target = new URL("/appointments", request.url);
    return NextResponse.redirect(target);
  }
  if (pathname === "/клієнти" || pathname === "/kliyenty") {
    const target = new URL("/clients", request.url);
    return NextResponse.redirect(target);
  }

  const isProtectedPath =
    pathname === "/appointments" ||
    pathname.startsWith("/appointments/") ||
    pathname === "/clients" ||
    pathname.startsWith("/clients/") ||
    pathname === "/services" ||
    pathname.startsWith("/services/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname.startsWith("/dashboard");

  if (isProtectedPath && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname === "/login" || pathname === "/register") && user) {
    return NextResponse.redirect(new URL("/appointments", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
