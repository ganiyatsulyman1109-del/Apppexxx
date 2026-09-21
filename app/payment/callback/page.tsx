import { Suspense } from "react"
import PaymentCallbackContent from "@/components/ecommerce/payment-callback-content"
import { Navbar } from "@/components/ecommerce/navbar"
import { Footer } from "@/components/ecommerce/footer"
import { WhatsAppButton } from "@/components/ecommerce/whatsapp-button"
import { BrandLogo } from "@/components/brand-logo"

export const dynamic = 'force-dynamic'

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            <BrandLogo size={72} className="animate-spin" priority />
          </div>
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
          <p className="text-gray-600">Please wait while we process your payment.</p>
        </div>
      </div>
    </div>
  )
}

export default function PaymentCallbackPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Suspense fallback={<LoadingFallback />}>
        <PaymentCallbackContent />
      </Suspense>
      <Footer />
      <WhatsAppButton />
    </div>
  )
}
