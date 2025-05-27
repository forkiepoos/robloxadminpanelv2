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
  const { username, password } = req.body;
  const { data, error } = await supabase
    .from('Users')
    .select('*')
    .eq('username', username)
    .eq('password', password)
    .single();

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
  const user = req.session.user;
  if (!user) return res.status(401).send('Unauthorized');

  const { type, target, reason, evidence, duration } = req.body;
  const timestamp = new Date().toISOString();

  const { error } = await supabase.from('Logs').insert({
    type,
    target,
    reason,
    evidence1: evidence[0],
    evidence2: evidence[1],
    evidence3: evidence[2],
    duration: type === 'Ban' ? duration : null,
    created_by: user.username,
    timestamp,
  });

  if (error) return res.status(500).send('Failed to log action');
  res.sendStatus(200);
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
app.post('/api/ban-request', async (req, res) => {
  const user = req.session.user;
  if (!user || user.level >= 3) return res.status(401).send('Unauthorized');
  const { target, reason, duration, evidence } = req.body;

  const { error } = await supabase.from('BanRequests').insert({
    target,
    reason,
    duration,
    evidence1: evidence[0],
    evidence2: evidence[1],
    evidence3: evidence[2],
    requested_by: user.username,
    status: 'Pending',
  });

  if (error) return res.status(500).send('Failed to submit request');
  res.sendStatus(200);
});

// ---------------- GET MY BAN REQUESTS ----------------
app.get('/api/my-ban-requests', async (req, res) => {
  const user = req.session.user;
  if (!user || user.level >= 3) return res.status(401).send('Unauthorized');
  const { data, error } = await supabase
    .from('BanRequests')
    .select('*')
    .eq('requested_by', user.username)
    .order('id', { ascending: false });
  if (error) return res.status(500).send('Failed to fetch requests');
  res.json(data);
});

// ---------------- GET ALL BAN REQUESTS (review) ----------------
app.get('/api/ban-requests', async (req, res) => {
  const user = req.session.user;
  if (!user || user.level < 3) return res.status(401).send('Unauthorized');
  const { data, error } = await supabase
    .from('BanRequests')
    .select('*')
    .order('id', { ascending: false });
  if (error) return res.status(500).send('Failed to fetch requests');
  res.json(data);
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
