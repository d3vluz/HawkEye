import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"
import "react-before-after-slider-component/dist/build.css";
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "600"],
})

export const metadata: Metadata = {
  title: "HawkEye",
  description: "Aplicativo para detecção de objetos em imagens.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`font-sans ${inter.variable}`}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          <Suspense fallback={<div>Carregando...</div>}>
            {children}
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  )
}