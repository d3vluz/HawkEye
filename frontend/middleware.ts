// Redireciona pela sessão do cookie: sem sessão vai ao login, senha temporária à troca e cada perfil à sua área.
// A permissão de verdade é sempre conferida pela API; aqui é só navegação.

import { jwtVerify } from "jose"
import { NextResponse, type NextRequest } from "next/server"

import type { Perfil } from "@/types"

const COOKIE_DA_SESSAO = "hawkeye_session"

async function lerSessao(requisicao: NextRequest) {
  const token = requisicao.cookies.get(COOKIE_DA_SESSAO)?.value
  if (!token) return null
  try {
    const segredo = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, segredo, { algorithms: ["HS256"] })
    return payload as unknown as { role: Perfil; mustChangePassword: boolean }
  } catch {
    return null
  }
}

export async function middleware(requisicao: NextRequest) {
  const { pathname: caminho } = requisicao.nextUrl
  const sessao = await lerSessao(requisicao)
  const irPara = (destino: string) => NextResponse.redirect(new URL(destino, requisicao.url))

  if (!sessao) return caminho === "/" ? NextResponse.next() : irPara("/")
  if (sessao.mustChangePassword) return caminho === "/trocar-senha" ? NextResponse.next() : irPara("/trocar-senha")

  const admin = sessao.role === "ADMIN"
  const inicio = admin ? "/admin" : "/inspecao"
  if (caminho === "/" || caminho === "/trocar-senha") return irPara(inicio)
  if (caminho.startsWith("/admin") !== admin) return irPara(inicio)
  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/admin/:path*", "/inspecao/:path*", "/results/:path*", "/coletas/:path*", "/trocar-senha"],
}
