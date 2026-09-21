"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, PackagePlus, Search, TrendingDown, TrendingUp } from "lucide-react"
import Image from "next/image"
import { apiClient } from "@/lib/api-client"
import type { EcommerceProduct } from "@/lib/ecommerce-types"
import { StockAdjustmentModal } from "./stock-adjustment-modal"

interface InventoryLogItem {
  id: string
  change_type: string
  quantity_change: number
  previous_stock: number
  new_stock: number
  created_at: string
  products?: {
    name?: string
    sku?: string
  } | null
}

export function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [products, setProducts] = useState<EcommerceProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalSKUs: 0,
    lowStockAlerts: 0,
    outOfStock: 0,
    inventoryValue: 0
  })
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [productToAdjust, setProductToAdjust] = useState<EcommerceProduct | null>(null)
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLogItem[]>([])

  const fetchInventoryData = async () => {
    try {
      setLoading(true)
      
      const productsPromise = apiClient.getProducts({ t: Date.now() })
      const logsPromise = apiClient.getInventoryLogs({ t: Date.now() })
      
      const [response, logsResponse] = await Promise.all([
        productsPromise,
        logsPromise
      ])
      
      const allProducts = response.products || []
      
      // Calculate stats
      const totalSKUs = allProducts.length
      const lowStockAlerts = allProducts.filter((p: EcommerceProduct) => p.stock <= (p.threshold || 10) && p.stock > 0).length
      const outOfStock = allProducts.filter((p: EcommerceProduct) => p.stock === 0).length
      const inventoryValue = allProducts.reduce((sum: number, p: EcommerceProduct) => sum + (p.stock * p.price), 0)
      
      setStats({
        totalSKUs,
        lowStockAlerts,
        outOfStock,
        inventoryValue
      })
      
      setProducts(allProducts)
      setInventoryLogs(logsResponse.inventory_logs || [])
    } catch (error) {
      console.error("Error fetching inventory data:", error)
      setProducts([])
      setInventoryLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInventoryData()
  }, [])

  const filteredLowStock = products.filter((product) =>
    (product.stock <= (product.threshold || 10)) &&
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const topSellingProducts = products
    .filter(p => p.units_sold && p.units_sold > 0)
    .sort((a, b) => (b.units_sold || 0) - (a.units_sold || 0))
    .slice(0, 5)

  const handleAdjustStock = (product: EcommerceProduct) => {
    setProductToAdjust(product)
    setAdjustModalOpen(true)
  }

  const handleAdjustSuccess = async () => {
    await fetchInventoryData()
    setAdjustModalOpen(false)
    setProductToAdjust(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Monitor stock levels and restock alerts</p>
        </div>
        <Button 
          className="bg-orange-500 hover:bg-orange-600"
          onClick={() => {
            setProductToAdjust(null)
            setAdjustModalOpen(true)
          }}
        >
          <PackagePlus className="mr-2 h-4 w-4" />
          Restock Items
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.totalSKUs}</div>
                <p className="text-sm text-muted-foreground">Total SKUs</p>
              </div>
              <PackagePlus className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.lowStockAlerts}</div>
                <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.outOfStock}</div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
              </div>
              <TrendingDown className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">₦{stats.inventoryValue.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Inventory Value</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search inventory by product name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Restock Alerts
              </CardTitle>
              <Badge variant="destructive">{filteredLowStock.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded bg-gray-200 animate-pulse" />
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                    </div>
                    <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLowStock.map((product) => (
                  <div key={product.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 rounded overflow-hidden bg-muted">
                        <Image 
                          src={product.image_url || "/placeholder.svg"} 
                          alt={product.name} 
                          fill 
                          className="object-cover" 
                        />
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive" className="mb-1">
                        {product.stock} in stock
                      </Badge>
                      <p className="text-xs text-muted-foreground">Min: {product.threshold || 10}</p>
                      <Button 
                        size="sm" 
                        className="mt-2"
                        onClick={() => handleAdjustStock(product)}
                      >
                        Adjust Stock
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-green-600 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Selling Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading top selling items...</div>
            ) : (
              <div className="space-y-4">
                {topSellingProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="relative h-12 w-12 rounded overflow-hidden bg-muted">
                        <Image 
                          src={product.image_url || "/placeholder.svg"} 
                          alt={product.name} 
                          fill 
                          className="object-cover" 
                        />
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.units_sold || 0} sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">₦{((product.units_sold || 0) * product.price).toLocaleString()}</p>
                      <Badge variant="secondary" className="mt-1">
                        {product.stock} left
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Inventory Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading inventory logs...</div>
          ) : inventoryLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No inventory logs found.</div>
          ) : (
            <div className="space-y-3">
              {inventoryLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">{log.products?.name || "Product"}</p>
                    <p className="text-xs text-muted-foreground">{log.products?.sku || "N/A"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{log.change_type}</Badge>
                    <p className="text-sm mt-1">
                      {log.previous_stock} → {log.new_stock} ({log.quantity_change})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <StockAdjustmentModal
        open={adjustModalOpen}
        onClose={() => {
          setAdjustModalOpen(false)
          setProductToAdjust(null)
        }}
        product={productToAdjust || undefined}
        products={products}
        onSuccess={handleAdjustSuccess}
      />
    </div>
  )
}
