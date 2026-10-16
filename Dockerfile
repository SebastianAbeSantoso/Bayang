# ShiftGuard: Commercial Shift-Handover Reconciliation Workbench
# Track: Reinvent Commerce | Google Gemma 3-27B-IT on AMD Instinct GPUs
FROM python:3.11-slim

WORKDIR /app

# Zero external pip packages required - runs on Python standard library
COPY server/ ./server/
COPY data/ ./data/
COPY client/ ./client/
COPY prompts/ ./prompts/
COPY .env.example ./.env.example

ENV PORT=8000
ENV HOST=0.0.0.0
EXPOSE 8000

CMD ["python", "server/app.py"]
