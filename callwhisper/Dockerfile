# Stage 1: build Vite client
FROM node:20-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: production server
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server/ ./server/
COPY --from=client-builder /app/client/dist ./client/dist/
EXPOSE 3001
CMD ["node", "server/index.js"]
