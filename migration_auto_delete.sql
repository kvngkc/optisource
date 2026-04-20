-- NOTE: This script utilizes pg_cron which is natively supported on most Supabase instances!
-- It creates a recurring job that deletes old chat attachments directly out of physical storage.

-- 1. Ensure the pg_cron extension is enabled 
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. If you want to modify or completely drop the job later, call this:
-- SELECT cron.unschedule('purge-90-day-old-order-attachments');

-- 3. Schedule the Cron Job to run every night at 3:00 AM ('0 3 * * *')
SELECT cron.schedule(
    'purge-90-day-old-order-attachments',
    '0 3 * * *',
    $$
      DELETE FROM storage.objects 
      WHERE bucket_id = 'order-attachments' 
      AND created_at < NOW() - INTERVAL '90 days';
    $$
);

-- SUCCESS: The job is instantly scheduled in the background.
