"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Navbar } from "@/components/ecommerce/navbar"
import { Footer } from "@/components/ecommerce/footer"
import { WhatsAppButton } from "@/components/ecommerce/whatsapp-button"
import { useCart } from "@/components/ecommerce/cart-context"
import { BrandLogo } from "@/components/brand-logo"
import { getCurrentUser } from "@/lib/auth"
import { Loader2, ArrowLeft, CreditCard } from "lucide-react"

interface ShippingDetails {
  fullName: string
  email: string
  phone: string
  address: string
  city: string
  state: string
}

export default function CheckoutPage() {
  const { items, getTotalPrice } = useCart()
  const router = useRouter()
  const [shippingDetails, setShippingDetails] = useState<ShippingDetails>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: ""
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isUserLoading, setIsUserLoading] = useState(true)

  // Redirect to shop if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      router.push("/shop")
    }
  }, [items, router])

  // Load user data if logged in
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userData = await getCurrentUser()
        if (userData) {
          // Pre-fill form with user data
          setShippingDetails(prev => ({
            ...prev,
            fullName: userData.full_name || "",
            email: userData.email || "",
          }))
        }
      } catch (err) {
        console.error("Error loading user data:", err)
      } finally {
        setIsUserLoading(false)
      }
    }

    loadUserData()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setShippingDetails(prev => ({
      ...prev,
      [name]: value
    }))
    setError("")
  }

  const handlePayWithPaystack = async () => {
    // Validate form
    if (!shippingDetails.fullName || !shippingDetails.email || 
        !shippingDetails.phone || !shippingDetails.address || 
        !shippingDetails.city || !shippingDetails.state) {
      setError("Please fill in all shipping details")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // Prepare cart items for API
      const cartItems = items.map(item => ({
        product_id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        unit_price: item.product.price
      }))

      // Call Paystack initialization API
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cartItems,
          customer_email: shippingDetails.email,
          shipping_details: shippingDetails,
          total_amount: getTotalPrice(),
          metadata: {
            customer_name: shippingDetails.fullName,
            customer_email: shippingDetails.email,
            customer_phone: shippingDetails.phone,
          }
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize payment")
      }

      // Redirect to Paystack payment page
      window.location.href = data.payment_url
    } catch (err: any) {
      console.error("Payment initialization error:", err)
      setError(err.message || "Failed to initialize payment. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center">
        <BrandLogo size={64} className="animate-spin" priority />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center mb-8">
          <Button 
            variant="outline" 
            onClick={() => router.back()} 
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-[#111827] ml-4">Checkout</h1>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-[#6b7280] mb-6">Add items to your cart to checkout</p>
            <Link href="/shop">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Continue Shopping
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Shipping Details Form */}
            <div className="lg:col-span-2">
              <Card className="bg-white rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold">Shipping Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        value={shippingDetails.fullName}
                        onChange={handleInputChange}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={shippingDetails.email}
                        onChange={handleInputChange}
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        name="phone"
                        value={shippingDetails.phone}
                        onChange={handleInputChange}
                        placeholder="+234 801 234 5678"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="address">Delivery Address *</Label>
                      <Input
                        id="address"
                        name="address"
                        value={shippingDetails.address}
                        onChange={handleInputChange}
                        placeholder="Street address"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        name="city"
                        value={shippingDetails.city}
                        onChange={handleInputChange}
                        placeholder="City"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        name="state"
                        value={shippingDetails.state}
                        onChange={handleInputChange}
                        placeholder="State"
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-white rounded-2xl shadow-sm sticky top-24">
                <CardHeader>
                  <CardTitle className="text-xl font-bold">Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 mb-6">
                    {items.map((item) => (
                      <div key={item.product.id} className="flex justify-between">
                        <div>
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm text-[#6b7280]">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-medium">₦{(item.product.price * item.quantity).toLocaleString()}</p>
                      </div>
                    ))}
                    
                    <div className="border-t pt-4">
                      <div className="flex justify-between text-[#374151] mb-2">
                        <span>Subtotal</span>
                        <span className="font-medium">₦{getTotalPrice().toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[#374151] mb-2">
                        <span>Delivery Fee</span>
                        <span className="font-medium text-sm">To be discussed</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-4">
                        <span>Total</span>
                        <span className="text-blue-600">₦{getTotalPrice().toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md mb-4">
                      {error}
                    </div>
                  )}
                  
                  <Button 
                    className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center justify-center gap-2"
                    size="lg"
                    onClick={handlePayWithPaystack}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Pay with Paystack
                      </>
                    )}
                  </Button>
                  
                  <p className="text-xs text-[#6b7280] mt-4 text-center">
                    You will be redirected to Paystack to complete your payment securely.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <Footer />
      <WhatsAppButton />
    </div>
  )
}
