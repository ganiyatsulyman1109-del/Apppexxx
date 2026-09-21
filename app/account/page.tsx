"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Package, Clock, CreditCard, User, Mail, Phone, MapPin, LogOut, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { apiClient } from "@/lib/api-client"
import { BrandLogo } from "@/components/brand-logo"

interface Order {
  id: string
  order_number: string
  total_amount: number
  status: string
  created_at: string
  items: any[]
  customer_id: string
}

interface CustomerProfile {
  id: string
  full_name: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
}

export default function CustomerAccountPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const meResponse = await apiClient.getMe()
      const currentUser = meResponse?.user
      const currentRole = meResponse?.role

      if (!currentUser) {
        router.push("/login")
        return
      }
      
      if (currentRole !== 'customer') {
        router.push("/")
        return
      }

      setUser(currentUser)
      await fetchCustomerData(currentUser.id)
    } catch (err) {
      console.error("Auth check failed:", err)
      router.push("/login")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCustomerData = async (userId: string) => {
    try {
      // Fetch customer profile
      // Note: userId passed here is the auth.users.id
      // We need to find the customer record where user_id matches
      const profileResponse = await apiClient.getCustomerProfile(userId)
      let customerId = null
      
      if (profileResponse.profile) {
        setProfile(profileResponse.profile)
        customerId = profileResponse.profile.id
      }

      // Fetch customer orders using the customer ID if available, or rely on API to look it up via session
      // The API /api/orders/customer uses session.user.id to find the customer record
      const ordersResponse = await fetch("/api/orders/customer", { credentials: "include" })
      const ordersData = await ordersResponse.json()
      if (!ordersResponse.ok) {
        throw new Error(ordersData.error || "Failed to load orders")
      }
      setOrders(ordersData.orders || [])
    } catch (err) {
      console.error("Error fetching customer data:", err)
      setError("Failed to load account information")
    }
  }

  const handleLogout = async () => {
    try {
      await apiClient.logout()
      router.push("/")
    } catch (err) {
      console.error("Logout failed:", err)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'text-green-600 bg-green-50'
      case 'processing':
      case 'pending':
        return 'text-yellow-600 bg-yellow-50'
      case 'cancelled':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Africa/Lagos'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BrandLogo size={48} className="mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => router.push("/")}>Go to Home</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center text-blue-600 hover:text-blue-700">
                <BrandLogo size={24} className="mr-2" />
                <span className="font-semibold">Apex Enterprise</span>
              </Link>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
              <p className="text-muted-foreground mt-1">
                Welcome back, {profile?.full_name || user?.email}!
              </p>
            </div>
            <Link href="/shop">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{profile?.full_name || 'Not provided'}</p>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{user?.email}</p>
                    <p className="text-sm text-muted-foreground">Email</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{profile?.phone || 'Not provided'}</p>
                    <p className="text-sm text-muted-foreground">Phone</p>
                  </div>
                </div>
                
                {profile?.address && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{profile.address}</p>
                      <p className="text-sm text-muted-foreground">
                        {profile.city}, {profile.state}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Orders Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>Your recent orders and their status</CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No orders yet</p>
                    <Link href="/shop">
                      <Button>Start Shopping</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium">Order #{order.order_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(order.created_at)}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span className="flex items-center">
                              <Package className="h-4 w-4 mr-1" />
                              {order.items?.length || 0} items
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {formatDate(order.created_at)}
                            </span>
                          </div>
                          <p className="font-medium">{formatCurrency(order.total_amount || 0)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
