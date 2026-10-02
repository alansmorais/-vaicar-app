# ==========================================
# VAICAR PLATFORM — PRODUCTION DOCKERFILE
# Optimized for Google Cloud Run (Port 8080)
# ==========================================

# Stage 1: Build Frontend and API
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend assets, public uploads, and server source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/api ./api
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/index.html ./index.html

# Expose Google Cloud Run default port
EXPOSE 8080

# Start unified API + Web server
CMD ["npm", "start"]
