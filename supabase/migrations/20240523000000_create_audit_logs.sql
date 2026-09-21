CREATE TABLE IF NOT EXISTS audit_logs ( 
   id uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
   action_type text NOT NULL, 
   entity_type text NOT NULL, 
   entity_id text, 
   performed_by uuid, 
   performed_by_role text, 
   before_data jsonb, 
   after_data jsonb, 
   metadata jsonb, 
   notes text, 
   created_at timestamptz DEFAULT now() NOT NULL 
 ); 
 CREATE INDEX IF NOT EXISTS audit_logs_entity_idx 
   ON audit_logs(entity_type, entity_id); 
 CREATE INDEX IF NOT EXISTS audit_logs_created_idx 
   ON audit_logs(created_at DESC);
