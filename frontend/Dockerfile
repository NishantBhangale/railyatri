# ----- Stage 1 ---- #
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json /app/

RUN npm install

COPY . .

RUN npm run build

# ----- Stage 2 ----- #

FROM nginx:1.25-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist /usr/share/nginx/html

COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8081

CMD ["nginx", "-g", "daemon off;"]