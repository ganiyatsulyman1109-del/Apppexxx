const { createAdminSupabaseClient } = require('./lib/utils/supabase');

async function fixStaffIds() {
  const supabase = createAdminSupabaseClient();
  
  // This is a direct SQL execution via RPC or raw query if available.
  // Since we might not have a direct SQL execution function exposed easily,
  // we can iterate and update, or try to call a stored procedure if one exists.
  // However, the prompt provided a SQL query. 
  // Let's try to execute it using a custom RPC if available, or just iterate and update in Node.js
  // Iterating is safer if we don't know the RPC capabilities.
  
  console.log('Fetching staff...');
  const { data: staff, error } = await supabase
    .from('staff')
    .select('id, staff_id');
    
  if (error) {
    console.error('Error fetching staff:', error);
    return;
  }
  
  console.log(`Found ${staff.length} staff members.`);
  
  for (const s of staff) {
    if (s.staff_id && s.staff_id.startsWith('STAFF')) {
      const match = s.staff_id.match(/STAFF(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        const newStaffId = `STAFF${num.toString().padStart(3, '0')}`;
        
        if (newStaffId !== s.staff_id) {
          console.log(`Updating ${s.staff_id} to ${newStaffId}`);
          const { error: updateError } = await supabase
            .from('staff')
            .update({ staff_id: newStaffId })
            .eq('id', s.id);
            
          if (updateError) {
            console.error(`Failed to update ${s.staff_id}:`, updateError);
          }
        }
      }
    }
  }
  
  console.log('Staff ID fix complete.');
}

// Since we can't easily run this script without proper environment setup (imports etc),
// We will create a SQL migration file instead which is more reliable for the user's codebase pattern.
