const fs = require('fs');
const path = require('path');

function walk(dir) {
  let r = [];
  if (!fs.existsSync(dir)) return r;
  fs.readdirSync(dir).forEach(f => {
    f = path.join(dir, f);
    if (fs.statSync(f).isDirectory()) r = r.concat(walk(f));
    else if (f.endsWith('route.ts')) r.push(f);
  });
  return r;
}

const checkBlockRegex = /\s*if \(!process\.env\.SUPABASE_SERVICE_ROLE_KEY\) \{\s*return NextResponse\.json\(\s*\{ error: 'Database service not configured' \},\s*\{ status: 500 \}\s*\)\s*\}/g;

const checkString = `
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }`;

walk('app/api').forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  let original = c;
  
  c = c.replace(checkBlockRegex, ''); // Remove existing ones completely

  // Add back if the file uses createAdminSupabaseClient
  if (c.includes('createAdminSupabaseClient')) {
    // Only payment routes and admin routes (we consider everything in api/ except auth/account)
    const normalizedPath = f.replace(/\\/g, '/');
    if (!normalizedPath.includes('api/auth') && !normalizedPath.includes('api/account')) {
      c = c.replace(/(export async function (?:GET|POST|PUT|PATCH|DELETE)[^{]*\{[\s\S]*?try\s*\{)/g, '$1' + checkString);
    }
  }

  if (c !== original) {
    fs.writeFileSync(f, c);
    console.log('Fixed properly', f);
  }
});
