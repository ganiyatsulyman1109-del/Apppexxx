const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (file === 'route.ts') {
      results.push(filePath);
    }
  });
  return results;
}

const dirsToCheck = [
  'app/api/admin',
  'app/api/easybuy',
  'app/api/investors',
  'app/api/pos',
  'app/api/orders',
  'app/api/staff',
  'app/api/payments'
];

let files = [];
dirsToCheck.forEach(d => {
  files = files.concat(walk(d));
});

const checkStr = `
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }
`;

let count = 0;

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;
  let newContent = content;
  let offset = 0;

  const functionRegex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{/g;
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const startIndex = match.index + match[0].length;
    const nextFunctionIndex = content.indexOf('export async function', startIndex);
    const functionBody = nextFunctionIndex === -1 ? content.substring(startIndex) : content.substring(startIndex, nextFunctionIndex);

    if (functionBody.includes('createAdminSupabaseClient') && !functionBody.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      const tryMatch = functionBody.match(/^\s*try\s*\{/);
      let insertIndex = startIndex + offset;
      if (tryMatch) {
        insertIndex += tryMatch[0].length;
      }

      newContent = newContent.substring(0, insertIndex) + checkStr + newContent.substring(insertIndex);
      offset += checkStr.length;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(f, newContent);
    count++;
  }
});

console.log('Injected SUPABASE_SERVICE_ROLE_KEY check into ' + count + ' files');
