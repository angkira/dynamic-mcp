# Clean development Dockerfile for client
FROM node:22-alpine
WORKDIR /app

ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG NODE_ENV=development

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
ENV NODE_ENV=${NODE_ENV}

# Copy only package files needed for dependency installation
COPY package*.json ./
COPY client/package.json ./client/
COPY shared/package.json ./shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies once at root level (monorepo style)
RUN npm ci

EXPOSE 5173

# Use mounted volumes for everything else - no copying needed!
# Set working directory to client for proper relative paths
WORKDIR /app/client
CMD ["npm", "run", "dev"]