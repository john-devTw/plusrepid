const REPID_CONFIG = {
  SUPABASE_URL: 'https://euattpparszwowwkwesg.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1YXR0cHBhcnN6d293d2t3ZXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzc1ODYsImV4cCI6MjA4Mjk1MzU4Nn0.TCROmxve4b_zXxvVaKfhH2WjR45yAg38FfXxUSOgYdE'
};

if (typeof window !== 'undefined') {
  window.REPID_CONFIG = REPID_CONFIG;
}
if (typeof self !== 'undefined') {
  self.REPID_CONFIG = REPID_CONFIG;
}