# AI Hub DataFinder web service.
#   docker build -t aihub-datafinder .
#   docker run -p 8000:8000 -e GEMINI_API_KEY=... aihub-datafinder
# The image holds the code and the ready-made data (search index, dataset records); nothing is collected at start.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    HOST=0.0.0.0 \
    PORT=8000

WORKDIR /app
COPY requirements-app.txt .
RUN pip install --no-cache-dir -r requirements-app.txt

COPY app app
COPY processing processing
COPY config config
COPY data data

# run as a normal user; data/index must stay writable for the query embedding cache
RUN useradd --create-home appuser && chown -R appuser /app/data
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/healthz' % os.environ.get('PORT', '8000'), timeout=4)"
CMD ["python", "-m", "app.server"]
