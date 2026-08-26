# Lange Enquiry Backend Setup

This website now includes a premium trade enquiry form with:
- database storage
- reference numbers
- optional file upload
- secure Row Level Security policies

## Setup
1. Create a free Supabase project at https://supabase.com
2. Open SQL Editor and run `supabase/schema.sql`
3. Go to Project Settings → API
4. Copy the Project URL and anon public key
5. Open `script.js`
6. Replace:
   - YOUR_SUPABASE_URL
   - YOUR_SUPABASE_ANON_KEY
7. Upload the updated files to GitHub.

Important: never place a Supabase service-role key in GitHub or browser JavaScript. Use only the anon public key.
