// Shared across every service: the JWT-secret fail-fast check and the
// standard bearer-auth preHandler were previously hand-copied into 6
// separate app.js files, and had already drifted once (one copy still had
// the hardcoded fallback after another had been fixed). One implementation,
// required by every service, so a fix here can't be forgotten in a sibling.

/**
 * Reads JWT_SECRET from the environment or exits the process immediately.
 * Call this before registering @fastify/jwt — never fall back to a
 * hardcoded default; a service that can't confirm its secret should not
 * silently start with an insecure one.
 */
function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('FATAL: JWT_SECRET is not set. Refusing to start with an insecure default.');
    process.exit(1);
  }
  return secret;
}

/**
 * Registers @fastify/jwt using the environment secret (or exits — see
 * requireJwtSecret). Call once per service, before defining routes.
 *
 * jwtPlugin is passed in rather than required here: shared/ has no
 * node_modules of its own, and Node's module resolution only walks up from
 * the requiring file's directory — it would never find a dependency sitting
 * in a sibling service's node_modules. Each caller passes its own already-
 * resolvable require('@fastify/jwt').
 */
function registerJwt(fastify, jwtPlugin) {
  fastify.register(jwtPlugin, { secret: requireJwtSecret() });
}

/**
 * Standard bearer-auth preHandler: verifies the token, nothing else. Use on
 * any route where identity alone is enough (tenant scoping isn't required).
 */
async function bearerAuth(request, reply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}

/**
 * Same as bearerAuth, but additionally requires a tenantId claim — for
 * routes that operate within a specific institution's data.
 */
async function bearerAuthWithTenant(request, reply) {
  try {
    await request.jwtVerify();
    if (!request.user.tenantId) return reply.code(403).send({ error: 'No tenant scope' });
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}

/**
 * Verifies a raw token string outside of an HTTP request context — used for
 * Socket.IO handshake authentication, where there's no `request` object.
 * Throws on an invalid/expired token; callers should catch and reject the
 * connection.
 */
function verifyToken(fastify, rawAuthValue) {
  const token = typeof rawAuthValue === 'string' && rawAuthValue.startsWith('Bearer ')
    ? rawAuthValue.slice(7)
    : rawAuthValue;
  if (!token) throw new Error('No token provided');
  return fastify.jwt.verify(token);
}

module.exports = { requireJwtSecret, registerJwt, bearerAuth, bearerAuthWithTenant, verifyToken };
