// server/server.js
import express from 'express';
import session from 'express-session';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const SHEET_ID = process.env.SHEET_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');
const SERVICE_ACCOUNT_EMAIL = process.env.SERVICE_ACCOUNT_EMAIL;

const auth = new google.auth.JWT(
  SERVICE_ACCOUNT_EMAIL,
  null,
  PRIVATE_KEY,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: 'supersecretkey',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 15 * 60 * 1000 },
  })
);

function formatTimestamp() {
  const now = new Date();
  return now.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

async function getSheetData(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return res.data.values || [];
}

async function appendToSheet(range, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    resource: { values: [values] },
  });
}

async function writeSheet(range, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    resource: { values },
  });
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const users = await getSheetData('Users!A2:C');
  const user = users.find(([u, p]) => u === username && p === password);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  req.session.user = { username, permission: parseInt(user[2]) };
  res.json({ message: 'Login successful', permission: parseInt(user[2]) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

app.get('/api/logs', async (req, res) => {
  const logs = await getSheetData('Logs!A2:G');
  res.json(logs.reverse());
});

app.post('/api/delete-log', async (req, res) => {
  const { index } = req.body;
  const logs = await getSheetData('Logs!A2:G');
  logs.splice(logs.length - index - 1, 1);
  await writeSheet('Logs!A2', logs);
  res.json({ message: 'Log deleted' });
});

app.post('/api/submit-action', async (req, res) => {
  const { type, target, reason, evidence, duration } = req.body;
  const user = req.session.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const perms = { warn: 1, kick: 2, ban: 3 };
  if (user.permission < perms[type]) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  const timestamp = formatTimestamp();
  await appendToSheet('Logs!A2', [user.username, target, type, reason, evidence.join(','), duration || '', timestamp]);
  res.json({ message: 'Action logged' });
});

app.post('/api/submit-ban-request', async (req, res) => {
  const { target, reason, evidence, duration } = req.body;
  const user = req.session.user;
  if (!user || user.permission >= 3) return res.status(403).json({ message: 'Unauthorized' });

  const timestamp = formatTimestamp();
  await appendToSheet('BanRequests!A2', [user.username, target, reason, evidence.join(','), duration, timestamp, 'Pending']);
  res.json({ message: 'Ban request submitted' });
});

app.get('/api/ban-requests', async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const rows = await getSheetData('BanRequests!A2:G');
  if (user.permission === 3) {
    res.json(rows);
  } else {
    const filtered = rows.filter(row => row[0] === user.username);
    res.json(filtered);
  }
});

app.post('/api/review-ban-request', async (req, res) => {
  const { index, decision } = req.body;
  const user = req.session.user;
  if (!user || user.permission < 3) return res.status(403).json({ message: 'Forbidden' });

  const rows = await getSheetData('BanRequests!A2:G');
  rows[rows.length - index - 1][6] = decision;
  await writeSheet('BanRequests!A2', rows);
  res.json({ message: 'Ban request reviewed' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
