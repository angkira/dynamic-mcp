# Development Dockerfile for server
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=development

# Copy dependency files
COPY package*.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 3000
CMD ["npm", "run", "dev"]