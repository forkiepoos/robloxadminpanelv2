// server.js
import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import path from 'path';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 15 * 60 * 1000 } // 15 mins
}));
app.use(express.static(path.join(process.cwd(), 'public')));

function getSheetsClient() {
  const auth = new google.auth.JWT(
    SERVICE_ACCOUNT_EMAIL,
    null,
    PRIVATE_KEY,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

async function getSheetData(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A2:Z` // skip header
  });
  return res.data.values || [];
}

async function appendRow(sheets, sheetName, row) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [row] }
  });
}

async function deleteRow(sheets, sheetName, rowIndex) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 0, // assuming sheet ID 0; change if needed
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1
          }
        }
      }]
    }
  });
}

// Authentication (Login)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const sheets = getSheetsClient();
  const users = await getSheetData(await sheets, 'Users');
  const user = users.find(u => u[0] === username && u[1] === password);
  if (!user) return res.status(401).send('Invalid credentials');
  req.session.user = { username, permissionLevel: parseInt(user[2]) };
  res.redirect('/dashboard.html');
});

// Get Session Info
app.get('/api/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login.html');
  });
});

// Submit Action (Ban/Kick/Warn)
app.post('/api/submit-action', async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(403).send('Forbidden');

  const { action, targetUser, reason, evidence, duration } = req.body;
  const allowed = {
    'warn': [1, 2, 3],
    'kick': [2, 3],
    'ban': [3]
  };

  if (!allowed[action.toLowerCase()]?.includes(user.permissionLevel)) {
    return res.status(403).send('Not allowed for your level');
  }

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
  const sheets = getSheetsClient();
  await appendRow(await sheets, 'Logs', [
    action,
    targetUser,
    `${user.username}: ${reason}`,
    evidence.join(', '),
    duration || 'N/A',
    timestamp
  ]);

  res.sendStatus(200);
});

// Submit Ban Request (Level 1 & 2)
app.post('/api/ban-request', async (req, res) => {
  const user = req.session.user;
  if (!user || user.permissionLevel >= 3) return res.status(403).send('Forbidden');

  const { targetUser, reason, evidence, duration } = req.body;
  const sheets = getSheetsClient();
  const id = `${Date.now()}`;

  await appendRow(await sheets, 'BanRequests', [
    id,
    targetUser,
    `${user.username}: ${reason}`,
    evidence.join(', '),
    duration,
    'Pending'
  ]);

  res.sendStatus(200);
});

// Get Ban Requests
app.get('/api/ban-requests', async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(403).send('Forbidden');

  const sheets = getSheetsClient();
  const requests = await getSheetData(await sheets, 'BanRequests');

  const visible = user.permissionLevel === 3
    ? requests
    : requests.filter(r => r[2]?.includes(user.username));

  res.json({ permissionLevel: user.permissionLevel, requests: visible });
});

// Delete Log (Level 3 only)
app.post('/api/delete-log', async (req, res) => {
  const user = req.session.user;
  if (!user || user.permissionLevel < 3) return res.status(403).send('Forbidden');

  const { id } = req.body;
  const sheets = getSheetsClient();

  await deleteRow(await sheets, 'Logs', parseInt(id) + 1); // +1 for header offset
  res.sendStatus(200);
});

// Fallback to login if route not found
app.get('*', (req, res) => {
  res.redirect('/login.html');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
