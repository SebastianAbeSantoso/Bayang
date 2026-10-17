# ShiftGuard: Commercial Shift-Handover Reconciliation Workbench
# Track: Reinvent Commerce | Google Gemma 3-27B-IT via AMD Token Factory
FROM python:3.11-slim

# Hugging Face Spaces runs containers as non-root UID 1000
RUN useradd -m -u 1000 user
WORKDIR /app

# Zero external pip packages required - runs on Python standard library
COPY --chown=user:user server/ ./server/
COPY --chown=user:user data/ ./data/
COPY --chown=user:user client/ ./client/
COPY --chown=user:user prompts/ ./prompts/
COPY --chown=user:user .env.example ./.env.example

USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PORT=7860 \
    HOST=0.0.0.0

EXPOSE 7860

CMD ["python", "server/app.py"]
