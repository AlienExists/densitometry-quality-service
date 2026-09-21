# =========================================
# Stage 1: сборка приложения
# =========================================
FROM node:20-alpine AS build

WORKDIR /app

# Сначала только package*.json — чтобы Docker кэшировал npm install,
# и он не пересобирался заново при каждом изменении исходников
COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .

# VITE_* переменные должны быть заданы на этапе сборки (Vite "зашивает" их
# в бандл), поэтому передаём через --build-arg при docker build, см. README
ARG VITE_API_BASE_URL=/api
ARG VITE_USE_MOCKS=false
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_USE_MOCKS=${VITE_USE_MOCKS}

RUN npm run build

# =========================================
# Stage 2: раздача статики через nginx
# =========================================
FROM nginx:alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
