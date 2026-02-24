FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock* ./
RUN yarn install --frozen-lockfile 2>/dev/null || yarn install
COPY frontend/ ./
RUN REACT_APP_BACKEND_URL="" yarn build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/build /app/frontend/build

COPY nginx.conf /etc/nginx/sites-available/default

RUN mkdir -p /app/backend/uploads/documents /app/backend/uploads/logos /app/backend/uploads/fines

EXPOSE 8080

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
