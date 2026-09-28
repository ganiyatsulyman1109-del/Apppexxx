"use client"

import { Upload, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { StepProps } from "@/components/onboarding/onboarding-wizard"

export function StepUpload({ data, onChange }: StepProps) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [removingUrl, setRemovingUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState("")

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>, type: "logo" | "products") {
    const input = event.currentTarget
    const files = Array.from(input.files || [])
    if (files.length === 0) return

    setUploadError("")
    const maxSize = type === "logo" ? 2097152 : 5242880
    if (type === "logo" && files.length > 1) {
      setUploadError("Choose one logo file at a time.")
      input.value = ""
      return
    }
    if (type === "products" && data.productImageUrls.length + files.length > 10) {
      setUploadError(`You can add ${Math.max(0, 10 - data.productImageUrls.length)} more product images.`)
      input.value = ""
      return
    }
    for (const file of files) {
      if (file.size > maxSize) {
        setUploadError(`${file.name} is too large. Maximum size is ${maxSize / 1024 / 1024}MB.`)
        input.value = ""
        return
      }
      const extension = file.name.split(".").pop()?.toLowerCase() || ""
      const validTypes: Record<string, string[]> = {
        "image/jpeg": ["jpg", "jpeg"],
        "image/png": ["png"],
        "image/webp": ["webp"],
        "image/svg+xml": ["svg"],
      }
      if (!validTypes[file.type]?.includes(extension)) {
        setUploadError(`${file.name} is not a supported image type. Use matching JPEG, PNG, WebP, or SVG files.`)
        input.value = ""
        return
      }
    }

    setUploading(type)
    try {
      const formData = new FormData()
      files.forEach((file) => formData.append(type === "logo" ? "file" : "files", file))

      const endpoint = type === "logo" ? "/api/upload/logo" : "/api/upload/products"
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      const result = (await response.json()) as { error?: string; url?: string; urls?: string[] }
      if (!response.ok) {
        throw new Error(result.error || `Upload failed for ${type}.`)
      }

      if (type === "logo") {
        if (!result.url) throw new Error(result.error || "Logo upload returned no image URL.")
        onChange({ logoUrl: result.url })
      } else {
        if (!result.urls?.length) throw new Error(result.error || "Product upload returned no image URLs.")
        onChange({ productImageUrls: [...data.productImageUrls, ...result.urls] })
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Try again.")
    } finally {
      setUploading(null)
      input.value = ""
    }
  }

  async function removeProductImage(index: number) {
    const url = data.productImageUrls[index]
    if (!url) return
    setUploadError("")
    setRemovingUrl(url)
    try {
      const response = await fetch("/api/upload/products", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || result.success !== true) {
        throw new Error(result.error || "Unable to remove product image.")
      }
      onChange({ productImageUrls: data.productImageUrls.filter((_, i) => i !== index) })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to remove product image.")
    } finally {
      setRemovingUrl(null)
    }
  }

  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Your business logo</h2>
        <p className="text-sm text-gray-600">This appears in your store header and on invoices.</p>
        
        {data.logoUrl ? (
          <div className="flex items-end gap-4">
            <img
              src={data.logoUrl}
              alt="Business logo"
              className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange({ logoUrl: "" })}
              size="sm"
            >
              Change
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-6 py-8 text-center hover:border-gray-400 cursor-pointer transition-colors">
            <Upload aria-hidden="true" className="mb-2 size-6 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Upload your logo</p>
            <p className="mt-1 text-xs text-gray-500">PNG, JPG, WebP, or SVG · Up to 2MB</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={(event) => void handleUpload(event, "logo")}
              disabled={uploading === "logo"}
              className="hidden"
            />
          </label>
        )}
      </div>

      <div className="space-y-4 border-t border-gray-100 pt-6">
        <h2 className="text-base font-semibold">Product photos</h2>
        <p className="text-sm text-gray-600">Show customers what you sell. You can add more later.</p>
        
        <div className="space-y-3">
          {data.productImageUrls.map((url, index) => (
            <div key={url} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <img src={url} alt={`Product ${index + 1}`} className="h-12 w-12 rounded object-cover" />
              <button
                type="button"
                onClick={() => removeProductImage(index)}
                disabled={uploading === "products" || removingUrl !== null}
                aria-label={`Remove product image ${index + 1}`}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          ))}
        </div>

        {data.productImageUrls.length < 10 && (
          <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-6 text-center hover:border-gray-400 cursor-pointer transition-colors">
            <Upload aria-hidden="true" className="mb-2 size-5 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Add a product photo</p>
            <p className="mt-0.5 text-xs text-gray-500">PNG, JPG, WebP, or SVG · Up to 5MB each</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              multiple
              onChange={(event) => void handleUpload(event, "products")}
              disabled={uploading === "products"}
              className="hidden"
            />
          </label>
        )}
      </div>

      {uploadError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {uploadError}
        </p>
      )}
    </div>
  )
}
