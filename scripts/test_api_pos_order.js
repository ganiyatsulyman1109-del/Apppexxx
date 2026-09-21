const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, "../.env.local")
    const envContent = fs.readFileSync(envPath, "utf8")
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) return
      const idx = trimmed.indexOf("=")
      if (idx === -1) return
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim()
      if (key) process.env[key] = value
    })
  } catch {}
}

async function main() {
  loadEnv()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, staff_id, full_name, email")
    .limit(1)
    .single()

  if (staffError || !staff) {
    throw new Error(`No staff found: ${staffError?.message || "unknown error"}`)
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, stock")
    .gt("stock", 0)
    .limit(1)
    .single()

  if (productError || !product) {
    throw new Error(`No in-stock product found: ${productError?.message || "unknown error"}`)
  }

  const staffSession = {
    id: staff.id,
    staff_id: staff.staff_id,
    full_name: staff.full_name,
    email: staff.email,
    role: "staff",
  }

  const cookieHeader = `staff-session=${JSON.stringify(staffSession)}`

  const payload = {
    source: "pos",
    staff_id: staff.id,
    items: [
      {
        product_id: product.id,
        quantity: 1,
        unit_price: 100,
        name: product.name,
      },
    ],
    subtotal: 100,
    discount: 0,
    tax: 0,
    total: 100,
    payment_method: "cash",
    notes: "API test order",
  }

  const res = await fetch(`${siteUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify(payload),
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    console.error("API response:", res.status, json)
    process.exit(1)
  }

  const orderId = json?.order?.id
  const orderNumber = json?.order?.order_number

  console.log("API order created:", { orderId, orderNumber })

  if (orderId) {
    await supabase.from("orders").delete().eq("id", orderId)
    await supabase.from("products").update({ stock: product.stock }).eq("id", product.id)
    console.log("Cleaned up test order and restored stock.")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
