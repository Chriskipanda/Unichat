FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
COPY shared ./shared
WORKDIR /app/services/auth-service
COPY services/auth-service/package*.json ./
RUN npm install
COPY services/auth-service/. .
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "run", "dev"]
