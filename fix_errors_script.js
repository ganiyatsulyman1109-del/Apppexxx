const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Regex to find return NextResponse.json({ error: error.message... or error: error?.message...
      // and replace it. But we need to handle the whole object and also prepend console.error(error) if it's not there.
      // A more robust approach is to look for object literals containing error.message etc inside NextResponse.json
      
      // Let's use a simpler regex for the common patterns:
      // Pattern 1: return NextResponse.json({ error: error.message }, { status: 400 })
      const regex1 = /return\s+NextResponse\.json\(\s*\{\s*error:\s*(?:error|e|authError|updateError|insertError|fetchError|banError|passwordError|roleError|investorError|userCreationError|productError|logError|customerError|staffError|paystackData|paystackData\?.message|error\?.message|error\.message)(?:\s*\|\|\s*[^,]+)?(?:,\s*details:[^}]+)?(?:,\s*hint:[^}]+)?\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\s*\)/g;
      
      content = content.replace(regex1, (match, status) => {
        changed = true;
        // Check if there is already a console.error just before this
        return `console.error(error);\n    return NextResponse.json(\n      { error: 'An internal error occurred. Please try again.' },\n      { status: 500 }\n    )`;
      });

      // There are some variations like:
      // return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 })
      // The regex above handles optional details and hint.

      // What if the error variable is named differently, like updateError? The regex covers some. Let's broaden it.
      const regex2 = /return\s+NextResponse\.json\(\s*\{\s*error:\s*[a-zA-Z0-9_\?\.]+(?:\s*\|\|\s*[^,]+)?(?:,\s*details:[^}]+)?(?:,\s*hint:[^}]+)?\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\s*\)/g;
      
      content = content.replace(regex2, (match, status) => {
        // Only replace if it contains .message or .details or .hint
        if (match.includes('.message') || match.includes('.details') || match.includes('.hint') || match.includes('details:') || match.includes('hint:')) {
            changed = true;
            // extract the variable name if possible, or just use 'error'
            const varMatch = match.match(/error:\s*([a-zA-Z0-9_]+)\.?/);
            const varName = varMatch ? varMatch[1] : 'error';
            return `console.error(${varName});\n    return NextResponse.json(\n      { error: 'An internal error occurred. Please try again.' },\n      { status: 500 }\n    )`;
        }
        return match;
      });

      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated:', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'app', 'api'));
