FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
WORKDIR /app/services/media-service
COPY services/media-service/package*.json ./
RUN npm install
COPY services/media-service/. .
EXPOSE 3006
CMD ["npm", "run", "dev"]
