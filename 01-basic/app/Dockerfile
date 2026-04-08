FROM node:20-alpine

WORKDIR /app

COPY package.json ./
# no deps yet, but this is where `npm ci` would go

COPY server.js ./

USER node
EXPOSE 3000

CMD ["node", "server.js"]
