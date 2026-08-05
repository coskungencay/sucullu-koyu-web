# Build aşaması — sabit Node LTS
FROM node:22.16.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NOT: Burada VITE_* icin ARG/ENV TANIMLANMAZ. Vite'in oncelik sirasinda
# process env, .env.production dosyasini EZER; bos varsayilanli bir ENV
# gateway URL'ini sessizce siler ve site disabled modda kalir (yasandi).
# Kamera gateway adresinin tek kaynagi .env.production dosyasidir.
# Asset bütünlüğü build'in ön koşuludur (56/56 SHA-256)
RUN node scripts/verify-assets.mjs && npm run build

# Runtime aşaması — yalnızca dist/ + nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
