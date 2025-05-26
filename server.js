require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your-secret', // Change in production
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 15 * 60 * 1000 } // 15 minutes
}));

// ----------- GOOGLE SHEETS SETUP -------------
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GCP_PROJECT_ID,
      private_key_id: process.env.GCP_PRIVATE_KEY_ID,
      private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.GCP_CLIENT_EMAIL,
      client_id: process.env.GCP_CLIENT_ID
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

async function getSheetData(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: `${sheetName}!A2:F`
  });

  return (res.data.values || []).map((row, index) => ({
    id: row[0],
    targetUser: row[1],
    reason: row[2],
    evidence: row[3]?.split(', ') || [],
    duration: row[4],
    status: row[5] || 'Pending',
    index
  }));
}

async function appendRow(sheets, sheetName, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range: `${sheetName}!A:F`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values]
    }
  });
}

async function deleteRow(sheets, sheetName, rowIndex) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.SHEET_ID });
  const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex
          }
        }
      }]
    }
  });
}

// ----------- ROUTES -------------

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const sheets = await getSheetsClient();
  const usersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Users!A2:C'
  });
  const users = usersRes.data.values || [];

  const user = users.find(u => u[0] === username && u[1] === password);
  if (!user) return res.status(401).send('Unauthorized');

  req.session.user = { username, permissionLevel: parseInt(user[2] || '1') };
  res.sendStatus(200);
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.sendStatus(200));
});

app.get('/api/logs', async (req, res) => {
  const sheets = await getSheetsClient();
  const logsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Logs!A2:F'
  });

  const logs = (logsRes.data.values || []).map((row, index) => ({
    id: `${index}`,
    action: row[0],
    targetUser: row[1],
    reason: row[2],
    evidence: row[3],
    duration: row[4],
    timestamp: row[5]
  })).reverse(); // Most recent first

  res.json(logs);
});

app.post('/api/submit-action', async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(403).send('Forbidden');

  const { action, targetUser, reason, evidence, duration } = req.body;
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });

  const sheets = await getSheetsClient();
  await appendRow(sheets, 'Logs', [
    action, targetUser, reason, evidence.join(', '), duration, timestamp
  ]);

  res.sendStatus(200);
});

app.post('/api/ban-request', async (req, res) => {
  const user = req.session.user;
  if (!user || user.permissionLevel >= 3) return res.status(403).send('Forbidden');

  const { targetUser, reason, evidence, duration } = req.body;
  const sheets = await getSheetsClient();
  const id = `${Date.now()}`;
  await appendRow(sheets, 'BanRequests', [
    id, targetUser, reason, evidence.join(', '), duration, 'Pending'
  ]);

  res.sendStatus(200);
});

app.get('/api/ban-requests', async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(403).send('Forbidden');

  const sheets = await getSheetsClient();
  const requests = await getSheetData(sheets, 'BanRequests');

  const ownRequests = requests.filter(r => r.status === 'Pending' && r.reason.includes(user.username));
  const visibleRequests = user.permissionLevel === 3 ? requests : [];
  res.json({ permissionLevel: user.permissionLevel, requests: visibleRequests, ownRequests });
});

app.post('/api/handle-request', async (req, res) => {
  const { id, action } = req.body;
  const user = req.session.user;
  if (!user || user.permissionLevel !== 3) return res.status(403).send('Forbidden');

  const sheets = await getSheetsClient();
  const requests = await getSheetData(sheets, 'BanRequests');
  const rowIndex = requests.find(r => r.id === id)?.index;
  const request = requests.find(r => r.id === id);
  if (!request) return res.status(404).send('Not found');

  if (action === 'accept') {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
    await appendRow(sheets, 'Logs', [
      'Ban', request.targetUser, request.reason, request.evidence.join(', '), request.duration, timestamp
    ]);
  }

  await deleteRow(sheets, 'BanRequests', rowIndex + 2); // +2 for header and 0-index
  res.sendStatus(200);
});

app.post('/api/delete-log', async (req, res) => {
  const user = req.session.user;
  if (!user || user.permissionLevel < 3) return res.status(403).send('Forbidden');

  const { id } = req.body;
  const sheets = await getSheetsClient();
  await deleteRow(sheets, 'Logs', parseInt(id) + 2);
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

