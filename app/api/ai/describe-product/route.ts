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
    const name = typeof payload.name === "string" ? payload.name.trim() : ""
    if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 })
    if (name.length > 160) return NextResponse.json({ error: "Product name is too long" }, { status: 400 })

    const category = typeof payload.category === "string" ? payload.category.trim() : ""
    const brand = typeof payload.brand === "string" ? payload.brand.trim() : ""
    const businessName = typeof payload.businessName === "string" ? payload.businessName.trim() : ""
    const price = Number(payload.price)
    const priceText = payload.price !== undefined && payload.price !== "" && Number.isFinite(price) && price >= 0
      ? `Price: ₦${price.toLocaleString("en-NG")}\n`
      : ""

    const prompt = `You are helping a small business owner write a product description for their online store.

Product: ${name}
Category: ${category}
${brand ? `Brand: ${brand}\n` : ""}${priceText}${businessName ? `Store: ${businessName}\n` : ""}
Write a compelling, honest product description in 2-3 sentences. Use simple, clear English. Focus on what the product is and who would want it. Do not use excessive superlatives. Do not mention the price. Do not start with "Introducing" or "Discover". Just describe the product naturally.`

    const description = (await generateText(prompt, 200)).trim()
    if (!description) throw new Error("Gemini returned an empty product description")
    return NextResponse.json({ success: true, description })
  } catch (error) {
    if (error instanceof Response) return error
    console.error("POST /api/ai/describe-product failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate product description" },
      { status: 500 }
    )
  }
}
