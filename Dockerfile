FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PMBI_HOST=0.0.0.0 \
    PMBI_PORT=8080

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY frontend ./frontend
COPY deploy ./deploy
COPY *.md ./

RUN mkdir -p /app/data

EXPOSE 8080

CMD ["python", "backend/server.py"]
