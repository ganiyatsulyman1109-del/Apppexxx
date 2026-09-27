"use client"

import { Upload, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { StepProps } from "@/components/onboarding/onboarding-wizard"

export function StepUpload({ data, onChange }: StepProps) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState("")

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>, type: "logo" | "products") {
    const files = event.currentTarget.files
    if (!files) return

    setUploadError("")
    const file = files[0]
    if (!file) return

    const maxSize = type === "logo" ? 5242880 : 10485760
    if (file.size > maxSize) {
      setUploadError(`File is too large. Maximum size is ${maxSize / 1024 / 1024}MB.`)
      return
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
    if (!allowedTypes.includes(file.type)) {
      setUploadError("File type not supported. Use JPEG, PNG, WebP, or SVG.")
      return
    }

    setUploading(type)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const endpoint = type === "logo" ? "/api/upload/logo" : "/api/upload/products"
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      const result = (await response.json()) as { error?: string; url?: string; urls?: string[] }
      if (!response.ok || !result.url && !result.urls) {
        throw new Error(result.error || `Upload failed for ${type}.`)
      }

      if (type === "logo") {
        onChange({ logoUrl: result.url || "" })
      } else {
        onChange({ productImageUrls: [...(data.productImageUrls || []), result.url || ""] })
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Try again.")
    } finally {
      setUploading(null)
      event.currentTarget.value = ""
    }
  }

  function removeProductImage(index: number) {
    onChange({ productImageUrls: data.productImageUrls.filter((_, i) => i !== index) })
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
            <p className="mt-1 text-xs text-gray-500">PNG, JPG, WebP, or SVG · Up to 5MB</p>
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
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
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
            <p className="mt-0.5 text-xs text-gray-500">PNG, JPG, WebP, or SVG · Up to 10MB</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
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
