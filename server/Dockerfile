# Clean development Dockerfile for server
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=development

# Copy only package files needed for dependency installation
COPY package*.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies once at root level (monorepo style)
RUN npm ci

EXPOSE 3000

# Use mounted volumes for everything else - no copying needed!
# The command will be overridden by docker-compose
CMD ["sh", "-c", "npx prisma generate && cd server && npm run dev"] Dockerfile for server
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=development

# Copy only package files needed for dependency installation
COPY package*.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies once at root level (monorepo style)
RUN npm ci

EXPOSE 3000

# Use mounted volumes for everything else - no copying needed!
# Set working directory to server for proper relative paths
WORKDIR /app/server
CMD ["npm", "run", "dev"]