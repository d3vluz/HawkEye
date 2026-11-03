import { jwtVerify } from "jose"
import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE = "hawkeye_session"

interface Session {
  role: "ADMIN" | "EMPLOYEE"
  mustChangePassword: boolean
}

async function readSession(request: NextRequest): Promise<Session | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] })
    return payload as unknown as Session
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = await readSession(request)
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url))

  if (!session) return pathname === "/" ? NextResponse.next() : redirectTo("/")

  if (session.mustChangePassword) {
    return pathname === "/trocar-senha" ? NextResponse.next() : redirectTo("/trocar-senha")
  }

  const isAdmin = session.role === "ADMIN"
  const home = isAdmin ? "/admin" : "/inspecao"
  if (pathname === "/" || pathname === "/trocar-senha") return redirectTo(home)
  if (pathname.startsWith("/admin") !== isAdmin) return redirectTo(home)

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/admin/:path*", "/inspecao/:path*", "/results/:path*", "/coletas/:path*", "/trocar-senha"],
}
