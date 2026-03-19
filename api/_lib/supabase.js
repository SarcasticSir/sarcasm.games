const { createClient } = require('@supabase/supabase-js');

function getSupabaseUrl() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) environment variable.');
  }
  return url;
}

function getSupabaseAnonKey() {
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('Missing SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) environment variable.');
  }
  return key;
}

function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  }
  return key;
}

function createSupabaseClient(key, options = {}) {
  return createClient(getSupabaseUrl(), key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    ...options
  });
}

function getSupabaseAnonClient() {
  return createSupabaseClient(getSupabaseAnonKey());
}

function getSupabaseAdminClient() {
  return createSupabaseClient(getSupabaseServiceRoleKey());
}

module.exports = {
  getSupabaseAnonClient,
  getSupabaseAdminClient
};
