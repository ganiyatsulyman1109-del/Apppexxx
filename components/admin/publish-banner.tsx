"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { useBusinessConfig } from "@/components/providers/business-provider"
import { toast } from "@/hooks/use-toast"

export function PublishBanner() {
  const { business, refetch } = useBusinessConfig()
  const [isPublishing, setIsPublishing] = useState(false)

  if (!business || business.is_published !== false) {
    return null
  }

  const previewUrl = business.slug ? `/store/${business.slug}?preview=true` : "/store?preview=true"

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      const response = await fetch(`/api/businesses/${business.id}/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to publish store")
      }

      toast({
        title: "Your store is live! 🎉",
        description: data?.message || "Your store is now live.",
      })
      await refetch()
    } catch (error) {
      toast({
        title: "Unable to publish store",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-[rgba(37,99,235,0.2)] bg-[#eff6ff] px-6 py-3">
      <div>
        <p className="text-sm font-semibold text-[#1d4ed8]">🚀 Your store is not live yet</p>
        <p className="mt-0.5 text-xs text-[#6b7280]">
          Publish to get your store link and start receiving customers
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
          className="rounded-md border border-[#93c5fd] bg-white px-3 py-2 text-sm font-medium text-[#1d4ed8] transition hover:bg-[#f8fbff]"
        >
          Preview Store
        </button>

        <button
          type="button"
          onClick={handlePublish}
          disabled={isPublishing}
          className="flex items-center gap-2 rounded-md bg-[#2563eb] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPublishing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Publishing...
            </>
          ) : (
            "Publish Now"
          )}
        </button>
      </div>
    </div>
  )
}
