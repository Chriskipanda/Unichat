FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
COPY shared ./shared
WORKDIR /app/services/tenant-service
COPY services/tenant-service/package*.json ./
RUN npm install
COPY services/tenant-service/. .
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate
EXPOSE 3004
CMD ["npm", "run", "dev"]
