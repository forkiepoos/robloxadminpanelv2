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

  if (!target || !reason || !type || !evidence || evidence.length !== 3) {
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
  const { target, reason, action, duration, evidence } = req.body;

  console.log('🔍 Incoming action:', req.body);

  if (!username || !reason || !action || evidence.length !== 3) {
    return res.status(400).send('Missing required fields');
  }

  if (error) return res.status(500).send('Failed to submit request');
  res.sendStatus(200);
});

// ---------------- GET MY BAN REQUESTS ----------------
app.get('/api/my-ban-requests', async (req, res) => {
  try {
    const username = req.session?.user?.username;
    if (!username) return res.status(401).send('Not logged in');

    const { data, error } = await supabase
      .from('BanRequests')
      .select('*')
      .eq('created_by', username)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('❌ Failed to fetch user ban requests:', err.message);
    res.status(500).send('Failed to load your requests');
  }
});



// ---------------- GET ALL BAN REQUESTS (review) ----------------
app.get('/api/ban-requests', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.level < 3) {
      return res.status(403).send('Access denied');
    }

    const { data, error } = await supabase
      .from('BanRequests')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;


// ---------------- UPDATE BAN REQUEST ----------------
app.post('/api/ban-request/approve', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.level < 3) {
      return res.status(403).send('Access denied');
    }

    const { id } = req.body;

    const { data: request } = await supabase
      .from('BanRequests')
      .select('*')
      .eq('id', id)
      .single();

    if (!request) return res.status(404).send('Request not found');

    // insert to Logs
    const insertRes = await supabase.from('Logs').insert([
      {
        type: 'Ban',
        target: request.target,
        reason: request.reason,
        duration: request.duration,
        evidence1: request.evidence1,
        evidence2: request.evidence2,
        evidence3: request.evidence3,
        created_by: req.session.user.username,
        timestamp: new Date().toISOString(),
      },
    ]);

    if (insertRes.error) throw insertRes.error;

    // delete the request or mark as approved
    await supabase
      .from('BanRequests')
      .update({ status: 'Approved' })
      .eq('id', id);

    res.send('Approved');
  } catch (err) {
    console.error('❌ Approve error:', err.message);
    res.status(500).send('Approve failed');
  }
});

//DENY BAN REQ
app.post('/api/ban-request/deny', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.level < 3) {
      return res.status(403).send('Access denied');
    }

    const { id } = req.body;

    const { error } = await supabase
      .from('BanRequests')
      .update({ status: 'Denied' })
      .eq('id', id);

    if (error) throw error;
    res.send('Denied');
  } catch (err) {
    console.error('❌ Deny error:', err.message);
    res.status(500).send('Deny failed');
  }
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
