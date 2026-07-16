import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { EmotionRegistry } from "./EmotionRegistry"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Salimon · 살림온도",
  description: "월간 캘린더 중심 가계부",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <EmotionRegistry>{children}</EmotionRegistry>
      </body>
    </html>
  )
}
