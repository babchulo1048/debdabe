# Debdabe · ደብዳቤ

Formal Amharic letters for Ethiopian offices: on your letterhead, with the Ethiopian date and reference number, ready to print in one minute.

## What it does

- **Describe your letter** in one line, in Amharic or English. A trained model picks the letter type and pulls out the facts. Missing facts become fields to fill in.
- **Templates write the text.** Facts are never invented.
- **Letterhead and signer** come from Settings and can be edited for each letter.
- **Reference numbers** are given automatically. An outgoing and incoming **register** keeps every letter on record.
- **English version** of any template letter, without AI. The template's English wording is filled with the same facts. Names, positions and other words are suggested for checking, and each company's corrections are remembered.
- **Print / PDF** and **Word (DOCX)** export.

## Run it locally

You need Node.js 22 and npm.

```sh
npm install
npm run dev
```

Without Supabase keys the app runs in **mock mode**: data stays in the browser, and there's a demo account.

To use a real database, create `.env` (it is not committed):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
VITE_DEMO_PASSWORD=          # optional: shows the "Use demo account" button
VITE_MODEL_URL=              # optional: default address of the letter model
```

Only use the **publishable** key. Never put the secret key in the app.

## Database

All SQL is in `supabase/`. See [`supabase/README.md`](supabase/README.md) for the setup steps and the order to run the files.

## Checks

```sh
npm test            # unit tests
npx tsc --noEmit    # type check
npm run build       # production build (Vercel)
```

## Deploy

The app is deployed on Vercel from the `main` branch. Set the `VITE_*` variables above in the Vercel project settings, then redeploy.
