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
    "/joebek-logo.png",
    "/joebek-logo.jpg",
    "/joebek-logo.jpeg",
    "/placeholder-logo.png",
    "/placeholder-logo.svg",
  ].filter((value): value is string => Boolean(value))

  return (
    <div className={cn("relative overflow-hidden", className)} style={{ width: size, height: size }}>
      <Image
        src={sources[srcIndex]}
        alt="JOEBEK AUTO-MART logo"
        fill
        sizes={`${size}px`}
        priority={priority}
        onError={() => setSrcIndex((current) => (current < sources.length - 1 ? current + 1 : current))}
        className={cn("object-contain", imageClassName)}
      />
    </div>
  )
}
