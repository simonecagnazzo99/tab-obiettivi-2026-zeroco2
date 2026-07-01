const appConfig = window.APP_CONFIG || {};

const state = {
  objectives: [],
  bu1Detail: [],
  lastUpdated: null,
  lastMessage: '',
  lastData: null,
};

const elements = {
  loginView: document.getElementById('loginView'),
  dashboardView: document.getElementById('dashboardView'),
  loginForm: document.getElementById('loginForm'),
  loginError: document.getElementById('loginError'),
  cardsGrid: document.getElementById('cardsGrid'),
  lastUpdated: document.getElementById('lastUpdated'),
  refreshButton: document.getElementById('refreshButton'),
  statusMessage: document.getElementById('statusMessage'),
};

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message || '';
  elements.statusMessage.style.color = isError ? '#ffd7cc' : 'var(--text-dim)';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(value);
      if (row.some((cell) => cell !== '')) {
        rows.push(row);
      }
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value.length || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeRows(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((header) => String(header).trim().toLowerCase());
  return rows.slice(1).filter((row) => row.some((cell) => String(cell).trim())).map((row) => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = row[index] ?? '';
    });
    return entry;
  });
}

function parseSheetPayload(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { objectives: [], bu1Detail: [] };

  if (trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed);
    const rows = data?.table?.rows || [];
    const columns = data?.table?.cols?.map((col) => col.label) || [];
    const parsed = rows.map((row) => {
      const entry = {};
      row.c?.forEach((cell, index) => {
        const value = cell?.v ?? cell?.f ?? '';
        entry[columns[index] || `col${index}`] = value;
      });
      return entry;
    });
    return { objectives: parsed, bu1Detail: [] };
  }

  const rows = parseCsv(trimmed);
  return { objectives: normalizeRows(rows), bu1Detail: [] };
}

function toNumber(value) {
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatValue(value, format, unit) {
  const number = toNumber(value);
  if (format === 'k€') {
    return `${(number / 1000).toFixed(number >= 1000 ? 0 : 2)}k€`;
  }
  if (format === 'migliaia') {
    return `${(number / 1000).toFixed(number >= 1000 ? 0 : 2)}k`;
  }
  if (format === 'ha') {
    return `${number.toLocaleString('it-IT')} ha`;
  }
  if (format === '%') {
    return `${number.toLocaleString('it-IT')}%`;
  }
  if (format === 'crediti') {
    return `${number.toLocaleString('it-IT')} crediti`;
  }
  const suffix = unit ? ` ${unit}` : '';
  return `${number.toLocaleString('it-IT')}${suffix}`.trim();
}

function computeProgress(current, target) {
  if (!target) return 0;
  const progress = Math.min(100, (current / target) * 100);
  return Number.isFinite(progress) ? progress : 0;
}

function renderCards() {
  const objectives = [...state.objectives].sort((a, b) => Number(a.ordine || a.order || 0) - Number(b.ordine || b.order || 0));
  const detailRows = state.bu1Detail || [];
  const bu1Current = detailRows.reduce((acc, row) => acc + toNumber(row.attuale), 0);

  elements.cardsGrid.innerHTML = '';

  objectives.forEach((objective) => {
    const order = String(objective.ordine || objective.order || '').padStart(2, '0');
    const title = objective.titolo || objective.title || 'Obiettivo';
    const subtitle = objective.sottotitolo || objective.subtitle || '';
    const current = toNumber(objective.valore_attuale || objective.current || 0);
    const target = toNumber(objective.valore_target || objective.target || 0);
    const unit = objective.unita || objective.unit || '';
    const format = objective.formato || objective.format || '';
    const progress = computeProgress(current, target);
    const card = document.createElement('article');
    card.className = 'card';

    let content = `
      <div class="card-number">${order}</div>
      <div class="card-head">
        <div>
          <h3>${title}</h3>
          <p>${subtitle}</p>
        </div>
        <div class="metric-value">${formatValue(order === '01' ? bu1Current : current, format, unit)}</div>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" style="width:${Math.round(progress)}%"></div>
      </div>
      <div class="progress-meta">
        <span>${Math.round(progress)}%</span>
        <span>Target ${formatValue(target, format, unit)}</span>
      </div>
    `;

    if (order === '01') {
      content += `
        <button class="toggle-button" type="button" data-toggle-card="01">Mostra dettaglio</button>
        <div class="breakdown-list hidden" id="breakdown-01">
      `;
      detailRows.forEach((row) => {
        const rowValue = toNumber(row.attuale);
        const rowTarget = toNumber(row.target || 0);
        const rowProgress = computeProgress(rowValue, rowTarget || target);
        content += `
          <div class="breakdown-item">
            <div class="breakdown-line">
              <span>${row.tipologia || row.name || 'Voce'}</span>
              <strong>${formatValue(rowValue, '€', '')}</strong>
            </div>
            <div class="breakdown-bar"><span style="width:${Math.round(rowProgress)}%"></span></div>
          </div>
        `;
      });
      content += '</div>';
    }

    if (order === '03') {
      content += '<p class="secondary-metric">o 10.000 crediti prodotti</p>';
    }

    if (order === '06') {
      const milestoneOn = current > 0;
      content += `<div class="milestone-pill">${milestoneOn ? '● Apertura seed attiva' : '○ Apertura seed non ancora avviata'}</div>`;
    }

    card.innerHTML = content;
    elements.cardsGrid.appendChild(card);
  });

  document.querySelectorAll('[data-toggle-card]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = document.getElementById(`breakdown-${button.getAttribute('data-toggle-card')}`);
      if (target) {
        target.classList.toggle('hidden');
        button.textContent = target.classList.contains('hidden') ? 'Mostra dettaglio' : 'Chiudi dettaglio';
      }
    });
  });
}

function updateTimestamp() {
  const stamp = state.lastUpdated ? new Date(state.lastUpdated).toLocaleString('it-IT') : '—';
  elements.lastUpdated.textContent = `Ultimo aggiornamento: ${stamp}`;
}

function applyData(data) {
  const objectives = Array.isArray(data?.objectives) ? data.objectives : [];
  const bu1Detail = Array.isArray(data?.bu1Detail) ? data.bu1Detail : [];
  state.objectives = objectives;
  state.bu1Detail = bu1Detail;
  state.lastUpdated = data?.lastUpdated || new Date().toISOString();
  state.lastData = data;
  renderCards();
  updateTimestamp();
}

async function fetchSheetData() {
  const objectiveUrl = appConfig.dataSources?.obiettivi || appConfig.dataSourceUrl || '';
  const detailUrl = appConfig.dataSources?.bu1_dettaglio || '';

  if (!objectiveUrl && !detailUrl) {
    applyData({
      objectives: appConfig.fallbackData?.objectives || [],
      bu1Detail: appConfig.fallbackData?.bu1Detail || [],
      lastUpdated: new Date().toISOString(),
    });
    setStatus('Nessun URL del foglio configurato. Viene mostrato il contenuto di esempio.');
    return;
  }

  try {
    const [objectiveResponse, detailResponse] = await Promise.all([
      objectiveUrl ? fetch(objectiveUrl, { cache: 'no-store' }) : Promise.resolve(null),
      detailUrl ? fetch(detailUrl, { cache: 'no-store' }) : Promise.resolve(null),
    ]);

    if (objectiveResponse && !objectiveResponse.ok) throw new Error('Impossibile leggere il foglio obiettivi');
    if (detailResponse && !detailResponse.ok) throw new Error('Impossibile leggere il dettaglio BU1');

    const objectiveText = objectiveResponse ? await objectiveResponse.text() : '';
    const detailText = detailResponse ? await detailResponse.text() : '';
    const parsedObjectives = parseSheetPayload(objectiveText).objectives;
    const parsedBu1Detail = detailText ? parseSheetPayload(detailText).objectives : [];

    applyData({
      objectives: parsedObjectives.length ? parsedObjectives : appConfig.fallbackData?.objectives || [],
      bu1Detail: parsedBu1Detail.length ? parsedBu1Detail : appConfig.fallbackData?.bu1Detail || [],
      lastUpdated: new Date().toISOString(),
    });
    setStatus('Dati caricati dal foglio Google Sheets.');
  } catch (error) {
    const fallback = appConfig.fallbackData || { objectives: [], bu1Detail: [] };
    applyData({
      objectives: fallback.objectives || [],
      bu1Detail: fallback.bu1Detail || [],
      lastUpdated: state.lastUpdated || new Date().toISOString(),
    });
    setStatus(`Impossibile aggiornare dal foglio. Mostro l'ultimo contenuto disponibile. ${error.message}`, true);
  }
}

async function verifyPassword(password) {
  const localPassword = appConfig.sharedPassword || '';

  try {
    const response = await fetch('/.netlify/functions/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      return true;
    }

    const payload = await response.json().catch(() => ({}));
    if (localPassword && password === localPassword) {
      return true;
    }

    throw new Error(payload.error || 'Password non corretta');
  } catch (error) {
    if (localPassword && password === localPassword) {
      return true;
    }
    throw error;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const password = new FormData(event.currentTarget).get('password');
  elements.loginError.textContent = '';

  try {
    await verifyPassword(String(password));
    elements.loginView.classList.add('hidden');
    elements.dashboardView.classList.remove('hidden');
    await fetchSheetData();
  } catch (error) {
    elements.loginError.textContent = error.message;
  }
}

function bootstrap() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.refreshButton.addEventListener('click', fetchSheetData);
  if (appConfig.fallbackData) {
    applyData({
      objectives: appConfig.fallbackData.objectives || [],
      bu1Detail: appConfig.fallbackData.bu1Detail || [],
      lastUpdated: new Date().toISOString(),
    });
  }
}

bootstrap();
