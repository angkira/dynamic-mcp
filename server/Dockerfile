# Clean development Dockerfile for server
FROM node:22-alpine
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

ENV NODE_ENV=development

# Copy only package files needed for dependency installation
COPY package*.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies once at root level (monorepo style)
ENV npm_config_cache=/tmp/.npm \
  npm_config_unsafe_perm=true
RUN npm ci || npm install

EXPOSE 3000

# Use mounted volumes for everything else - no copying needed!
# Set working directory to server for proper relative paths
WORKDIR /app/server
CMD ["npm", "run", "dev"]