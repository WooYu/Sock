import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { SharedDataSyncProvider } from "@/features/records/shared-data-sync-provider"
import "./globals.css"
import "./workspace-polish.css"
import "./kline-layout.css"
import "./interface-system.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "StockCal",
  description: "整理资料、观察趋势与验证想法的研究空间",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><SharedDataSyncProvider />{children}</body>
    </html>
  )
}
