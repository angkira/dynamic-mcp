# Development Dockerfile for client
FROM node:22-alpine
WORKDIR /app

# Accept build arguments
ARG VITE_API_URL
ARG NODE_ENV=development

# Set environment variables for Vite
ENV VITE_API_URL=${VITE_API_URL}
ENV NODE_ENV=${NODE_ENV}

# Copy dependency files
COPY package*.json ./
COPY client/package.json ./client/package.json

# Install dependencies
RUN npm ci

EXPOSE 5173
CMD ["npm", "run", "dev"]