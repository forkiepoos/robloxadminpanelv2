// server.js
import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 15 * 60 * 1000 }, // 15 minutes
  })
);

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]; // full access
const doc = new GoogleSpreadsheet(process.env.SHEET_ID);
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: SCOPES,
});

async function accessSheet() {
  await doc.useServiceAccountAuth(serviceAccountAuth);
  await doc.loadInfo();
  return doc;
}

// Utility function to format timestamp
function formatTimestamp(date) {
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ---------------- LOGIN ----------------
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle["Users"];
  await sheet.loadCells();
  const rows = await sheet.getRows();
  const user = rows.find(
    (row) => row.Username === username && row.Password === password
  );
  if (user) {
    req.session.user = { username, level: parseInt(user.PermissionLevel) };
    res.json({ success: true, level: user.PermissionLevel });
  } else {
    res.json({ success: false });
  }
});

// ---------------- LOGOUT ----------------
app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ---------------- SUBMIT LOG ----------------
app.post("/api/submit", async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).send("Unauthorized");

  const { type, reason, target, evidence, duration } = req.body;
  if (!reason || !target || evidence.length !== 3) {
    return res.status(400).send("Missing required fields");
  }

  const timestamp = formatTimestamp(new Date());
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle["Logs"];
  await sheet.addRow({
    ActionType: type,
    Reason: reason,
    Target: target,
    Evidence1: evidence[0],
    Evidence2: evidence[1],
    Evidence3: evidence[2],
    IssuedBy: user.username,
    Duration: type === "Ban" ? duration : "",
    Timestamp: timestamp,
  });
  res.json({ success: true });
});

// ---------------- GET LOGS ----------------
app.get("/api/logs", async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).send("Unauthorized");
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle["Logs"];
  const rows = await sheet.getRows();
  const logs = rows.map((row, index) => ({ id: index + 2, ...row._rawData }));
  res.json(logs.reverse());
});

// ---------------- DELETE LOG ----------------
app.post("/api/delete-log", async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).send("Unauthorized");
  const { rowId } = req.body;
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle["Logs"];
  await sheet.loadCells();
  await sheet.deleteRow(parseInt(rowId) - 2);
  res.json({ success: true });
});

// ---------------- SUBMIT BAN REQUEST ----------------
app.post("/api/submit-ban-request", async (req, res) => {
  const user = req.session.user;
  if (!user || user.level >= 3) return res.status(401).send("Unauthorized");
  const { reason, target, evidence, duration } = req.body;
  if (!reason || !target || evidence.length !== 3) return res.status(400).send("Missing fields");
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle["BanRequests"];
  await sheet.addRow({
    Target: target,
    Reason: reason,
    Evidence1: evidence[0],
    Evidence2: evidence[1],
    Evidence3: evidence[2],
    Duration: duration,
    RequestedBy: user.username,
    Status: "Pending",
    Timestamp: formatTimestamp(new Date()),
  });
  res.json({ success: true });
});

// ---------------- GET BAN REQUESTS ----------------
app.get("/api/get-ban-requests", async (req, res) => {
  const user = req.session.user;
  if (!user || user.level < 3) return res.status(401).send("Unauthorized");
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle["BanRequests"];
  const rows = await sheet.getRows();
  res.json(rows.map((r, i) => ({ id: i + 2, ...r._rawData })).reverse());
});

// ---------------- APPROVE/DENY BAN REQUEST ----------------
app.post("/api/update-ban-request", async (req, res) => {
  const user = req.session.user;
  if (!user || user.level < 3) return res.status(401).send("Unauthorized");
  const { rowId, action } = req.body;
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle["BanRequests"];
  const rows = await sheet.getRows();
  const row = rows[parseInt(rowId) - 2];
  row.Status = action;
  await row.save();
  res.json({ success: true });
});

// ---------------- MY BAN REQUESTS ----------------
app.get("/api/my-ban-requests", async (req, res) => {
  const user = req.session.user;
  if (!user || user.level >= 3) return res.status(401).send("Unauthorized");
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle["BanRequests"];
  const rows = await sheet.getRows();
  const mine = rows.filter((r) => r.RequestedBy === user.username);
  res.json(mine.map((r, i) => ({ id: i + 2, ...r._rawData })).reverse());
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
