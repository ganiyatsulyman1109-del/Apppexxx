const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('route.ts')) {
      const content = fs.readFileSync(file, 'utf8');
      if (!content.includes('try {')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('app/api');
console.log(files.join('\n'));
