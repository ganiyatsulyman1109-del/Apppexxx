import { NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth"
import { generateText } from "@/lib/gemini"

export async function POST(request: Request) {
  try {
    await requireAdminAuth()
    const body: unknown = await request.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
    }

    const payload = body as Record<string, unknown>
    const businessName = typeof payload.businessName === "string" ? payload.businessName.trim() : ""
    if (!businessName) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 })
    }
    if (businessName.length > 160) {
      return NextResponse.json({ error: "Business name is too long" }, { status: 400 })
    }

    const category = typeof payload.category === "string" ? payload.category.trim() : ""
    const city = typeof payload.city === "string" ? payload.city.trim() : ""
    const personality = typeof payload.personality === "string" ? payload.personality.trim() : ""
    const tagline = typeof payload.tagline === "string" ? payload.tagline.trim() : ""
    const prompt = `Write a short, genuine "About Us" section for a business website.

Business name: ${businessName}
What they sell: ${category}
${city ? `Location: ${city}\n` : ""}${tagline ? `Their tagline: ${tagline}\n` : ""}Personality/vibe: ${personality}

Write 2-3 sentences that sound human and authentic. No corporate jargon. No clichés like "passionate about" or "committed to excellence". Sound like a real business owner wrote it. Write in third person (e.g. "Lagos Fresh Fashion is...").`

    const about = (await generateText(prompt, 150)).trim()
    if (!about) throw new Error("Gemini returned an empty About section")
    return NextResponse.json({ success: true, about })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("POST /api/ai/generate-about failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate About section" },
      { status: 500 }
    )
  }
}
