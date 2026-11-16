// Saves form submissions as new rows in the client's Google Sheet.
//
// The website signs in to Google as its own "service account" (a robot Google
// account), so saving keeps working no matter who else has access to the
// spreadsheet. Two Cloudflare secrets set it up (never write them into a file):
// - GOOGLE_SERVICE_ACCOUNT_KEY: the service account's JSON key
// - GOOGLE_SHEET_ID: the spreadsheet's ID, from its address:
//   docs.google.com/spreadsheets/d/<THIS PART>/edit
// The spreadsheet must be shared with the service account's email as Editor.
//
// Each form writes to its own tab (the `sheet` name in FORMS, src/submit.js).
// Columns: Submitted, then each form field in order, then Page. Columns to the
// right of those are free for the client's own notes.

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

let cachedToken = { value: '', expires: 0 };
const timeZones = new Map();

export const sheetsConfigured = (env) => Boolean(env.GOOGLE_SERVICE_ACCOUNT_KEY && env.GOOGLE_SHEET_ID);

// GOOGLE_SHEETS_API_URL exists only so the code can be tested against a stand-in for Google.
const apiBase = (env) => env.GOOGLE_SHEETS_API_URL || SHEETS_API;

const base64url = (bytes) => {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const encodeJson = (value) => base64url(new TextEncoder().encode(JSON.stringify(value)));

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken.value && cachedToken.expires - 60 > now) return cachedToken.value;

  const key = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const tokenUrl = key.token_uri || 'https://oauth2.googleapis.com/token';
  const unsigned = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({
    iss: key.client_email,
    scope: SCOPE,
    aud: tokenUrl,
    iat: now,
    exp: now + 3600,
  })}`;

  const pem = key.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signingKey, new TextEncoder().encode(unsigned));

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${base64url(new Uint8Array(signature))}`,
    }),
  });
  if (!response.ok) throw new Error(`Google sign-in failed (${response.status}): ${await response.text()}`);
  const data = await response.json();
  cachedToken = { value: data.access_token, expires: now + (data.expires_in || 3600) };
  return cachedToken.value;
}

// Times are written in the spreadsheet's own time zone (File > Settings), so
// they match the clock of whoever owns the sheet.
async function getTimeZone(env, token) {
  if (timeZones.has(env.GOOGLE_SHEET_ID)) return timeZones.get(env.GOOGLE_SHEET_ID);
  let zone = 'UTC';
  try {
    const response = await fetch(`${apiBase(env)}/${env.GOOGLE_SHEET_ID}?fields=properties.timeZone`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) zone = (await response.json()).properties?.timeZone || 'UTC';
    else console.error(`Could not read the spreadsheet's time zone (${response.status}), using UTC.`);
  } catch (error) {
    console.error("Could not read the spreadsheet's time zone, using UTC.", error);
  }
  timeZones.set(env.GOOGLE_SHEET_ID, zone);
  return zone;
}

// Google Sheets stores dates as days since 30 December 1899, in local time.
function toSheetDate(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (local - Date.UTC(1899, 11, 30)) / 86400000;
}

const columnLetter = (index) => {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
};

// values: the form's field values, in the order of its fields
export async function saveToSheet(env, form, values, page) {
  const token = await getAccessToken(env);
  const timeZone = await getTimeZone(env, token);
  const row = [toSheetDate(new Date(), timeZone), ...values, page];
  const tab = `'${form.sheet.replace(/'/g, "''")}'`;
  const range = `${tab}!A:${columnLetter(row.length - 1)}`;

  // RAW keeps every value as typed, so text that looks like a formula is never run.
  const response = await fetch(
    `${apiBase(env)}/${env.GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    },
  );
  if (!response.ok) throw new Error(`Google Sheets answered ${response.status}: ${await response.text()}`);
}
