# One-shot database initializer.
# Creates/updates every table from the canonical schema, then seeds the demo
# accounts, and exits. Run by the `db-init` service in docker-compose so a
# fresh machine gets a ready database from `docker compose up` alone — no
# manual `prisma db push` or `migrate deploy` step.
#
# Both operations are idempotent: db push only applies diffs, and seed.js
# checks before inserting, so re-running on every start is safe.
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
# --skip-generate: the client was already generated in the line above.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node seed.js"]
