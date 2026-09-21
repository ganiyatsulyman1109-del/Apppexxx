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
      let originalContent = content;

      // Find any NextResponse.json({ ...error.message... })
      // We will look for NextResponse.json(...) calls
      const regex = /return\s+NextResponse\.json\(\s*\{([^}]+)\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\s*\)/g;
      
      content = content.replace(regex, (match, objectContent, status) => {
        // Does the object content have .message, .details, .hint, or String(error)?
        if (
          objectContent.includes('.message') || 
          objectContent.includes('.details') || 
          objectContent.includes('.hint') ||
          objectContent.includes('String(error)') ||
          objectContent.includes('details:') ||
          objectContent.includes('hint:')
        ) {
          // It's likely exposing raw error details.
          // Let's find the error variable name. Usually it's `error`, `updateError`, `authError`, etc.
          // Look for words before .message or .details
          const varMatch = objectContent.match(/([a-zA-Z0-9_]+)(?:\?\.|\.)(?:message|details|hint)/);
          let errVar = varMatch ? varMatch[1] : 'error';

          // We don't want to replace if it's already generic, but the if condition prevents that.
          return `console.error(${errVar});\n    return NextResponse.json(\n      { error: 'An internal error occurred. Please try again.' },\n      { status: 500 }\n    )`;
        }
        return match;
      });

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated:', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'app', 'api'));
