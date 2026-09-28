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
    const files = [...formData.getAll("files"), ...formData.getAll("file")].filter(
      (value): value is File => typeof value !== "string"
    )
    if (files.length === 0) {
      return NextResponse.json({ error: "At least one image file is required." }, { status: 400 })
    }
    if (files.length > 10) {
      return NextResponse.json({ error: "Upload no more than 10 product images at a time." }, { status: 400 })
    }

    for (const file of files) {
      if (file.size > 5242880) {
        return NextResponse.json({ error: `${file.name} is larger than the 5MB limit.` }, { status: 413 })
      }
      const extension = file.name.split(".").pop()?.toLowerCase() || ""
      if (!allowedExtensions[file.type]?.includes(extension)) {
        return NextResponse.json({ error: `${file.name} is not a supported image type.` }, { status: 400 })
      }
    }

    const supabase = createAdminClient()
    const { data: existingImages, error: listError } = await supabase.storage
      .from("business-assets")
      .list(`${businessId}/products`, { limit: 10 })
    if (listError) {
      console.error("Failed to check product image limit:", listError)
      return NextResponse.json({ error: "Unable to validate product image limit." }, { status: 500 })
    }
    if (existingImages.length + files.length > 10) {
      return NextResponse.json({
        error: `A maximum of 10 product images is allowed. You can add ${Math.max(0, 10 - existingImages.length)} more.`,
      }, { status: 400 })
    }

    const uploadedPaths: string[] = []
    const urls: string[] = []
    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase() || ""
      const sanitized = sanitizeFilename(file.name.replace(/\.[^/.]+$/, "")) || "image"
      const filename = `${businessId}/products/${Date.now()}_${crypto.randomUUID()}_${sanitized}.${extension}`
      const { data, error } = await supabase.storage.from("business-assets").upload(filename, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      })

      if (error) {
        console.error("Product image upload failed:", error)
        if (uploadedPaths.length > 0) {
          const { error: cleanupError } = await supabase.storage.from("business-assets").remove(uploadedPaths)
          if (cleanupError) {
            console.error("Failed to clean up partial product image upload:", cleanupError)
            return NextResponse.json({
              error: "Some images could not be uploaded, and uploaded files could not all be removed.",
              uploadedCount: uploadedPaths.length,
            }, { status: 500 })
          }
        }
        return NextResponse.json({ error: "Product image upload failed; no new images were saved." }, { status: 500 })
      }

      uploadedPaths.push(data.path)
      const { data: publicUrlData } = supabase.storage.from("business-assets").getPublicUrl(data.path)
      urls.push(publicUrlData.publicUrl)
    }

    return NextResponse.json({ success: true, urls, url: urls[0] })
  } catch (error) {
    if (error instanceof Response) {
      return NextResponse.json(
        { error: await error.json().then((body) => body.error).catch(() => "Not authorized.") },
        { status: error.status }
      )
    }

    console.error("Product image upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdminAuth()
    const businessId = auth.businessId
    if (!businessId) {
      return NextResponse.json({ error: "No business associated with account" }, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 })
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object." }, { status: 400 })
    }
    const url = (body as Record<string, unknown>).url
    if (typeof url !== "string") {
      return NextResponse.json({ error: "Image URL is required." }, { status: 400 })
    }

    let imageOrigin: string
    let decodedPath: string
    try {
      const imageUrl = new URL(url)
      imageOrigin = imageUrl.origin
      decodedPath = decodeURIComponent(imageUrl.pathname)
    } catch {
      return NextResponse.json({ error: "Image URL is invalid." }, { status: 400 })
    }

    const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin
    const bucketPrefix = "/storage/v1/object/public/business-assets/"
    const pathParts = decodedPath.startsWith(bucketPrefix)
      ? decodedPath.slice(bucketPrefix.length).split("/")
      : []
    if (
      imageOrigin !== supabaseOrigin ||
      pathParts.length !== 3 ||
      pathParts[0] !== businessId ||
      pathParts[1] !== "products" ||
      !/^[a-zA-Z0-9._-]+$/.test(pathParts[2]) ||
      pathParts[2] === "." ||
      pathParts[2] === ".."
    ) {
      return NextResponse.json({ error: "Image does not belong to this business." }, { status: 403 })
    }

    const storagePath = pathParts.join("/")
    const { error } = await createAdminClient().storage.from("business-assets").remove([storagePath])
    if (error) {
      console.error("Product image removal failed:", error)
      return NextResponse.json({ error: "Unable to remove product image." }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) {
      return NextResponse.json(
        { error: await error.json().then((body) => body.error).catch(() => "Not authorized.") },
        { status: error.status }
      )
    }

    console.error("Product image removal error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
