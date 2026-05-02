# Fase 1: Compilar Angular
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npx ng build --configuration=production

# Fase 2: Servir con nginx
FROM nginx:alpine

COPY --from=build /app/dist/VTT-TFG/browser /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80