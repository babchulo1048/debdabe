# Debdabe on your own Supabase

Follows `~/sarem_projects/OWN_SUPABASE_GUIDE.md`. Without the two keys, the app runs in **mock mode**
(data in the browser only). With them, it uses your Supabase project.

## 1. Create the project
supabase.com → **New project**, in your **personal** organization.
- Name: `debdabe`
- Region: **Central EU (Frankfurt)**
- Plan: Free
- Database password: **Generate** it, then save it.

## 2. Run the SQL (SQL Editor → New query → paste → Run), in this order
| File | What it does | Run |
|---|---|---|
| `migrations/20261106120000_init.sql` | Tables, security rules (RLS), letter numbering, signup, file buckets | once |
| `seed/00_templates.sql` | The 6 built-in letter templates (fixed ids the model uses) | safe to re-run |
| `seed/01_demo.sql` | Demo company "Namuna Trading" with sample letters | once, optional |

Check: `select count(*) from public.templates;` → **6**

## 3. Auth settings
Authentication → Sign In / Providers → Email:
- **Confirm email: OFF** for now. Testers can then sign up and get straight in.
- Minimum password length: 6 or more.

## 4. Keys → app
Project Settings → API Keys: copy the **Project URL** and the **publishable** key
(`sb_publishable_…`). **Never** use the secret key.

Laptop, in `.env`, then restart `bun run dev`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
VITE_DEMO_PASSWORD=          # optional, see step 5
```
On Vercel: Settings → Environment Variables. Add the same names as type **Config**
(not Secret), then go to **Deployments → ⋯ → Redeploy**.

## 5. Demo account (optional)
After `01_demo.sql`, open the app → **Create an account** with email `demo@debdabe.app` and a password
you choose. That account joins the Namuna demo company automatically. Put the same password in
`VITE_DEMO_PASSWORD` (laptop + Vercel) to show the "Use demo account" button.
The password is then visible on the login page, so use it for the demo only.

## Notes
- Every new sign-up gets its **own company**. Companies can't see each other's data (tested).
- Before charging real money: today an office admin can change their own plan on the Billing page.
- Free projects pause after ~1 week without use: Dashboard → **Restore project**.
