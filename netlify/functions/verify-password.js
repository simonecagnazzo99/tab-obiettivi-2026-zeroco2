const fs = require('fs');
const path = require('path');

function loadConfiguredPassword() {
  const configPath = path.resolve(__dirname, '../../config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    return config.sharedPassword || '';
  } catch (error) {
    return '';
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Metodo non consentito' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const configuredPassword = process.env.SHARED_PASSWORD || loadConfiguredPassword();
  let payload = {};

  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    payload = {};
  }

  const password = String(payload.password || '').trim();

  if (!configuredPassword) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Password non configurata. Imposta SHARED_PASSWORD o config.json.' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  if (password === configuredPassword) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  return {
    statusCode: 401,
    body: JSON.stringify({ error: 'Password non corretta' }),
    headers: { 'Content-Type': 'application/json' },
  };
};
