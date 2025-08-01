# Stage 1: build
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies and build
COPY package*.json tsconfig.json ./
COPY src ./src
RUN npm ci
RUN npm run build

# Stage 2: production image
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy built assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/app.js"]