// server.js using Supabase
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
  })
);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ---------------- LOGIN ----------------
app.post('/api/login', async (req, res) => {
const username = req.body.username.trim();
const password = req.body.password.trim();

const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('username', username)
  .eq('password', password)
  .maybeSingle();

console.log('Checking username:', `'${username}'`, 'password:', `'${password}'`);
console.log('Supabase result:', data);
console.log('Supabase error:', error);

  if (error || !data) return res.status(401).send('Invalid credentials');

  req.session.user = {
    username: data.username,
    level: data.permission,
  };

  res.json({ success: true });
});


// ---------------- LOGOUT ----------------
app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ---------------- GET USER ----------------
app.get('/api/user', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).send('Unauthorized');
  res.json(user);
});

// ---------------- SUBMIT ACTION (warn/kick/ban) ----------------
app.post('/api/submit-action', async (req, res) => {
  const { target, reason, type, duration, evidence } = req.body;

  console.log('▶️ SUBMIT PAYLOAD:', req.body);

  if (!username || !reason || !action || !evidence || evidence.length !== 3) {
    return res.status(400).send('Missing required fields');
  }

  try {
    const { error } = await supabase.from('Logs').insert([
  {
    type,
    target,
    reason,
    evidence1: evidence[0],
    evidence2: evidence[1],
    evidence3: evidence[2],
    duration: type === 'Ban' ? duration : '',
    created_by: req.session?.user?.username || 'Unknown',
    timestamp: new Date().toISOString(),
  },
]);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed to insert action log:', err.message);
    res.status(500).json({ error: 'Insert failed' });
  }
});


// ---------------- GET AUDIT LOGS ----------------
app.get('/api/logs', async (req, res) => {
  const { data, error } = await supabase.from('Logs').select('*').order('timestamp', { ascending: false });
  if (error) return res.status(500).send('Failed to fetch logs');
  res.json(data);
});

// ---------------- DELETE LOG ----------------
app.post('/api/delete-log', async (req, res) => {
  const { id } = req.body;
  const { error } = await supabase.from('Logs').delete().eq('id', id);
  if (error) return res.status(500).send('Failed to delete log');
  res.sendStatus(200);
});

// ---------------- SUBMIT BAN REQUEST ----------------
app.post('/api/submit-action', async (req, res) => {
  const { username, reason, action, duration, evidence } = req.body;

  console.log('🔍 Incoming action:', req.body);

  if (!username || !reason || !action || evidence.length !== 3) {
    return res.status(400).send('Missing required fields');
  }

  if (error) return res.status(500).send('Failed to submit request');
  res.sendStatus(200);
});

// ---------------- GET MY BAN REQUESTS ----------------
app.get('/api/logs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('Logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('❌ Failed to fetch logs:', err.message);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});


// ---------------- GET ALL BAN REQUESTS (review) ----------------
app.get('/api/ban-requests', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('BanRequests')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('❌ Failed to fetch ban requests:', err.message);
    res.status(500).json({ error: 'Failed to fetch ban requests' });
  }
});

// ---------------- UPDATE BAN REQUEST ----------------
app.post('/api/update-ban-request', async (req, res) => {
  const user = req.session.user;
  if (!user || user.level < 3) return res.status(401).send('Unauthorized');
  const { id, status } = req.body;

  const { error } = await supabase
    .from('BanRequests')
    .update({ status, reviewed_by: user.username })
    .eq('id', id);

  if (error) return res.status(500).send('Failed to update request');
  res.sendStatus(200);
});

// ---------------- SERVE LOGIN PAGE ----------------
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
