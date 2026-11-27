require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory demo store for admin monitoring & round verification
const store = {
  startedAt: new Date().toISOString(),
  config: {
    botUsername: process.env.BOT_USERNAME || 'happy_keno_bot',
    miniAppUrl: process.env.MINI_APP_URL || 'https://t.me/happy_keno_bot/Happy',
    payments: {
      telebirr: process.env.TELEBIRR_NUMBER || '0901047714',
      cbeBirr: process.env.CBE_BIRR_NUMBER || '0907918383',
      ebirr: process.env.EBIRR_NUMBER || '0901047714',
    },
    limits: {
      minTransactionEtb: 50,
      maxTransactionEtb: 5000,
      maxTicketsPerRound: 10,
      bettingDurationSec: 45,
      drawnBallsCount: 20,
    },
  },
  rounds: [],
  transactions: [],
};

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Happy Keno 80 Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Happy Keno 80 Admin"');
  return res.status(403).json({ error: 'Invalid admin credentials' });
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'happy-keno-80',
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/config', (req, res) => {
  res.json(store.config);
});

app.post('/api/rounds/verify', (req, res) => {
  const { roundNumber, seed } = req.body || {};
  if (!seed || typeof seed !== 'string') {
    return res.status(400).json({ error: 'Seed is required' });
  }
  const sha256 = crypto.createHash('sha256').update(seed).digest('hex');
  const record = {
    roundNumber: roundNumber || null,
    seed,
    sha256,
    verifiedAt: new Date().toISOString(),
  };
  store.rounds.unshift(record);
  if (store.rounds.length > 100) store.rounds.pop();
  return res.json(record);
});

app.post('/api/transactions/log', (req, res) => {
  const { type, method, amount, reference, status } = req.body || {};
  if (!type || !amount) {
    return res.status(400).json({ error: 'type and amount are required' });
  }
  const entry = {
    id: `LOG-${Date.now().toString(36).toUpperCase()}`,
    type,
    method: method || 'Unknown',
    amount: Number(amount),
    reference: reference || '',
    status: status || 'RECORDED',
    createdAt: new Date().toISOString(),
  };
  store.transactions.unshift(entry);
  if (store.transactions.length > 200) store.transactions.pop();
  return res.status(201).json(entry);
});

app.get('/api/admin/overview', requireAdminAuth, (req, res) => {
  res.json({
    startedAt: store.startedAt,
    config: store.config,
    counts: {
      verifiedRounds: store.rounds.length,
      loggedTransactions: store.transactions.length,
    },
    recentRounds: store.rounds.slice(0, 25),
    recentTransactions: store.transactions.slice(0, 50),
  });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Happy Keno 80 server running on http://localhost:${PORT}`);
});
