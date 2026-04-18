import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    'https://wjvxsdnbpidjduvppqnu.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdnhzZG5icGlkamR1dnBwcW51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDQwOTcsImV4cCI6MjA5MjAyMDA5N30.xYElZNXwo2u9JMPJZ07YYeuOxkS9y76Yf2pZkLyFO44'
  )
}

