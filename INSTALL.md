# Install Debdabe on a company's server (free pilot, testing)

The app and the model run on the company's server. Data stays on our cloud Supabase, so **the server needs internet**.

## 1. On your laptop: build the app
- In `.env`, **remove** `VITE_DEMO_PASSWORD`. Then add `VITE_MODEL_URL=http://<server-ip>:7860`.
- Run `NITRO_PRESET=node-server npm run build`. This makes the `.output/` folder.
- Or clone the repo on the server and build there. `model-server/` comes with it.
- Put `.env` back the way it was afterwards, because Vercel builds use their own settings.

## 2. On their server: the app
- Install **Node 22**, then `npm i -g pm2`.
- Run:
  ```bash
  PORT=3000 pm2 start .output/server/index.mjs --name debdabe
  pm2 save && pm2 startup
  ```
- Staff open `http://<server-ip>:3000`.

## 3. On their server: the model
- Install **Docker**. Needs: ~2 GB free RAM, ~3 GB disk.
- Follow `model-server/README.md`: download `model_round1` from Google Drive, then `docker build`, then `docker run`.
- Check: `http://<server-ip>:7860/health` shows `"status": "ok"`.
- After retraining in Colab: swap in the new `model_roundN` folder and run again. No rebuild is needed.

## 4. In Supabase (SQL editor)
- They sign up in the app, which creates their organisation.
- Give them unlimited letters (Basic stops at 30 a month):
  ```sql
  update organizations set plan = 'unlimited' where name_en = '<company>';
  ```

## Notes
- The payment feature isn't used. Don't set `VERIFYMELA_*` on their server.
- If the model is down, "Describe your letter" falls back to the v0 rules. The templates still work.
- See the model's request log (useful pilot data): `http://<server-ip>:7860/log?key=<LOG_KEY>`
