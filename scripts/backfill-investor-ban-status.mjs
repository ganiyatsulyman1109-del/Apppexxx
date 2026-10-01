import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const apply = process.argv.includes("--apply")

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
let offset = 0
let activeBans = 0
let failures = 0
const pageSize = 500

while (true) {
  const { data: investors, error } = await supabase
    .from("investors")
    .select("id,user_id,is_banned")
    .order("id")
    .range(offset, offset + pageSize - 1)

  if (error) {
    console.error("Could not read investor migration batch:", error.message)
    process.exit(1)
  }
  if (!investors?.length) break

  for (const investor of investors) {
    if (!investor.user_id) {
      failures += 1
      continue
    }
    const { data, error: userError } = await supabase.auth.admin.getUserById(investor.user_id)
    if (userError || !data.user) {
      failures += 1
      continue
    }
    const bannedUntil = data.user.banned_until ? Date.parse(data.user.banned_until) : Number.NaN
    const isBanned = Number.isFinite(bannedUntil) && bannedUntil > Date.now()
    if (!isBanned || investor.is_banned) continue

    if (apply) {
      const { data: updated, error: updateError } = await supabase
        .from("investors")
        .update({ is_banned: true })
        .eq("id", investor.id)
        .eq("user_id", investor.user_id)
        .eq("is_banned", false)
        .select("id")
        .maybeSingle()
      if (updateError || !updated) {
        failures += 1
        continue
      }
    }
    activeBans += 1
  }

  if (investors.length < pageSize) break
  offset += pageSize
}

console.log(`${apply ? "Updated" : "Would update"} ${activeBans} investor ban statuses; ${failures} records need manual review.`)
if (!apply) console.log("Run with --apply after reviewing the count to persist the statuses.")
if (failures > 0) process.exitCode = 2
