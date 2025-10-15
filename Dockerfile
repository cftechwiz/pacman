FROM node:20-bookworm-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY . .

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
