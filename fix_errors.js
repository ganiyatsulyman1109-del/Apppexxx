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
  let changed = false;

  if (c.includes('setError(err.message)') || c.includes('setError(error.message)') || c.includes('setError(err.message ||') || c.includes('setError(error.message ||')) {
    // Only simple replacements first
    c = c.replace(/setError\(err\.message\)/g, `setError(${friendlyErr})`);
    c = c.replace(/setError\(error\.message\)/g, `setError(${friendlyError})`);
    c = c.replace(/setError\(err\.message\s*\|\|\s*['"]([^'"]+)['"]\)/g, `setError(${friendlyErr} : '$1')`);
    c = c.replace(/setError\(error\.message\s*\|\|\s*['"]([^'"]+)['"]\)/g, `setError(${friendlyError} : '$1')`);
    
    fs.writeFileSync(f, c);
    console.log('Updated', f);
  }
});
