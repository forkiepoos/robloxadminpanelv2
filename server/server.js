import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import path from 'path';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'yourSecretKeyHere',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 15 * 60 * 1000 // 15 minutes
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

function authCheck(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/login.html');
}

function getSheetsClient() {
  const auth = new google.auth.JWT(
    process.env.SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

// === LOGIN ===
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const sheets = getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Users!A2:C',
  });

  const users = response.data.values || [];
  const matchedUser = users.find(row => row[0] === username && row[1] === password);

  if (matchedUser) {
    req.session.user = {
      username,
      permission: parseInt(matchedUser[2]),
    };
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// === LOGOUT ===
app.get('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// === SUBMIT ACTION (Ban/Kick/Warn) ===
app.post('/api/submit-action', authCheck, async (req, res) => {
  const { targetUser, actionType, reason, evidenceLinks, duration } = req.body;
  const user = req.session.user;

  if (
    (actionType === 'ban' && user.permission < 3) ||
    (actionType === 'kick' && user.permission < 2) ||
    (actionType === 'warn' && user.permission < 1)
  ) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }

  const timestamp = new Date();
  const formattedTime = timestamp.toLocaleString('en-US', { hour12: false });

  const row = [
    targetUser,
    actionType,
    reason,
    evidenceLinks.join(','),
    duration || '',
    user.username,
    formattedTime
  ];

  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Logs!A2',
    valueInputOption: 'RAW',
    requestBody: {
      values: [row]
    }
  });

  res.json({ success: true });
});

// === DELETE LOG ===
app.post('/api/delete-log', authCheck, async (req, res) => {
  const { rowIndex } = req.body;
  const sheets = getSheetsClient();

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 0,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1
          }
        }
      }]
    }
  });

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
