# Imagen de desarrollo: el código fuente se monta como volumen desde
# docker-compose.yml y Vite recarga ante cada cambio.
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
