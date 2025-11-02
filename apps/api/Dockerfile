FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgl1-mesa-dev libglib2.0-0 libstdc++6 libgomp1 poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Layer cache for poetry deps
COPY apps/api/pyproject.toml apps/api/poetry.lock* ./apps/api/
RUN pip install --upgrade pip && pip install "poetry==1.8.3"
WORKDIR /app/apps/api
RUN poetry config virtualenvs.create false
RUN poetry install --no-interaction --no-ansi --no-root --only main

# App source
COPY apps/api /app/apps/api

ENV PORT=8000
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
