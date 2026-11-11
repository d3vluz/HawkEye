// Layout raiz: fonte Inter, tema claro/escuro e metadados da aplicação.

import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700"] })

export const metadata: Metadata = {
  title: "HawkEye",
  description: "Inspeção de qualidade por visão computacional.",
}

export default function LayoutRaiz({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`font-sans ${inter.variable}`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
