FROM python:3.11-slim

# Hugging Face Spaces run as user 1000
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    PYTHONUNBUFFERED=1
WORKDIR /home/user/app

RUN pip install --no-cache-dir --user torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --user transformers huggingface_hub sentencepiece

COPY --chown=user . .
EXPOSE 7860
CMD ["python", "app.py"]
