// Receives website form submissions, saves them in the client's Google Sheet
// and posts them to Slack. Runs on Cloudflare at /api/submit (see src/worker.js).
//
// The addresses and keys come from secrets set in Cloudflare under the Worker's
// Settings > Variables and Secrets. Never write them into this file:
// - SLACK_WEBHOOK_URL
// - GOOGLE_SERVICE_ACCOUNT_KEY and GOOGLE_SHEET_ID (see src/sheets.js)
// Either destination can be left out. If one fails, the other still gets the
// submission, and the Slack message says when the spreadsheet missed it.
//
// To add a form: add an entry to FORMS below (`sheet` is the spreadsheet tab it
// saves to), add that tab to the spreadsheet with the header row Submitted,
// each field label in order, Page. Then give the <form> a matching
// data-form="..." attribute and the hidden "company" spam-trap field.

import { saveToSheet, sheetsConfigured } from './sheets.js';

const FORMS = {
  waitlist: {
    title: '🎨 New studio waitlist signup',
    sheet: 'Waitlist',
    fields: [{ name: 'email', label: 'Email', required: true, type: 'email', maxLength: 254 }],
  },
};

const SPAM_TRAP_FIELD = 'company';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DEFAULT_MAX_LENGTH = 2000;
const MAX_BODY_LENGTH = 20000;

// Slack treats &, < and > as control characters.
const escapeSlack = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const reply = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

export async function handleSubmit(request, env) {
  if (request.method !== 'POST') {
    return reply(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
  }

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_LENGTH) return reply(413, { ok: false, error: 'Submission is too long.' });
    payload = JSON.parse(raw);
  } catch {
    return reply(400, { ok: false, error: 'Invalid request.' });
  }
  if (!payload || typeof payload !== 'object') {
    return reply(400, { ok: false, error: 'Invalid request.' });
  }

  const formId = typeof payload.form === 'string' ? payload.form : '';
  const form = Object.hasOwn(FORMS, formId) ? FORMS[formId] : null;
  if (!form) return reply(400, { ok: false, error: 'Unknown form.' });

  const input = payload.fields && typeof payload.fields === 'object' ? payload.fields : {};

  // Bots fill in the hidden field. Pretend it worked and send nothing.
  if (typeof input[SPAM_TRAP_FIELD] === 'string' && input[SPAM_TRAP_FIELD].trim() !== '') {
    return reply(200, { ok: true });
  }

  const lines = [];
  const values = [];
  for (const field of form.fields) {
    const value = typeof input[field.name] === 'string' ? input[field.name].trim() : '';
    values.push(value);
    if (!value) {
      if (field.required) return reply(400, { ok: false, error: `${field.label} is required.` });
      continue;
    }
    if (value.length > (field.maxLength ?? DEFAULT_MAX_LENGTH)) {
      return reply(400, { ok: false, error: `${field.label} is too long.` });
    }
    if (field.type === 'email' && !EMAIL_PATTERN.test(value)) {
      return reply(400, { ok: false, error: 'Please enter a valid email address.' });
    }
    lines.push(`*${field.label}:* ${escapeSlack(value)}`);
  }

  const webhookUrl = env.SLACK_WEBHOOK_URL;
  const useSheet = sheetsConfigured(env) && Boolean(form.sheet);
  if (!webhookUrl && !useSheet) {
    console.error('Neither Slack nor Google Sheets is set up, so the submission was not delivered.');
    return reply(500, { ok: false, error: 'The form is not connected yet.' });
  }

  const page = typeof payload.page === 'string' ? payload.page.slice(0, 200) : '/';

  // 1. Save to the spreadsheet
  let savedToSheet = false;
  if (useSheet) {
    try {
      await saveToSheet(env, form, values, page);
      savedToSheet = true;
    } catch (error) {
      console.error('Could not save the submission to Google Sheets.', error);
    }
  }

  // 2. Tell Slack (with a warning if the spreadsheet missed it)
  let sentToSlack = false;
  if (webhookUrl) {
    const context = [{ type: 'mrkdwn', text: `Sent from the website, page \`${escapeSlack(page)}\`` }];
    if (useSheet && !savedToSheet) {
      context.push({ type: 'mrkdwn', text: '⚠️ This one could not be saved to the spreadsheet. Please add it by hand.' });
    }
    const message = {
      text: `${form.title}\n${lines.join('\n')}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: form.title, emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
        { type: 'context', elements: context },
      ],
    };
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (response.ok) sentToSlack = true;
      else console.error(`Slack answered ${response.status}: ${await response.text()}`);
    } catch (error) {
      console.error('Could not reach Slack.', error);
    }
  }

  if (!savedToSheet && !sentToSlack) {
    return reply(502, { ok: false, error: 'Could not deliver the submission.' });
  }
  return reply(200, { ok: true });
}
