# Build aşaması — sabit Node LTS
FROM node:22.16.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Kamera gateway adresi BUILD-TIME degiskenidir (Vite import.meta.env).
# Bos birakilirsa site guvenli 'disabled' modda kalir (sifir kamera istegi).
ARG VITE_CAMERA_BASE_URL=""
ENV VITE_CAMERA_BASE_URL=$VITE_CAMERA_BASE_URL
# Asset bütünlüğü build'in ön koşuludur (56/56 SHA-256)
RUN node scripts/verify-assets.mjs && npm run build

# Runtime aşaması — yalnızca dist/ + nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
