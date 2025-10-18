/**
 * email/mailer.js
 * Thin mailer with retries and basic templates.
 */
const { createTransporter } = require('./config');
const fs = require('fs');
const path = require('path');

const { transporter, defaults } = createTransporter();

function loadTemplate(name){
  const baseDir = path.join(__dirname, 'templates');
  const html = fs.readFileSync(path.join(baseDir, `${name}.html`), 'utf8');
  const text = fs.readFileSync(path.join(baseDir, `${name}.txt`), 'utf8');
  return { html, text };
}

function render(str, data){
  return str.replace(/{{\s*(\w+)\s*}}/g, (_, k)=> (data?.[k] ?? ''));
}

async function withRetry(fn, retries=3){
  let attempt = 0;
  let lastErr;
  const backoff = (n)=> new Promise(r=> setTimeout(r, Math.min(15000, 300 * Math.pow(2, n))));
  while (attempt <= retries){
    try {
      return await fn();
    } catch(e){
      lastErr = e;
      if (attempt === retries) break;
      await backoff(attempt);
      attempt++;
    }
  }
  throw lastErr;
}

/**
 * sendAlertEmail(to, payload)
 * payload: { title, deviceName, level, timeISO, detailsUrl }
 */
async function sendAlertEmail(to, payload){
  const tpl = loadTemplate('alert');
  const subject = `[ApagaNet] ${payload.level || 'info'}: ${payload.title}`;
  const html = render(tpl.html, payload);
  const text = render(tpl.text, payload);

  const info = await withRetry(() => transporter.sendMail({
    from: defaults.from,
    to,
    replyTo: defaults.replyTo,
    subject,
    text,
    html,
  }));

  return info;
}

/** Health and test helpers */
async function verify(){
  return withRetry(() => transporter.verify());
}

async function sendTest(to){
  return withRetry(() => transporter.sendMail({
    from: defaults.from,
    to,
    subject: 'ApagaNet SMTP Test ✔',
    text: 'Si lees esto, tu SMTP está funcionando.',
    html: '<p>Si lees esto, tu <strong>SMTP</strong> está funcionando.</p>'
  }));
}

module.exports = { sendAlertEmail, verify, sendTest };
