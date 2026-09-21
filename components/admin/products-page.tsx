"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Edit, Plus, Search, Trash2 } from "lucide-react"
import Image from "next/image"
import { apiClient } from "@/lib/api-client"
import type { EcommerceProduct } from "@/lib/ecommerce-types"
import { ProductModal } from "./product-modal"
import { DeleteConfirmDialog } from "./delete-confirm-dialog"
import { createBrowserSupabaseClient } from "@/lib/utils/supabase"

export function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [products, setProducts] = useState<EcommerceProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<EcommerceProduct | undefined>()
  const [productToDelete, setProductToDelete] = useState<EcommerceProduct | null>(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getProducts({
        search: searchQuery,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        t: Date.now()
      })
      setProducts(response.products || [])
    } catch (error) {
      console.error("Error fetching products:", error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()

    const supabase = createBrowserSupabaseClient()
    const channel = supabase
      .channel("products-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          fetchProducts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [searchQuery, categoryFilter])

  const handleAddProduct = () => {
    setSelectedProduct(undefined)
    setModalOpen(true)
  }

  const handleEditProduct = (product: EcommerceProduct) => {
    setSelectedProduct(product)
    setModalOpen(true)
  }

  const handleDeleteProduct = (product: EcommerceProduct) => {
    setProductToDelete(product)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!productToDelete) return

    try {
      await apiClient.deleteProduct(productToDelete.id)
      await fetchProducts()
      setDeleteDialogOpen(false)
      setProductToDelete(null)
    } catch (error) {
      console.error("Error deleting product:", error)
    }
  }

  const handleModalSuccess = async () => {
    await fetchProducts()
    setModalOpen(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product inventory and pricing</p>
        </div>
        <Button className="bg-[#2563eb] hover:bg-[#1d4ed8]" onClick={handleAddProduct}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="electronics">Electronics</SelectItem>
            <SelectItem value="fashion">Fashion</SelectItem>
            <SelectItem value="food-drinks">Food & Drinks</SelectItem>
            <SelectItem value="health-beauty">Health & Beauty</SelectItem>
            <SelectItem value="home-office">Home & Office</SelectItem>
            <SelectItem value="phones-accessories">Phones & Accessories</SelectItem>
            <SelectItem value="sporting-goods">Sporting Goods</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Products ({products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Product</th>
                  <th className="text-left py-3 px-4 font-medium">SKU</th>
                  <th className="text-left py-3 px-4 font-medium">Category</th>
                  <th className="text-right py-3 px-4 font-medium">Price</th>
                  <th className="text-center py-3 px-4 font-medium">Stock</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded bg-gray-200 animate-pulse" />
                          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-6 w-24 bg-gray-200 rounded-full animate-pulse" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse ml-auto" />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="h-6 w-12 bg-gray-200 rounded-full animate-pulse mx-auto" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No products found
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 rounded overflow-hidden bg-muted">
                            <Image 
                              src={product.image || "/placeholder.svg"} 
                              alt={product.name} 
                              fill 
                              className="object-cover" 
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">{product.name}</span>
                            <span className="text-xs text-muted-foreground sm:hidden">{product.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground hidden sm:table-cell">{product.sku}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="capitalize">
                          {product.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">₦{product.price.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={product.stock < 10 ? "destructive" : "secondary"}>
                          {product.stock}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteProduct(product)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      <ProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={selectedProduct}
        onSuccess={handleModalSuccess}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Product"
        description={`Are you sure you want to delete "${productToDelete?.name}"? This action cannot be undone.`}
      />
    </div>
  )
}