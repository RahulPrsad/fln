FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY apps/api ./apps/api

ENV SMARTFLN_ENV=production
ENV SMARTFLN_API_HOST=0.0.0.0
ENV SMARTFLN_API_PORT=8080

EXPOSE 8080

CMD ["node", "apps/api/src/main.js"]
