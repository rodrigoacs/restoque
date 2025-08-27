FROM node:20-alpine

WORKDIR /usr/src/app

COPY backend/package*.json ./

RUN npm install

COPY backend/ ./
COPY public/ ./public/

EXPOSE 3020

CMD [ "node", "server.js" ]
