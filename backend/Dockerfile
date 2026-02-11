# Dockerfile for Phase 2 (ECS Fargate)
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./

# Expose port
EXPOSE 8000

# Run with uvicorn (not Mangum for ECS)
CMD ["uvicorn", "handlers.api_handler:app", "--host", "0.0.0.0", "--port", "8000"]
