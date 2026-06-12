import express, {Request, Response} from 'express';
import cors from 'cors';
import {AccessToken} from 'livekit-server-sdk';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const PORT = Number(process.env.PORT || 3001);
const TOKEN_TTL = process.env.LIVEKIT_TOKEN_TTL || '6h';

const app = express();
app.use(cors());

app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ok: true, configured: Boolean(LIVEKIT_API_KEY && LIVEKIT_API_SECRET)});
});

app.get('/api/token', async (req: Request, res: Response) => {
  const room = String(req.query.room || '');
  const identity = String(req.query.identity || '');
  const name = req.query.name ? String(req.query.name) : identity;

  if (!room || !identity) {
    return res.status(400).json({error: 'query params "room" and "identity" are required'});
  }
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return res.status(500).json({error: 'token-server is missing LIVEKIT_API_KEY / LIVEKIT_API_SECRET'});
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {identity, name, ttl: TOKEN_TTL});
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true
  });

  // livekit-server-sdk v2: toJwt() is async.
  const token = await at.toJwt();
  res.json({token});
});

app.listen(PORT, () => {
  console.log(`token-server listening on :${PORT}`);
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.warn('WARNING: LIVEKIT_API_KEY / LIVEKIT_API_SECRET not set — token requests will fail.');
  }
});
