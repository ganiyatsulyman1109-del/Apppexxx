const fs = require('fs');

const files = [
  'app/api/investors/payments/route.ts',
  'app/api/investors/route.ts',
  'app/api/investors/[id]/returns/route.ts',
  'app/api/investors/[id]/route.ts',
  'app/api/investors/[id]/status/route.ts',
  'app/api/orders/customer/route.ts',
  'app/api/orders/my-orders/route.ts',
  'app/api/orders/[id]/route.ts'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  
  // Add import if not exists
  if (!c.includes('createAdminClient')) {
    c = c.replace(/import \{([^}]+)\} from ['"]@\/lib\/utils\/supabase['"]/g, (match, p1) => {
      if (p1.includes('createAdminClient')) return match;
      return `import {${p1}, createAdminClient} from '@/lib/utils/supabase'`;
    });
  }

  // Replace usage
  c = c.replace(/createServerClient\(\)/g, 'createAdminClient()');
  
  fs.writeFileSync(f, c);
  console.log('Updated', f);
});
