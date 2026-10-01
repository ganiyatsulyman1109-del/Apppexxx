import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

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
const pageSize = 500
let offset = 0
let hashed = 0
let invalid = 0
let existing = 0

while (true) {
  const { data: rows, error } = await supabase
    .from("staff")
    .select("id,pin,pin_hash")
    .order("id")
    .range(offset, offset + pageSize - 1)

  if (error) {
    console.error("Could not read staff PIN migration batch:", error.message)
    process.exit(1)
  }
  if (!rows?.length) break

  for (const row of rows) {
    if (typeof row.pin_hash === "string" && /^\$2[aby]\$/.test(row.pin_hash)) {
      existing += 1
      continue
    }
    if (row.pin_hash !== null) {
      invalid += 1
      continue
    }
    if (typeof row.pin !== "string" || !/^\d{6}$/.test(row.pin)) {
      invalid += 1
      continue
    }

    if (apply) {
      const pinHash = await bcrypt.hash(row.pin, 10)
      if (!(await bcrypt.compare(row.pin, pinHash))) {
        console.error(`Hash verification failed for staff record ${row.id}.`)
        process.exit(1)
      }
      const { data: updated, error: updateError } = await supabase
        .from("staff")
        .update({ pin_hash: pinHash })
        .eq("id", row.id)
        .is("pin_hash", null)
        .select("id")
        .maybeSingle()
      if (updateError || !updated) {
        console.error(`Could not safely update staff record ${row.id}: ${updateError?.message || "record changed concurrently"}`)
        process.exit(1)
      }
    }
    hashed += 1
  }

  if (rows.length < pageSize) break
  offset += pageSize
}

console.log(`${apply ? "Updated" : "Would update"} ${hashed} staff PIN hashes; ${existing} already hashed; ${invalid} missing or invalid PINs require a secure reset.`)
if (!apply) console.log("Review this count, then rerun with --apply to write hashes.")
if (invalid > 0) process.exitCode = 2
