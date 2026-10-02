import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { CartProvider } from "@/components/ecommerce/cart-context"
import { CartDrawer } from "@/components/ecommerce/cart-drawer"
import { ErrorBoundary } from "@/components/error-boundary"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Apex Enterprise",
  description: "Your trusted source for quality products and everyday essentials",
  generator: "v0.app",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <CartProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  )
}
