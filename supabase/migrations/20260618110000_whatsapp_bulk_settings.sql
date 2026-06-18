ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS whatsapp_bulk_reminder_msg TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_bulk_overdue_msg TEXT;
