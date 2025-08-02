# Stage 1: build client
FROM node:18-alpine AS build
WORKDIR /app

# Accept build arguments
ARG VITE_API_URL
ARG NODE_ENV=production

# Set environment variables for Vite
ENV VITE_API_URL=${VITE_API_URL}
ENV NODE_ENV=${NODE_ENV}

COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build

# Stage 2: serve via nginx
FROM nginx:alpine

# Copy custom nginx config if needed
# COPY nginx.conf /etc/nginx/nginx.conf

COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]