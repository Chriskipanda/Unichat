FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
WORKDIR /app/services/presence-service
COPY services/presence-service/package*.json ./
RUN npm install
COPY services/presence-service/. .
EXPOSE 3005
CMD ["npm", "run", "dev"]
