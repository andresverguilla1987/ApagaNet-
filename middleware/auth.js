const jwt = require('jsonwebtoken');

// Supports either Authorization: Bearer <JWT> OR X-Task-Secret: <secret>
// If JWT, prefer RS256 with JWT_PUBLIC_KEY_PEM, fallback to HS256 with JWT_SECRET.
function verifyJwt(authHeader) {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (!/^Bearer$/i.test(scheme) || !token) return null;
  const pub = process.env.JWT_PUBLIC_KEY_PEM;
  const hs = process.env.JWT_SECRET;
  try {
    if (pub) {
      const payload = jwt.verify(token, pub, { algorithms: ['RS256'] });
      return payload;
    } else if (hs) {
      const payload = jwt.verify(token, hs, { algorithms: ['HS256'] });
      return payload;
    }
    return null;
  } catch (_e) {
    return null;
  }
}

function authAny(req, res, next) {
  const payload = verifyJwt(req.headers['authorization']);
  if (payload) {
    req.auth = { mode: 'jwt', user_id: payload.sub || payload.user_id || null, payload };
    return next();
  }
  const secret = req.headers['x-task-secret'];
  if (secret && process.env.TASK_SECRET && secret === process.env.TASK_SECRET) {
    req.auth = { mode: 'task' };
    return next();
  }
  return res.status(401).json({ error: 'unauthorized' });
}

module.exports = { authAny };
