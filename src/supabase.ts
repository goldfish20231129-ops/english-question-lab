import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
export const cloudConfigured = /^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl) && supabasePublishableKey.length > 20

export const supabase = cloudConfigured ? createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'english-question-lab-auth-v1',
  },
}) : null
