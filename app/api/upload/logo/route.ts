import { NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { createAdminClient } from "@/lib/utils/supabase"

export const dynamic = "force-dynamic"
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 120)
}

const allowedExtensions: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/svg+xml": ["svg"],
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminAuth()
    const businessId = auth.businessId
    if (!businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const maxSize = 2097152
    if (file.size > maxSize) {
      return NextResponse.json({ error: "Logo must be 2MB or smaller." }, { status: 413 })
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || ""
    if (!allowedExtensions[file.type]?.includes(extension)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const sanitized = sanitizeFilename(file.name.replace(/\.[^/.]+$/, ""))
    const filename = `${businessId}/logos/${Date.now()}_${sanitized}.${extension}`
    const buffer = await file.arrayBuffer()

    const { data, error } = await supabase.storage.from("business-assets").upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
    })

    if (error) {
      console.error("Logo upload failed:", error)
      return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage.from("business-assets").getPublicUrl(data.path)
    const url = publicUrlData.publicUrl

    return NextResponse.json({ success: true, url })
  } catch (error) {
    if (error instanceof Response) {
      return NextResponse.json(
        { error: await error.json().then((body) => body.error).catch(() => "Not authorized.") },
        { status: error.status }
      )
    }

    console.error("Logo upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
