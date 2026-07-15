import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// "Stay logged in" support. Supabase persists the session in whatever storage
// its `auth.storage` adapter uses. We route each read/write to localStorage
// (persists across browser restarts — the default) or sessionStorage (cleared
// when the tab closes — for shared machines), based on a flag the login screen
// sets via `setStayLoggedIn()` before calling signInWithPassword.
const REMEMBER_FLAG = 'wpa-stay-logged-in'

export function setStayLoggedIn(value: boolean) {
  try {
    localStorage.setItem(REMEMBER_FLAG, value ? '1' : '0')
  } catch {
    /* storage unavailable (private mode) — fall through to defaults */
  }
}

function usePersistent(): boolean {
  try {
    // Default to persistent (matches Supabase's out-of-the-box behavior).
    return localStorage.getItem(REMEMBER_FLAG) !== '0'
  } catch {
    return true
  }
}

// Storage adapter that dispatches to local- or sessionStorage per the flag.
// Writes go to the chosen store and clear the other, so a session never lingers
// in both places after the user changes their choice.
const stayAwareStorage = {
  getItem: (key: string): string | null => {
    try {
      return (usePersistent() ? localStorage : sessionStorage).getItem(key)
        ?? sessionStorage.getItem(key)
        ?? localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      const [write, clear] = usePersistent()
        ? [localStorage, sessionStorage]
        : [sessionStorage, localStorage]
      write.setItem(key, value)
      clear.removeItem(key)
    } catch {
      /* ignore */
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}

export const supabase = createClient<Database, 'wpa'>(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'wpa' },
  auth: {
    storage: stayAwareStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})
