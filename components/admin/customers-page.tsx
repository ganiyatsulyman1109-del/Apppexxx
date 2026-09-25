"use client"

import { useState, useEffect } from "react"
import { Search, Eye, RefreshCw, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency, formatNumber, getStatusColor } from "@/lib/admin-types"
import { formatNigerianDate } from "@/lib/utils/date"

interface Customer {
  id: string
  full_name: string
  email: string
  phone: string
  total_orders: number
  total_spent: number
  created_at: string
  orders: Order[]
}

interface Order {
  id: string
  order_number: string
  total_amount: number
  payment_status: string
  status: string
  created_at: string
  items: any[]
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showOrdersModal, setShowOrdersModal] = useState(false)

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/customers', { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch customers')
      const data = await response.json()
      setCustomers(data.customers || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const filteredCustomers = customers.filter(customer => 
    customer.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  ).sort((a, b) => {
    const aLatest = (a as any).latest_order_date ? new Date((a as any).latest_order_date).getTime() : 0
    const bLatest = (b as any).latest_order_date ? new Date((b as any).latest_order_date).getTime() : 0
    return bLatest - aLatest
  })

  const handleViewOrders = (customer: Customer) => {
    setSelectedCustomer(customer)
    setShowOrdersModal(true)
  }

  return (
    <div className="space-y-6 p-6 bg-background text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your ecommerce customers</p>
        </div>
        <Button onClick={fetchCustomers} variant="outline" size="icon">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-0">
          <Table className="bg-card border border-border rounded-lg overflow-hidden">
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Total Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.full_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span>{customer.email}</span>
                        <span className="text-muted-foreground">{customer.phone || 'No phone'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{customer.total_orders}</TableCell>
                    <TableCell>{formatCurrency(customer.total_spent)}</TableCell>
                    <TableCell>{formatNigerianDate(customer.created_at, 'date')}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewOrders(customer)}
                      >
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        View Orders
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showOrdersModal} onOpenChange={setShowOrdersModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Order History</DialogTitle>
            <DialogDescription>
              Orders for {selectedCustomer?.full_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 max-h-[70vh] overflow-y-auto space-y-4">
            {selectedCustomer?.orders && selectedCustomer.orders.length > 0 ? (
              <div className="rounded-md border p-4">
                <div className="font-semibold mb-2">Most Recent Order</div>
                {(() => {
                  const ordersSorted = [...selectedCustomer.orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  const recent = ordersSorted[0]
                  const items = Array.isArray(recent.items)
                    ? recent.items
                    : typeof recent.items === 'string'
                    ? (() => { try { return JSON.parse(recent.items) } catch { return [] } })()
                    : []
                  return (
                    <div className="grid gap-2">
                      <div className="flex justify-between">
                        <div className="font-mono">{recent.order_number}</div>
                        <div className="text-sm">{formatNigerianDate(recent.created_at, 'datetime')}</div>
                      </div>
                      <div className="flex justify-between">
                        <Badge variant={recent.payment_status === 'paid' ? 'default' : 'secondary'} className={recent.payment_status === 'paid' ? 'badge-positive' : ''}>
                          {recent.payment_status}
                        </Badge>
                        <Badge className={getStatusColor(recent.status as any)}>
                          {recent.status}
                        </Badge>
                      </div>
                      <div className="border-t pt-2">
                        {items.map((item: any, i: number) => {
                          const itemName = item.product_name || item.name || 'Product'
                          const qty = Number(item.quantity || 1)
                          const unitPrice = Number(item.unit_price || item.unitPrice || item.price || 0)
                          const itemPrice = Number(item.total_price || 0) || (unitPrice * qty)
                          return (
                            <div key={i} className="text-xs text-muted-foreground flex justify-between gap-2 py-0.5">
                              <span>{itemName} × {qty}</span>
                              <span>₦{itemPrice.toLocaleString('en-NG')}</span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex justify-end font-medium">
                        {formatCurrency(recent.total_amount)}
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : null}
            <Table className="bg-card border border-border rounded-lg overflow-hidden">
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedCustomer?.orders && selectedCustomer.orders.length > 1 ? (
                  [...selectedCustomer.orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(1).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-mono">{order.order_number}</div>
                        {order.items && (
                          <div className="mt-2 space-y-1">
                            {(() => { 
                              const parsedItems = Array.isArray(order.items) 
                                ? order.items 
                                : typeof order.items === 'string' 
                                ? (() => { 
                                    try { return JSON.parse(order.items) } 
                                    catch { return [] } 
                                  })() 
                                : [] 
                              return parsedItems.map((item: any, i: number) => { 
                                const itemName = item.product_name 
                                  || item.name 
                                  || item.productName 
                                  || item.title
                                  || 'Product' 
                                const qty = Number(item.quantity || 1) 
                                const unitPrice = Number( 
                                  item.unit_price || item.unitPrice 
                                  || item.price || 0) 
                                const itemPrice = Number(item.total_price || 0) 
                                  || (unitPrice * qty) 
                                return ( 
                                  <div key={i} 
                                    className="text-xs text-muted-foreground flex justify-between gap-2 py-0.5"> 
                                    <span>{itemName} &times; {qty}</span> 
                                    <span> 
                                      ₦{itemPrice.toLocaleString('en-NG')} 
                                    </span> 
                                  </div> 
                                ) 
                              }) 
                            })()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{formatNigerianDate(order.created_at, 'date')}</TableCell>
                      <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'} className={order.payment_status === 'paid' ? 'badge-positive' : ''}>
                          {order.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(order.status as any)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    {selectedCustomer?.orders && selectedCustomer.orders.length === 1 ? (
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        No previous orders
                      </TableCell>
                    ) : (
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        No orders found for this customer
                      </TableCell>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
