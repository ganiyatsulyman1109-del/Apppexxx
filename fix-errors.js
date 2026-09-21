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
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('components');

let count = 0;
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  let original = c;

  c = c.replace(/setError\(\s*(err|error)\.message\s*\)/g, 
    "setError($1.message?.includes('duplicate') ? 'This record already exists' : $1.message?.includes('not found') ? 'Record not found' : $1.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.')");
    
  c = c.replace(/setError\(\s*(err|error)\s+instanceof\s+Error\s*\?\s*\1\.message\s*:\s*([^)]+)\)/g, 
    "setError($1 instanceof Error ? ($1.message?.includes('duplicate') ? 'This record already exists' : $1.message?.includes('not found') ? 'Record not found' : $1.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : $2)");

  c = c.replace(/alert\(\s*(err|error)\s+instanceof\s+Error\s*\?\s*\1\.message\s*:\s*([^)]+)\)/g, 
    "alert($1 instanceof Error ? ($1.message?.includes('duplicate') ? 'This record already exists' : $1.message?.includes('not found') ? 'Record not found' : $1.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : $2)");

  if (c !== original) {
    fs.writeFileSync(f, c);
    count++;
  }
});

console.log('Fixed errors in ' + count + ' files');
