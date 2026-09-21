const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const friendlyErr = "err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.')";
const friendlyError = "error instanceof Error ? (error.message?.includes('duplicate') ? 'This record already exists' : error.message?.includes('not found') ? 'Record not found' : error.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.')";

walk('components').forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  let original = c;

  c = c.replace(/description:\s*err\.message/g, `description: ${friendlyErr} : "An error occurred"`);
  c = c.replace(/description:\s*error\.message/g, `description: ${friendlyError} : "An error occurred"`);

  // Handle setError(error instanceof Error ? error.message : "something")
  c = c.replace(/setError\(error instanceof Error \? error\.message : [^)]+\)/g, `setError(${friendlyError} : "An error occurred")`);
  c = c.replace(/setError\(err instanceof Error \? err\.message : [^)]+\)/g, `setError(${friendlyErr} : "An error occurred")`);

  // Handle error.message directly in JSX or templates
  // Just replacing common patterns
  c = c.replace(/\{\s*error\.message\s*\}/g, `{${friendlyError} : "An error occurred"}`);
  c = c.replace(/\{\s*err\.message\s*\}/g, `{${friendlyErr} : "An error occurred"}`);

  if (c !== original) {
    fs.writeFileSync(f, c);
    console.log('Updated', f);
  }
});
