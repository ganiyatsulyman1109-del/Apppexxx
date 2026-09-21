"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { EcommerceProduct } from "@/lib/ecommerce-types"
import { apiClient } from "@/lib/api-client"
import { storageService } from "@/lib/storage"
import { Upload } from "lucide-react"

interface ProductModalProps {
  open: boolean
  onClose: () => void
  product?: EcommerceProduct
  onSuccess: () => void
}

export function ProductModal({ open, onClose, product, onSuccess }: ProductModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    price: "",
    stock: "",
    threshold: "",
    description: "",
    image_url: "",
    brand: "",
    featured: false,
    barcode: ""
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku,
        category: product.category,
        price: product.price.toString(),
        stock: product.stock.toString(),
        threshold: product.threshold?.toString() || "",
        description: product.description || "",
        image_url: product.image_url || "",
        brand: product.brand || "",
        featured: product.featured || false,
        barcode: product.barcode || ""
      })
    } else {
      setFormData({
        name: "",
        sku: "",
        category: "",
        price: "",
        stock: "",
        threshold: "",
        description: "",
        image_url: "",
        brand: "",
        featured: false,
        barcode: ""
      })
    }
    setError("")
  }, [product, open])

  const handleImageUpload = async (file: File) => {
    try {
      const imageUrl = await storageService.uploadProductImage(file, formData.sku || 'temp')
      setFormData({ ...formData, image_url: imageUrl })
      setImageFile(null)
    } catch (error) {
      setError('Failed to upload image')
      console.error('Image upload error:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      let imageUrl = formData.image_url
      
      // Upload image if a new file was selected
      if (imageFile) {
        imageUrl = await storageService.uploadProductImage(imageFile, formData.sku)
      }

      const productData = {
        ...formData,
        image_url: imageUrl,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        threshold: formData.threshold ? parseInt(formData.threshold) : null,
        featured: formData.featured
      }

      if (product) {
        await apiClient.updateProduct(product.id, productData)
      } else {
        await apiClient.createProduct(productData)
      }
      
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : "Failed to save product")
    } finally {
      setLoading(false)
    }
  }

  const categories = ["batteries", "filters", "engine-parts", "brakes", "electrical", "lubricants", "accessories"]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add New Product"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="price">Price (₦) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="stock">Stock Quantity *</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="threshold">Low Stock Threshold</Label>
              <Input
                id="threshold"
                type="number"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="image_file">Product Image</Label>
              <div className="flex gap-2">
                <Input
                  id="image_file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setImageFile(file)
                      // Create preview URL
                      const previewUrl = URL.createObjectURL(file)
                      setFormData({ ...formData, image_url: previewUrl })
                    }
                  }}
                  className="flex-1"
                />
                {imageFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleImageUpload(imageFile)}
                    disabled={!formData.sku || loading}
                  >
                    <Upload className="w-4 h-4" />
                    Upload
                  </Button>
                )}
              </div>
              {formData.image_url && !imageFile && (
                <p className="text-xs text-muted-foreground mt-1">Image uploaded: {formData.image_url.split('/').pop()}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              />
            </div>
          </div>

          <input type="hidden" id="image_url" value={formData.image_url} />

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="featured"
              checked={formData.featured}
              onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
              className="rounded border-gray-300"
            />
            <Label htmlFor="featured">Featured Product</Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : (product ? "Update Product" : "Add Product")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}