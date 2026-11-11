FROM python:3.11-slim

WORKDIR /app

# Python environment settings for unbuffered stdout
ENV PYTHONUNBUFFERED=1
ENV PORT=3000

# Install dependencies (if any added)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

EXPOSE 3000

CMD ["python", "server.py"]

