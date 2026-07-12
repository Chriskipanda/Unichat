# UniChat Enterprise SaaS Platform

Next-Generation Multi-Tenant Academic Communication Ecosystem.

## Project Structure

- `apps/`: Frontend applications.
  - `mobile/`: Flutter mobile application.
  - `web/`: React + Next.js web dashboard.
- `services/`: Node.js microservices (Fastify).
  - `auth-service/`: Authentication and Session management.
  - `user-service/`: User profiles and identity.
  - `tenant-service/`: Multi-tenant isolation and branding.
  - `messaging-service/`: Real-time chat and persistence.
  - `community-service/`: Academic structure engine.
- `shared/`: Shared types, constants, and utility libraries.
- `infrastructure/`: Deployment and orchestration (Docker, K8s, NGINX).
- `docs/`: Project documentation and SRS.

## Technology Stack

- **Mobile:** Flutter
- **Web:** React.js / Next.js
- **Backend:** Node.js (Fastify)
- **Database:** PostgreSQL (Core), Redis (Cache/Presence), Elasticsearch (Search)
- **Real-time:** Socket.IO / WebRTC
- **Event Streaming:** Apache Kafka / RabbitMQ
- **Cloud:** Docker, Kubernetes, Cloudflare
