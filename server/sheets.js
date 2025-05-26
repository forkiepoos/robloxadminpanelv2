const { google } = require('googleapis');
const sheets = google.sheets('v4');
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SHEET_ID = process.env.SHEET_ID;

async function getSheetRows(sheetName) {
  const client = await auth.getClient();
  const res = await sheets.spreadsheets.values.get({
    auth: client,
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1:Z1000`,
  });
  const [headers, ...rows] = res.data.values;
  return rows.map(row =>
    headers.reduce((acc, header, i) => {
      acc[header] = row[i] || '';
      return acc;
    }, {})
  );
}

async function appendToSheet(sheetName, values) {
  const client = await auth.getClient();
  return sheets.spreadsheets.values.append({
    auth: client,
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [values] },
  });
}

async function deleteRow(sheetName, rowIndex) {
  const client = await auth.getClient();
  return sheets.spreadsheets.batchUpdate({
    auth: client,
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await getSheetIdByName(sheetName),
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}

async function getSheetIdByName(sheetName) {
  const client = await auth.getClient();
  const metadata = await sheets.spreadsheets.get({
    auth: client,
    spreadsheetId: SHEET_ID,
  });
  const sheet = metadata.data.sheets.find(s => s.properties.title === sheetName);
  return sheet.properties.sheetId;
}

module.exports = {
  getSheetRows,
  appendToSheet,
  deleteRow,
};
