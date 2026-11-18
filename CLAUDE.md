# Debdabe (ደብዳቤ): formal Amharic letters

Eyoel Demis's personal product, separate from Altair. A web app for Ethiopian organisations: formal Amharic letters on the company letterhead, with the Ethiopian date, automatic reference numbers, a letter register, and an English version.

## Stack and how it runs
- **App:** TanStack Start, React 19, Tailwind v4, shadcn/ui, TanStack Query, Vite 8. The nitro preset `vercel` is set in `vite.config.ts`. The build config package `@lovable.dev/vite-tanstack-config` is still used; replace it later.
- **Tools:** use **npm/npx** (`npm run dev`, `npm test`, `npx tsc --noEmit`, `npm run build`). **bun is not installed** locally, but Vercel installs with bun (`bun.lock`).
- **Database:** Eyoel's own Supabase project (`bisogmwpyjrxhquteeka`). Keys live in `.env`, which is gitignored. Use the **publishable key only**; never put the secret key in the app.
  - Without keys, the app runs in **mock mode** (localStorage).
  - SQL is in `supabase/` (see `supabase/README.md` for the order to run it). Migrations so far: `init` and `english_letters`. Seeds: `00_templates` (6 built-in templates, fixed ids `…07e1`–`…07e6`) and `01_demo`.
- **Deploy:** GitHub `babchulo1048/debdabe` → Vercel, which deploys automatically on push. **Eyoel commits and pushes himself.** `VITE_*` variables in Vercel are type Config; redeploy after changing them.
- **Demo login:** `demo@debdabe.app`. The password is set in `VITE_DEMO_PASSWORD` and shown on the login page.
- **Model** ("Describe your letter"): our own trained model, round 1 (based on `afro-xlmr-base`; it detects the letter type and pulls out the facts).
  - It lives in the private HF repo `Babchulo/debdabe-model-round1`.
  - It is served from **Google Colab** (`../../model/debdabe_serve.ipynb`, **set `ROUND = 1`**) through a cloudflared tunnel. Open the app with `?model=<tunnel link>`; there's a new link on every restart.
  - If the model is unreachable, the app falls back to the v0 rules.

## Main features (built)
- **Letters:** 6 templates; "Describe your letter" (the model + editable fields); an editable sender per letter (`_sender_*` keys in `field_values`).
- **Records:** reference numbers, an outgoing and incoming register, scans of incoming letters.
- **Output:** Word/PDF export.
- **English version** (no AI):
  - `src/lib/english.ts` and `englishWords.ts`: transliteration, word list, Ethiopian time → normal time, Gregorian dates.
  - `EnglishCheck` panel; the **English button in the editor and the letter page**.
  - Translation memory per company: the `translations` table, with RLS.
- **Tests:** 76 passing (`npm test`). Typecheck clean. Build OK.

## Business status (Nov 2026)
- **Interviews:** companies say writing letters isn't worth paying for; they copy and paste in Word.
- **Records-office pivot** (registry and routing): weak, because offices use Telegram and it works fine for them.
- **Current advantage:** the **automatic English version** of Amharic letters. Interviews this month ask about it: how often they need English letters, and whether they pay for translation today.
- **Decision at the end of November 2026:** continue or stop Debdabe.
- **Business docs** (one folder up): `../../ideas/02_*` (idea, business model, the Fable research files 02c, 02d and 02f). Model reports are in `../../docs/`.

## How to work with Eyoel
- **Short answers:** bullets and small tables, plain simple English. No long documents.
- **Edit only what he names.** Don't restructure. Propose new things in chat first.
- **The model, not rules:** improve understanding with the trained model, not by patching the v0 keyword rules. Don't turn his test sentences into requirements or tests.
- **Check free services first:** before relying on any free tier, check its current terms (a Hugging Face plan change once wasted his time).
- **Show the math** for business questions. Ethiopia first. He decides contested strategy.
- **Before he pushes:** run the type check, the tests and the build, and make sure `.env` stays out of git.
