"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
  logoUrl?: string | null
  businessName?: string
  size?: number
  className?: string
  imageClassName?: string
  priority?: boolean
}

export function BrandLogo({
  logoUrl,
  businessName = "Apex Enterprise",
  size = 40,
  className,
  imageClassName,
}: BrandLogoProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)

  const initials = businessName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "A"
  const validLogoUrl = logoUrl && /^https?:\/\//i.test(logoUrl) ? logoUrl : null

  return (
    <span className={cn("relative inline-flex overflow-hidden", className)} style={{ width: size, height: size }}>
      {validLogoUrl && failedLogoUrl !== validLogoUrl ? (
        <img
          src={validLogoUrl}
          alt={`${businessName} logo`}
          width={size}
          height={size}
          onError={() => setFailedLogoUrl(validLogoUrl)}
          className={cn("h-full w-full rounded-lg object-cover", imageClassName)}
        />
      ) : (
        <svg
          role="img"
          aria-label={`${businessName} mark`}
          viewBox="0 0 100 100"
          width={size}
          height={size}
          className="h-full w-full rounded-[10px]"
        >
          <rect width="100" height="100" rx="18" fill="#2563EB" />
          <text x="50" y="54" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="40" fontWeight="700">
            {initials}
          </text>
        </svg>
      )}
    </span>
  )
}
