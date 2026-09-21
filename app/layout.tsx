import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { CartProvider } from "@/components/ecommerce/cart-context"
import { CartDrawer } from "@/components/ecommerce/cart-drawer"
import { ErrorBoundary } from "@/components/error-boundary"
import "./globals.css"

export const metadata: Metadata = {
  title: "JOEBEK AUTO-MART - Quality Car Parts in Nigeria",
  description: "Your trusted source for genuine automotive parts and accessories in Nigeria",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/joebek-logo.png",
      },
    ],
    apple: "/joebek-logo.png",
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
      <body className={`font-sans antialiased`}>
        <CartProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <CartDrawer />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  )
}
