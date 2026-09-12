import { createClient } from '@supabase/supabase-js'

// These come from a .env file (see .env.example) — never hardcode real
// keys directly in this file, especially since this repo is on GitHub.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// The exact placeholder text from .env.example. If .env still has these
// (e.g. someone ran `cp .env.example .env` but never filled it in), treat
// it the same as not being configured at all, instead of trying — and
// failing — to actually reach a fake URL.
const PLACEHOLDER_URL = 'https://your-project-id.supabase.co'
const PLACEHOLDER_KEY = 'your-anon-public-key'

// True once someone (probably your backend teammate) has actually created
// a Supabase project and you've copied its REAL URL + key into .env.
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== PLACEHOLDER_URL &&
  supabaseAnonKey !== PLACEHOLDER_KEY
)

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase isn\'t set up yet — LoginScreen will use fake login so you ' +
    'can keep building. Once your teammate has a project, put the real ' +
    'URL + key in .env; no code changes needed after that.'
  )
}

// Harmless placeholder values so createClient doesn't crash when nothing is
// configured yet. LoginScreen checks isSupabaseConfigured before ever
// actually calling these, so the placeholders are never used for real.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-key'
)
