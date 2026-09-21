"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
  size?: number
  className?: string
  imageClassName?: string
  priority?: boolean
  src?: string
}

export function BrandLogo({ size = 40, className, imageClassName, priority = false, src }: BrandLogoProps) {
  const [srcIndex, setSrcIndex] = useState(0)
  const sources = [
    src,
    process.env.NEXT_PUBLIC_BRAND_LOGO,
    "/apex-logo.png",
    "/apex-logo.jpg",
    "/apex-logo.jpeg",
    "/placeholder-logo.png",
    "/placeholder-logo.svg",
  ].filter((value): value is string => Boolean(value))
  const [hasImageError, setHasImageError] = useState(false)

  const currentSrc = sources[srcIndex]

  return (
    <div className={cn("relative overflow-hidden", className)} style={{ width: size, height: size }}>
      {currentSrc && !hasImageError ? (
        <Image
          src={currentSrc}
          alt="Apex Enterprise logo"
          fill
          sizes={`${size}px`}
          priority={priority}
          onError={() => {
            if (srcIndex < sources.length - 1) {
              setSrcIndex((current) => current + 1)
            } else {
              setHasImageError(true)
            }
          }}
          className={cn("object-contain", imageClassName)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#2563EB] text-white text-base font-bold leading-none">
          AE
        </div>
      )}
    </div>
  )
}
