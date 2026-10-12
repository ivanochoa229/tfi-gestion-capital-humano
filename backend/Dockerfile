# Imagen de desarrollo: el código fuente se monta como volumen desde
# docker-compose.yml y Nest recompila ante cada cambio.
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npm", "run", "start:dev"]
