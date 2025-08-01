# Stage 1: build client
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build

# Stage 2: serve via nginx
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]