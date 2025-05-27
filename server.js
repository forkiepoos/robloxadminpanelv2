// server.js using Supabase
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// --- SUBMIT ACTION (warn/kick/ban) ---
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
        handled: false  // 🔥 ensures Roblox picks this up
      }
    ]);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed to insert action log:', err.message);
    res.status(500).json({ error: 'Insert failed' });
  }
});


// ---------------- SUBMIT BAN REQUEST (Levels 1–2) ----------------
app.post('/api/submit-ban-request', async (req, res) => {
  const { target, reason, duration, evidence } = req.body;

  const username = req.session?.user?.username;
  const level = req.session?.user?.level;

  // Only allow levels 1 or 2
  if (!username || level >= 3) {
    return res.status(403).send('Forbidden');
  }

  if (!target || !reason || !duration || !evidence || evidence.length !== 3) {
    return res.status(400).send('Missing required fields');
  }

  try {
    const { error } = await supabase.from('BanRequests').insert([
      {
        target,
        reason,
        duration,
        evidence1: evidence[0],
        evidence2: evidence[1],
        evidence3: evidence[2],
        created_by: username,
        status: 'Pending',
        timestamp: new Date().toISOString()
      }
    ]);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Ban request submission failed:', err.message);
    res.status(500).send('Error submitting request');
  }
});


// ---------------- GET AUDIT LOGS ----------------
app.get('/api/logs', async (req, res) => {
  const { data, error } = await supabase
    .from('Logs')
    .select('*')
    .order('timestamp', { ascending: false });

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

// ---------------- GET MY BAN REQUESTS ----------------
app.get('/api/my-ban-requests', async (req, res) => {
  const username = req.session?.user?.username;
  if (!username) return res.status(401).send('Unauthorized');

  const { data, error } = await supabase
    .from('BanRequests')
    .select('*')
    .eq('created_by', username)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Failed to fetch my ban requests:', error);
    return res.status(500).send('Database error');
  }

  res.json(data);
});


// ---------------- GET ALL BAN REQUESTS (REVIEW) ----------------
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
    res.json(data);
  } catch (err) {
    console.error('❌ Failed to fetch ban requests:', err.message);
    res.status(500).send('Failed to load ban requests');
  }
});

// ---------------- APPROVE BAN REQUEST ----------------
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

    await supabase
  .from('BanRequests')
  .update({
    reviewed_by: req.session?.user?.username,
    status: 'Approved'
  })
  .eq('id', id);

    res.send('Approved');
  } catch (err) {
    console.error('❌ Approve error:', err.message);
    res.status(500).send('Approve failed');
  }
});

// ---------------- DENY BAN REQUEST ----------------
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
// Search logs by target username
app.get('/api/logs/user/:username', async (req, res) => {
  const { username } = req.params;
  const { data, error } = await supabase
    .from('Logs')
    .select('*')
    .eq('target', username)
    .order('timestamp', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});


// --- DELETE LOG BY ID ---
app.post('/api/logs/delete', async (req, res) => {
  const { id } = req.body;
  const sessionUser = req.session?.user;

  if (!sessionUser) return res.status(401).send('Unauthorized');

  try {
    const { error } = await supabase.from('Logs').delete().eq('id', id);
    if (error) throw error;
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Failed to delete log:', err.message);
    res.status(500).send('Delete failed');
  }
});

// ---------------- EDIT LOG ----------------
app.post('/api/logs/edit', async (req, res) => {
  const { id, type, reason, duration } = req.body;

  // Get user from session
  const user = req.session.user;
  if (!user) return res.status(401).send('Unauthorized');

  // Permission check
  const canEdit =
    (type === 'Ban' && user.level === 3) ||
    (type === 'Kick' && user.level >= 2) ||
    (type === 'Warn' && user.level >= 1);

  if (!canEdit) return res.status(403).send('Insufficient permissions');

  // Perform update
  const { error } = await supabase
    .from('Logs')
    .update({
      type,
      reason,
      duration: type === 'Ban' ? duration : ''
    })
    .eq('id', id);

  if (error) {
    console.error('❌ Log update failed:', error.message);
    return res.status(500).send('Update failed');
  }

  res.sendStatus(200);
});

app.get('/api/player-status/:username', async (req, res) => {
  const username = req.params.username;

  const { data, error } = await supabase
    .from('Logs')
    .select('*')
    .eq('target', username)
    .eq('handled', false) // only unhandled
    .order('timestamp', { ascending: false });

  if (error) return res.status(500).send('Failed to fetch logs');
  res.json(data);
});

app.get('/api/punishments/unhandled/:username', async (req, res) => {
  const username = req.params.username;

  const { data, error } = await supabase
    .from('Logs')
    .select('*')
    .eq('target', username)
    .eq('handled', false);

  if (error) return res.status(500).json({ error: error.message });

  const now = new Date();

  const filtered = data.filter(entry => {
    if (entry.type === 'Ban') {
      if (!entry.duration || entry.duration === 'Perm') return true;

      const created = new Date(entry.timestamp);
      const daysMap = {
        '1 Day': 1,
        '3 Days': 3,
        '10 Days': 10,
        '14 Days': 14,
        'Perm': Infinity
      };
      const durationDays = daysMap[entry.duration] || 0;
      const expires = new Date(created.getTime() + durationDays * 86400000);

      return now < expires;
    }

    return true;
  });

  res.json(filtered);
});

app.post('/api/punishments/mark-handled', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).send('Missing ID');

  const { error } = await supabase
    .from('Logs')
    .update({ handled: true })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });

  res.sendStatus(200);
});




// ---------------- SERVE LOGIN PAGE ----------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
