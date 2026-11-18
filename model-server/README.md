# Debdabe model server

Runs the trained model on a normal CPU (no GPU) for the app. The model files are **not** in git (~1 GB).
These code files are copies from `business_consultant/model/`. Copy them again if you change them there.

## Run
1. Download the model folder **on the server** from the Google Drive folder Eyoel shared
   (`Debdabe/model_round1`, it has `intent/` and `facts/`). Put it here as `model-server/model_round1/`.
   - With a screen: open Drive in the browser, right-click the folder, choose Download, and unzip it here.
   - Without a screen: `pip install gdown` then `gdown --folder <drive-link>`. The folder must be shared
     as "Anyone with the link"; turn that off afterwards.
2. `docker build -t debdabe-model .`
3. ```bash
   docker run -d --restart always --name debdabe-model -p 7860:7860 \
     -v "$(pwd)/model_round1:/model" -e MODEL_DIR=/model -e MODEL_NAME=round1 \
     -e LOG_KEY=<secret> debdabe-model
   ```
4. Check `http://<server-ip>:7860/health`, which should show `"status": "ok"`.

## New model after retraining in Colab
1. Download the new `model_roundN` folder from Drive into `model-server/`.
2. `docker rm -f debdabe-model`
3. Run step 3 again with `model_roundN` and `MODEL_NAME=roundN`. No rebuild is needed.
