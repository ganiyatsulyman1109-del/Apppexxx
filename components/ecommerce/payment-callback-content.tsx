"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, UserPlus } from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { generateWhatsAppLink } from "@/lib/whatsapp"
import { BrandLogo } from "@/components/brand-logo"

export default function PaymentCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams.get("reference") || searchParams.get("trxref")
  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying")
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [customerEmail, setCustomerEmail] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [customerPhone, setCustomerPhone] = useState<string | null>(null)
  const [orderTotal, setOrderTotal] = useState<number>(0)
  const [orderItems, setOrderItems] = useState<any[]>([])
  
  // Create a client just for auth checking
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null
    return createClient(url, anonKey)
  }, [])

  useEffect(() => {
    const checkUser = async () => {
      if (!supabase) return
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setIsLoggedIn(!!session)
      } catch {
        setIsLoggedIn(false)
      }
    }
    checkUser()
  }, [supabase])

  useEffect(() => {
    const verifyPayment = async () => {
      if (!reference) {
        setStatus("failed")
        setError("No payment reference provided")
        return
      }

      try {
        // Verify payment with Paystack
        const response = await fetch("/api/payments/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reference }),
        })

        const data = await response.json()

        if (!response.ok) {
          const message = [data.error, data.details].filter(Boolean).join(": ")
          throw new Error(message || "Failed to verify payment")
        }

        if (data.verified) {
          setStatus("success")
          setOrderNumber(data.order_number)
          setCustomerEmail(data.customer_email || null)
          setCustomerName(data.customer_name || null)
          setCustomerPhone(data.customer_phone || null)
          setOrderTotal(Number(data.order_total || 0))
          setOrderItems(Array.isArray(data.order_items) ? data.order_items : [])
        } else {
          setStatus("failed")
          setError("Payment verification failed")
        }
      } catch (err: any) {
        console.error("Payment verification error:", err)
        setStatus("failed")
        setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : 'Failed to verify payment')
      }
    }

    verifyPayment()
  }, [reference])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-white rounded-2xl shadow-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {status === "verifying" && (
                <BrandLogo size={72} className="animate-spin" priority />
              )}
              {status === "success" && (
                <CheckCircle className="w-12 h-12 text-green-500" />
              )}
              {status === "failed" && (
                <XCircle className="w-12 h-12 text-red-500" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              {status === "verifying" && "Verifying Payment"}
              {status === "success" && "Payment Successful"}
              {status === "failed" && "Payment Failed"}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="text-center">
            {status === "verifying" && (
              <p className="text-gray-600">
                Please wait while we verify your payment with Paystack...
              </p>
            )}
            
            {status === "success" && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Thank you for your purchase! Your order has been successfully processed.
                  </p>
                  <div className="bg-green-50 p-4 rounded-lg inline-block w-full max-w-md">
                    <p className="font-medium text-green-800">
                      Order Number: {orderNumber}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      A confirmation email has been sent to you.
                    </p>
                  </div>
                </div>

                {/* Account Prompt Section */}
                {!isLoggedIn ? (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 max-w-md mx-auto">
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <UserPlus className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-blue-900">Track your order easily</h3>
                      <p className="text-sm text-blue-700">
                        Create an account to track your order status, save your shipping details, and get faster checkout next time.
                      </p>
                      <Link
                        href={{
                          pathname: "/signup",
                          query: {
                            ...(customerEmail ? { email: customerEmail } : {}),
                            ...(customerName ? { name: customerName } : {}),
                            ...(customerPhone ? { phone: customerPhone } : {}),
                            ...(orderNumber ? { order: orderNumber } : {}),
                          },
                        }}
                        className="w-full"
                      >
                        <Button className="w-full bg-blue-600 hover:bg-blue-700">
                          Create Account
                        </Button>
                      </Link>
                      
                      <Button 
                        onClick={() => router.push('/login')} 
                        variant="outline"
                        className="w-full text-gray-700 hover:bg-gray-50"
                      >
                        Already have an account? Sign In
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 max-w-md mx-auto">
                     <p className="text-sm text-gray-600 mb-4">
                       You can view your order status in your account dashboard.
                     </p>
                     <Link href="/account">
                       <Button variant="outline" className="w-full">
                         View Your Orders
                       </Button>
                     </Link>
                  </div>
                )}

                <div className="flex flex-col gap-3 w-full max-w-md mx-auto">
                  {(() => {
                    const productNames = orderItems.length > 0 
                      ? orderItems.map((item: any) => {
                          const name = item.product_name || item.name || item.productName || 'item'
                          const qty = item.quantity || 1
                          return `${name} \u00d7${qty}`
                        }).join(', ') 
                      : 'your items'

                    return (
                      <a
                        href={generateWhatsAppLink({
                          customerName: customerName || 'Customer',
                          customerEmail: customerEmail || undefined,
                          orderNumber: orderNumber || '',
                          productNames: productNames,
                          orderTotal: orderTotal,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                      >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.528 5.847L0 24l6.335-1.525A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.848 0-3.585-.504-5.078-1.383l-.36-.214-3.762.906.942-3.667-.235-.374A9.944 9.944 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z"/>
                        </svg>
                        Chat with Us on WhatsApp
                      </a>
                    )
                  })()}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 border-t">
                  <Link href="/shop">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </div>
            )}
            
            {status === "failed" && (
              <div className="space-y-4">
                <p className="text-gray-600">
                  {error || "We couldn't verify your payment. Please try again or contact support."}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                  <Link href="/cart">
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                      Return to Cart
                    </Button>
                  </Link>
                  <Link href="/shop">
                    <Button variant="outline">
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
