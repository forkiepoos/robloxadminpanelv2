const express = require('express');
const cookieParser = require('cookie-parser');
const { getSheetRows, appendToSheet, deleteRow } = require('./sheets');
const app = express();

app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;

function formatTimestamp() {
  const now = new Date();
  return now.toLocaleString('en-US', {
    month: '2-digit', day: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// Session validation middleware
app.use('/dashboard', async (req, res, next) => {
  const session = req.cookies.session;
  if (!session) return res.redirect('/login.html');
  next();
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const users = await getSheetRows('Users');
  const user = users.find(u => u.Username === username && u.Password === password);
  if (!user) return res.status(401).send('Invalid login');
  res.cookie('session', JSON.stringify({ username, permission: user.PermissionLevel }), {
    httpOnly: true,
    maxAge: 15 * 60 * 1000,
  });
  res.json({ success: true });
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ success: true });
});

// Submit log
app.post('/api/log', async (req, res) => {
  const { action, target, reason, evidence } = req.body;
  const session = JSON.parse(req.cookies.session);
  const row = [
    formatTimestamp(), action, target, session.username, reason,
    ...evidence.slice(0, 3)
  ];
  await appendToSheet('AuditLogs', row);
  res.json({ success: true });
});

// Get logs
app.get('/api/logs', async (req, res) => {
  const rows = await getSheetRows('AuditLogs');
  res.json(rows.reverse());
});

// Delete log (requires permission 3)
app.post('/api/delete-log', async (req, res) => {
  const session = JSON.parse(req.cookies.session);
  if (session.permission !== '3') return res.status(403).send('No permission');
  const { rowIndex } = req.body;
  await deleteRow('AuditLogs', rowIndex + 1); // +1 to skip headers
  res.json({ success: true });
});

// Ban request submission
app.post('/api/request-ban', async (req, res) => {
  const session = JSON.parse(req.cookies.session);
  const { target, reason, evidence, duration } = req.body;
  const row = [
    formatTimestamp(), target, session.username, reason,
    ...evidence.slice(0, 3), duration, 'Pending'
  ];
  await appendToSheet('BanRequests', row);
  res.json({ success: true });
});

// Get ban requests
app.get('/api/ban-requests', async (req, res) => {
  const session = JSON.parse(req.cookies.session);
  const all = await getSheetRows('BanRequests');
  if (session.permission === '3') {
    res.json(all.filter(r => r.Status === 'Pending'));
  } else {
    res.json(all.filter(r => r.Issuer === session.username));
  }
});

// Approve or decline ban requests
app.post('/api/review-request', async (req, res) => {
  const session = JSON.parse(req.cookies.session);
  if (session.permission !== '3') return res.status(403).send('No permission');
  // TODO: Update request status in sheet
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

