import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "600"],
})

export const metadata: Metadata = {
  title: "HawkEye ",
  description: "Aplicativo para detecção de objetos em imagens.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className={`font-sans ${inter.variable}`}>
        <Suspense fallback={<div>Carregando...</div>}>{children}</Suspense>
      </body>
    </html>
  )
}