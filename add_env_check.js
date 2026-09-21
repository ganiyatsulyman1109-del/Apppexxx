const fs = require('fs');

const check = `
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }
`;

const files = [
  'app/api/analytics/customers/route.ts',
  'app/api/analytics/dashboard/route.ts',
  'app/api/analytics/revenue/route.ts',
  'app/api/settings/route.ts',
  'app/api/payments/verify/route.ts',
  'app/api/cron/daily-investor-returns/route.ts'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (!c.includes('Database service not configured')) {
    c = c.replace(/try \{/g, 'try {' + check);
    fs.writeFileSync(f, c);
    console.log('Updated', f);
  }
});
