# --- Stage 1 --- #
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# --- Stage 2 --- #
FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
RUN addgroup -S railyatra && adduser -S railyatra -G railyatra \
    && chown -R railyatra:railyatra /app
USER railyatra
EXPOSE 5000
CMD ["node", "src/server.js"]