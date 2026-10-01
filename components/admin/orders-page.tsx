"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Eye, Printer, Search, ChevronDown, Edit, Loader2 } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import type { Order, OrderStatus } from "@/lib/admin-types"
import { createBrowserClient } from "@/lib/utils/supabase"
import { formatNigerianDate } from "@/lib/utils/date"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function OrdersPage() {
  const channelNameRef = useRef(`orders-realtime-${Math.random().toString(36).slice(2)}`)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [activeTab, setActiveTab] = useState<"all" | "pending-transfers">("all")
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [confirmingPayment, setConfirmingPayment] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editStatus, setEditStatus] = useState<OrderStatus>("pending")
  const [editPaymentStatus, setEditPaymentStatus] = useState("pending")
  const [editItems, setEditItems] = useState<any[]>([])
  const [counts, setCounts] = useState({ total: 0, pending: 0, processing: 0, delivered: 0, confirmed: 0, pendingTransfers: 0 })

  useEffect(() => {
    fetchOrders()

    const supabase = createBrowserClient()
    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeTab])

  const fetchOrders = async (pendingTransfersOnly = activeTab === "pending-transfers") => {
    try {
      setLoading(true)
      
      try {
        const countsResponse = await apiClient.getOrders({ countOnly: true })
        if (countsResponse.counts) {
          setCounts((previous) => ({ ...previous, ...countsResponse.counts }))
        }
      } catch (err) {
        console.error("Error fetching order counts:", err)
      }

      // Fetch all orders without limit
      const response = await apiClient.getOrders({
        limit: 10000,
        ...(pendingTransfersOnly
          ? { payment_method: "bank_transfer", payment_status: "awaiting_confirmation" }
          : {}),
      })
      
      // Map the API response to match the expected Order type
      const mappedOrders = (response.orders || []).map((order: any) => ({
        id: order.id,
        orderNumber: order.order_number,
        customerName: order.source === 'pos' && !order.customers?.full_name 
          ? 'Walk-in Customer' 
          : order.customers?.full_name || order.easybuy_customers?.full_name || order.customer_name || 'Unknown Customer',
        date: new Date(order.created_at),
        source: order.source === 'ecommerce' || order.channel === 'online' ? 'online' : order.source === 'easybuy' ? 'easybuy' : 'pos',
        items: typeof order.items === 'string' ? JSON.parse(order.items).length : (order.items?.length || 0),
        itemDetails: typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []),
        amount: parseFloat(order.total_amount ?? order.total) || 0,
        status: order.status as OrderStatus,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        shippingAddress: (() => {
          try {
            return typeof order.shipping_address === 'string' 
              ? JSON.parse(order.shipping_address) 
              : order.shipping_address
          } catch (e) {
            return order.shipping_address
          }
        })(),
        notes: order.notes
      }))
      
      setOrders(mappedOrders)
    } catch (error) {
      console.error("Error fetching orders:", error)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingStatus(orderId)
      await apiClient.updateOrder(orderId, { status: newStatus })
      
      // Update the order in the local state
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus as OrderStatus } : order
      ))
    } catch (error) {
      console.error("Error updating order status:", error)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const confirmBankTransfer = async (order: Order) => {
    try {
      setConfirmingPayment(order.id)
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/confirm-payment`, {
        method: "POST",
        credentials: "include",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Unable to confirm this payment.")
      }

      const updatedStatus = (data?.order?.status || "confirmed") as OrderStatus
      const updatedPaymentStatus = data?.order?.payment_status || "confirmed"
      const updateOrder = (current: Order): Order =>
        current.id === order.id
          ? { ...current, status: updatedStatus, paymentStatus: updatedPaymentStatus }
          : current

      setOrders((current) => current.map(updateOrder))
      setSelectedOrder((current) => (current ? updateOrder(current) : current))
      setCounts((current) => ({
        ...current,
        pendingTransfers: Math.max(0, current.pendingTransfers - 1),
      }))
      toast({
        title: "Payment confirmed",
        description: "Payment confirmed ✓ Order is now active",
      })
    } catch (error) {
      toast({
        title: "Could not confirm payment",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setConfirmingPayment(null)
    }
  }

  const handleEditClick = (order: Order) => {
    setEditingOrder(order)
    setEditStatus(order.status)
    setEditPaymentStatus(order.paymentStatus || 'pending')
    // Initialize editable items list from the order details 
    // Fallback to empty array if not present 
    setEditItems((order as any).itemDetails || []) 
  }

  const handleEditSave = async () => {
    if (!editingOrder) return

    try {
      setUpdatingStatus(editingOrder.id)
      
      const updates: any = {}
      if (editStatus !== editingOrder.status) updates.status = editStatus
      if (editPaymentStatus !== (editingOrder.paymentStatus || 'pending')) updates.payment_status = editPaymentStatus
      // Detect item changes
      const originalItems = (editingOrder as any).itemDetails || []
      const itemsChanged = JSON.stringify(editItems) !== JSON.stringify(originalItems)
      if (itemsChanged) {
        updates.items = editItems
      }
      
      if (Object.keys(updates).length > 0) {
        // Use PATCH when items are updated, otherwise PUT
        const method = updates.items ? 'PATCH' : 'PUT'
        await fetch(`/api/orders/${editingOrder.id}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(updates)
        })
        // Refresh orders from server to reflect changes
        fetchOrders()
      }
      
      setEditingOrder(null)
    } catch (error) {
      console.error("Error updating order:", error)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleQuantityChange = (index: number, newQuantity: number) => {
    if (newQuantity < 0) return
    const newItems = [...editItems]
    newItems[index] = { ...newItems[index], quantity: newQuantity }
    setEditItems(newItems)
  }

  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null)
  const [deleteOrderNumber, setDeleteOrderNumber] = useState<string>("")
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteClick = (order: Order) => {
    setDeleteOrderId(order.id)
    setDeleteOrderNumber(order.orderNumber)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteOrderId) return
    try {
      setIsDeleting(true)
      await apiClient.deleteOrder(deleteOrderId)
      setOrders(prev => prev.filter(o => o.id !== deleteOrderId))
      setDeleteOrderId(null)
    } catch (error) {
      console.error("Error deleting order:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase())
    
    let matchesStatus = true 
    if (statusFilter === 'pending') { 
      matchesStatus = order.source === 'easybuy' && order.paymentStatus === 'pending'
    } else if (statusFilter === 'processing') { 
      matchesStatus = order.source === 'online' && 
        order.status !== 'delivered' && 
        order.status !== 'cancelled' 
    } else if (statusFilter === 'delivered') { 
      matchesStatus = order.source === 'online' && 
        order.status === 'delivered' 
    } 
    const matchesTransferTab =
      activeTab !== "pending-transfers" ||
      (order.paymentMethod === "bank_transfer" && order.paymentStatus === "awaiting_confirmation")
    return matchesStatus && matchesSearch && matchesTransferTab
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "badge-warning"
      case "processing":
        return "badge-info"
      case "ready":
        return "badge-positive"
      case "delivered":
        return "bg-[#f3f4f6] text-[#374151]"
      case "cancelled":
        return "badge-negative"
      default:
        return "bg-[#f3f4f6] text-[#374151]"
    }
  }

  const getSourceBadge = (source: string) => {
    if (source === "online") {
      return <Badge className="bg-[#2563eb]">Online</Badge>
    }
    if (source === "easybuy") {
      return <Badge className="bg-purple-600">EasyBuy</Badge>
    }
    return <Badge className="bg-[#2563eb]">POS</Badge>
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Track and manage customer orders</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white border-[#e5e7eb] rounded-xl shadow-sm">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{counts.total}</div>
            <p className="text-sm text-muted-foreground">Total Orders</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#e5e7eb] rounded-xl shadow-sm">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">
              {counts.pending}
            </div>
            <p className="text-sm font-medium text-muted-foreground">Pending EasyBuy Orders</p>
            <p className="text-xs text-muted-foreground mt-1">EasyBuy sales awaiting payment</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#e5e7eb] rounded-xl shadow-sm">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-[#2563eb]">
              {counts.processing}
            </div>
            <p className="text-sm font-medium text-muted-foreground">Ecommerce Processing</p>
            <p className="text-xs text-muted-foreground mt-1">Ecommerce orders pending delivery</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#e5e7eb] rounded-xl shadow-sm">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-[#16a34a]">
              {counts.delivered}
            </div>
            <p className="text-sm font-medium text-muted-foreground">Ecommerce Delivered</p>
            <p className="text-xs text-muted-foreground mt-1">Ecommerce orders successfully delivered</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by order number or customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Order filters">
        <Button
          type="button"
          variant={activeTab === "all" ? "default" : "outline"}
          onClick={() => setActiveTab("all")}
          role="tab"
          aria-selected={activeTab === "all"}
        >
          All Orders
        </Button>
        <Button
          type="button"
          variant={activeTab === "pending-transfers" ? "default" : "outline"}
          onClick={() => setActiveTab("pending-transfers")}
          role="tab"
          aria-selected={activeTab === "pending-transfers"}
          className="gap-2"
        >
          Pending Transfers
          {counts.pendingTransfers > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#dc2626] px-1 text-xs text-white">
              {counts.pendingTransfers}
            </span>
          )}
        </Button>
      </div>

      <Card className="bg-white border-[#e5e7eb] rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>{activeTab === "pending-transfers" ? "Pending Transfers" : "All Orders"} ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Order #</th>
                  <th className="text-left py-3 px-4 font-medium">Customer</th>
                  <th className="text-left py-3 px-4 font-medium">Date</th>
                  <th className="text-center py-3 px-4 font-medium">Source</th>
                  <th className="text-center py-3 px-4 font-medium">Items</th>
                  <th className="text-right py-3 px-4 font-medium">Amount</th>
                  <th className="text-center py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="py-3 px-4">
                          <div className="h-4 bg-[#f3f4f6] rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{order.orderNumber}</td>
                      <td className="py-3 px-4">{order.customerName}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatNigerianDate(order.date, 'datetime')}
                      </td>
                      <td className="py-3 px-4 text-center">{getSourceBadge(order.source)}</td>
                      <td className="py-3 px-4 text-center">{order.items}</td>
                      <td className="py-3 px-4 text-right font-medium">₦{order.amount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">
                        {order.source === 'online' ? (
                          <Select 
                            value={order.status} 
                            onValueChange={(value) => updateOrderStatus(order.id, value)}
                            disabled={updatingStatus === order.id}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="processing">Processing</SelectItem>
                              <SelectItem value="shipped">Shipped</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={getStatusColor(order.status)} variant="secondary">
                            {order.status}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white border-[#e5e7eb] rounded-2xl p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#111827]">Order Details - {selectedOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{formatNigerianDate(selectedOrder.date, 'datetime')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Source</p>
                  <div className="mt-1">{getSourceBadge(selectedOrder.source)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={`mt-1 ${getStatusColor(selectedOrder.status)}`} variant="secondary">
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Status</p>
                  <p className="font-medium capitalize">{selectedOrder.paymentStatus || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Method</p>
                  <p className="font-medium capitalize">{selectedOrder.paymentMethod || 'N/A'}</p>
                </div>
              </div>

              {selectedOrder.paymentMethod === "bank_transfer" &&
                selectedOrder.paymentStatus === "awaiting_confirmation" && (
                  <div className="mt-2 flex flex-col items-start justify-between gap-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 sm:flex-row sm:items-center">
                    <p className="text-sm font-medium text-[#92400e]">
                      ⏳ Awaiting bank transfer confirmation
                    </p>
                    <Button
                      type="button"
                      disabled={confirmingPayment === selectedOrder.id}
                      onClick={() => void confirmBankTransfer(selectedOrder)}
                      className="bg-[#d97706] text-white hover:bg-[#b45309]"
                    >
                      {confirmingPayment === selectedOrder.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Confirm Payment Received
                    </Button>
                  </div>
                )}

              {selectedOrder.shippingAddress && (
                <div>
                  <h4 className="font-semibold mb-2">Shipping Details</h4>
                  <div className="bg-muted/50 p-3 rounded-md text-sm">
                    <p>{selectedOrder.shippingAddress.address || selectedOrder.shippingAddress}</p>
                    <p>{selectedOrder.shippingAddress.city} {selectedOrder.shippingAddress.state}</p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">Order Items</h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.itemDetails?.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.name || item.product_name || 'Unknown Product'}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">₦{(item.price || item.unit_price || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">₦{((item.quantity || 0) * (item.price || item.unit_price || 0)).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold">Total Amount</TableCell>
                        <TableCell className="text-right font-bold">₦{selectedOrder.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                    {selectedOrder.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent className="bg-white border-[#e5e7eb] rounded-2xl p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#111827]">Edit Order - {editingOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as OrderStatus)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="payment_status" className="text-right">
                Payment
              </Label>
              <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="mt-4">
              <Label className="mb-2 block">Order Items (Quantity Edit)</Label>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-24 text-center">Quantity</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm">
                          {item.name || item.product_name || item.productName || 'Item'}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            className="h-8 w-20 text-center mx-auto"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          ₦{(item.price || item.unit_price || item.unitPrice || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrder(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={updatingStatus === editingOrder?.id}>
              {updatingStatus === editingOrder?.id ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
