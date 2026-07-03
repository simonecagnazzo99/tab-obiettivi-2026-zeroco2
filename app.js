const appConfig = window.APP_CONFIG || {};

const state = {
  objectives: [],
  bu1Detail: [],
  selvaTasks: [],
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

function formatToK(value) {
  const number = Number(value);
  const result = number / 1000;
  if (result === 0) return '0';
  if (Number.isInteger(result)) return result.toLocaleString('it-IT');
  return result.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatValue(value, format, unit) {
  const number = toNumber(value);
  if (format === 'k€') {
    return `${formatToK(number)}k€`;
  }
  if (format === 'migliaia') {
    return `${formatToK(number)}k`;
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
  if (unit === '€') {
    return `${number.toLocaleString('it-IT')} €`;
  }
  const suffix = unit ? ` ${unit}` : '';
  return `${number.toLocaleString('it-IT')}${suffix}`.trim();
}

function computeProgress(current, target) {
  if (!target) return 0;
  const progress = Math.min(100, (current / target) * 100);
  return Number.isFinite(progress) ? progress : 0;
}

function formatChangePercent(current, previous) {
  if (previous === 0 || previous === null || previous === undefined) return '';
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  return Number.isFinite(percent) ? `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%` : '';
}

function getMetricValue(source, keys) {
  const normalized = Object.keys(source).reduce((acc, key) => {
    acc[key.toLowerCase().replace(/\s+/g, '_')] = source[key];
    return acc;
  }, {});

  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
    if (normalized[normalizedKey] !== undefined && normalized[normalizedKey] !== '') {
      return toNumber(normalized[normalizedKey]) || normalized[normalizedKey];
    }
  }

  return '';
}

function sumPhaseValues(tasks, phasePattern) {
  return tasks.reduce((sum, task) => {
    const phase = String(task.phase || task.Phase || task.phase_name || '').toLowerCase();
    if (phasePattern.test(phase)) {
      return sum + toNumber(task.current || task.Current || task.attuale || 0);
    }
    return sum;
  }, 0);
}

function sumPhasePreviousValues(tasks, phasePattern) {
  return tasks.reduce((sum, task) => {
    const phase = String(task.phase || task.Phase || task.phase_name || '').toLowerCase();
    if (phasePattern.test(phase)) {
      return sum + toNumber(task.previous || task.Previous || task.precedente || 0);
    }
    return sum;
  }, 0);
}

function renderCards() {
  const objectives = [...state.objectives].sort((a, b) => Number(a.ordine || a.order || 0) - Number(b.ordine || b.order || 0));
  const detailRows = state.bu1Detail || [];
  const detailRowsFiltered = detailRows.filter((row) => {
    const type = String(row.tipologia || row.name || row.category || '').toLowerCase();
    return !type.includes('zerocarbon');
  });
  const bu1Current = detailRowsFiltered.reduce((acc, row) => acc + toNumber(row.attuale || row.current || 0), 0);

  elements.cardsGrid.innerHTML = '';

  if (!objectives.length) {
    elements.cardsGrid.innerHTML = `
      <div class="card">
        <p class="task-summary">No objective data loaded. Check Google Sheet format or config.js.</p>
      </div>
    `;
    return;
  }

  objectives.forEach((objective) => {
    const order = String(objective.ordine || objective.order || '').padStart(2, '0');
    const current = toNumber(objective.valore_attuale || objective.current || 0);
    const target = toNumber(objective.valore_target || objective.target || 0);
    const unit = objective.unita || objective.unit || '';
    const format = objective.formato || objective.format || '';
    const detailCurrent = detailRowsFiltered.reduce((acc, row) => acc + toNumber(row.attuale || row.current || 0), 0);
    const detailPrevious = detailRowsFiltered.reduce((acc, row) => acc + toNumber(row.precedente || row.previous || 0), 0);
    const displayCurrent = order === '01' ? (detailCurrent || current) : current;
    const previousCurrent = order === '01'
      ? detailPrevious || toNumber(objective.valore_precedente || objective.previous || 0)
      : toNumber(objective.valore_precedente || objective.previous || 0);
    const weeklyDelta = previousCurrent ? displayCurrent - previousCurrent : 0;
    const weeklyPercent = formatChangePercent(displayCurrent, previousCurrent);
    const progress = computeProgress(displayCurrent, target);
    const card = document.createElement('article');
    card.className = 'card';

    const title = order === '06' ? 'Fundraising' : order === '03' ? 'Selva Ha in Platform' : objective.titolo || objective.title || 'Goal';
    const taskList = state.selvaTasks || [];
    const selvaCompleted = taskList.filter((task) => {
      const status = String(task.status || task.Status || '').trim().toLowerCase();
      return status === 'done' || status === 'completed' || status === 'yes' || status === '1';
    }).length;
    const selvaTotal = taskList.length;
    const selvaDelta = taskList.reduce((acc, task) => {
      const current = toNumber(task.current || task.Current || 0);
      const previous = toNumber(task.previous || task.Previous || 0);
      return acc + current - previous;
    }, 0);

    let content = `
      <div class="card-number">${order}</div>
      <div class="card-head">
        <div>
          <h3>${title}</h3>
        </div>
        <div class="metric-value">${formatValue(displayCurrent, format, unit)}</div>
      </div>
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" style="width:${Math.round(progress)}%"></div>
      </div>
      <div class="progress-meta">
        <span>${Math.round(progress)}%</span>
        <span>Target ${formatValue(target, format, unit)}</span>
      </div>
    `;

    if (order === '05') {
      content += `
        <p class="task-summary">Status: ongoing</p>
        <p class="task-summary">${selvaTotal ? `${selvaCompleted}/${selvaTotal} tasks complete` : 'No tasks available yet'}</p>
        ${selvaDelta ? `<p class="task-summary">Weekly delta: ${selvaDelta > 0 ? '+' : ''}${selvaDelta}</p>` : ''}
      `;
    }

    const shouldShowWeekly = order === '01' || order === '02' || order === '03';
    if (shouldShowWeekly && previousCurrent !== '' && previousCurrent !== null && previousCurrent !== undefined) {
      content += `
        <p class="task-summary weekly-change">
          Weekly change: ${weeklyDelta >= 0 ? '+' : ''}${formatValue(weeklyDelta, format, unit)}
          ${weeklyPercent ? `<span class="weekly-change-percent">(${weeklyPercent})</span>` : ''}
        </p>
      `;
    }

    if (order === '01') {
      content += `
        <button class="toggle-button" type="button" data-toggle-card="01">Show details</button>
        <div class="breakdown-list hidden" id="breakdown-01">
      `;

      detailRowsFiltered.forEach((row) => {
        const rowName = row.tipologia || row.name || row.category || 'Item';
        const rowValue = toNumber(row.attuale || row.current || 0);
        const previousValue = toNumber(row.precedente || row.previous || 0);
        const delta = rowValue - previousValue;
        const deltaLabel = `${delta >= 0 ? '+' : ''}${formatValue(delta, '', '€')}`;
        content += `
          <div class="breakdown-item">
            <div class="breakdown-line breakdown-line-small">
              <span>${rowName}</span>
              <strong>${formatValue(rowValue, '', '€')}</strong>
            </div>
            <div class="breakdown-detail">
              <span class="breakdown-delta">${deltaLabel}</span>
              <span class="breakdown-prev">last week ${formatValue(previousValue, '', '€')}</span>
            </div>
          </div>
        `;
      });

      content += '</div>';
    }

    if (order === '03') {
      const feasibilityCurrent = getMetricValue(objective, ['ha_feasibility', 'ha_in_feasibility', 'feasibility_ha', 'feasibility', 'attuale_feasibility']);
      const feasibilityPrevious = getMetricValue(objective, ['previous_feasibility', 'precedente_feasibility', 'feasibility_previous']);
      const identifiedCurrent = getMetricValue(objective, ['ha_identified', 'ha_in_identified', 'identified_ha', 'identified', 'attuale_identified']);
      const identifiedPrevious = getMetricValue(objective, ['previous_identified', 'precedente_identified', 'identified_previous']);

      const feasibilityFromTasks = sumPhaseValues(state.selvaTasks, /feasibility/i);
      const feasibilityPrevFromTasks = sumPhasePreviousValues(state.selvaTasks, /feasibility/i);
      const identifiedFromTasks = sumPhaseValues(state.selvaTasks, /identified|identify/i);
      const identifiedPrevFromTasks = sumPhasePreviousValues(state.selvaTasks, /identified|identify/i);
      const rejectedCurrent = sumPhaseValues(state.selvaTasks, /rejected|reject|rifiutati/i);

      const feaCurrent = feasibilityCurrent !== '' ? feasibilityCurrent : feasibilityFromTasks;
      const feaPrevious = feasibilityPrevious !== '' ? feasibilityPrevious : feasibilityPrevFromTasks;
      const idCurrent = identifiedCurrent !== '' ? identifiedCurrent : identifiedFromTasks;
      const idPrevious = identifiedPrevious !== '' ? identifiedPrevious : identifiedPrevFromTasks;
      const feaDelta = feaPrevious ? feaCurrent - feaPrevious : 0;
      const idDelta = idPrevious ? idCurrent - idPrevious : 0;
      const feaDeltaLabel = feaPrevious ? `${feaDelta >= 0 ? '+' : ''}${formatValue(feaDelta, '', 'ha')}` : '';
      const idDeltaLabel = idPrevious ? `${idDelta >= 0 ? '+' : ''}${formatValue(idDelta, '', 'ha')}` : '';

      content += `
        <div class="small-metrics">
          <div class="small-metric-card">
            <h4>Ha feasibility</h4>
            <p class="metric-value small-metric-value">${formatValue(feaCurrent, '', 'ha')}</p>
            ${feaDeltaLabel ? `<p class="metric-detail">${feaDeltaLabel} vs last week</p>` : ''}
          </div>
          <div class="small-metric-card">
            <h4>Ha identified</h4>
            <p class="metric-value small-metric-value">${formatValue(idCurrent, '', 'ha')}</p>
            ${idDeltaLabel ? `<p class="metric-detail">${idDeltaLabel} vs last week</p>` : ''}
          </div>
          <div class="small-metric-card rejected">
            <h4>Ha rejected</h4>
            <p class="metric-value small-metric-value">${formatValue(rejectedCurrent, '', 'ha')}</p>
          </div>
        </div>
      `;
    }

    card.innerHTML = content;
    elements.cardsGrid.appendChild(card);
  });

  document.querySelectorAll('[data-toggle-card]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = document.getElementById(`breakdown-${button.getAttribute('data-toggle-card')}`);
      if (target) {
        target.classList.toggle('hidden');
        button.textContent = target.classList.contains('hidden') ? 'Show details' : 'Hide details';
      }
    });
  });
}

function updateTimestamp() {
  const stamp = state.lastUpdated ? new Date(state.lastUpdated).toLocaleString('it-IT') : '—';
  elements.lastUpdated.textContent = `Last update: ${stamp}`;
}

function applyData(data) {
  const objectives = Array.isArray(data?.objectives) ? data.objectives : [];
  const bu1Detail = Array.isArray(data?.bu1Detail) ? data.bu1Detail : [];
  const selvaTasks = Array.isArray(data?.selvaTasks) ? data.selvaTasks : [];
  state.objectives = objectives;
  state.bu1Detail = bu1Detail;
  state.selvaTasks = selvaTasks;
  state.lastUpdated = data?.lastUpdated || new Date().toISOString();
  state.lastData = data;
  renderCards();
  updateTimestamp();
}

async function fetchSheetData() {
  const objectiveUrl = appConfig.dataSources?.obiettivi || appConfig.dataSourceUrl || '';
  const detailUrl = appConfig.dataSources?.bu1_dettaglio || '';
  const selvaUrl = appConfig.dataSources?.selva_tasks || '';

  if (!objectiveUrl && !detailUrl) {
    applyData({
      objectives: appConfig.fallbackData?.objectives || [],
      bu1Detail: appConfig.fallbackData?.bu1Detail || [],
      lastUpdated: new Date().toISOString(),
    });
    setStatus('No sheet URLs configured. Showing example data.');
    return;
  }

  try {
    const [objectiveResponse, detailResponse, selvaResponse] = await Promise.all([
      objectiveUrl ? fetch(objectiveUrl, { cache: 'no-store' }) : Promise.resolve(null),
      detailUrl ? fetch(detailUrl, { cache: 'no-store' }) : Promise.resolve(null),
      selvaUrl ? fetch(selvaUrl, { cache: 'no-store' }) : Promise.resolve(null),
    ]);

    if (objectiveResponse && !objectiveResponse.ok) throw new Error('Unable to read objectives sheet');
    if (detailResponse && !detailResponse.ok) throw new Error('Unable to read BU1 detail sheet');
    if (selvaResponse && !selvaResponse.ok) throw new Error('Unable to read Selva tasks sheet');

    const objectiveText = objectiveResponse ? await objectiveResponse.text() : '';
    const detailText = detailResponse ? await detailResponse.text() : '';
    const selvaText = selvaResponse ? await selvaResponse.text() : '';
    const parsedObjectives = objectiveText ? parseSheetPayload(objectiveText).objectives : [];
    const parsedBu1Detail = detailText ? parseSheetPayload(detailText).objectives : [];
    const parsedSelvaTasks = selvaText ? parseSheetPayload(selvaText).objectives : [];

    applyData({
      objectives: parsedObjectives.length ? parsedObjectives : appConfig.fallbackData?.objectives || [],
      bu1Detail: parsedBu1Detail.length ? parsedBu1Detail : appConfig.fallbackData?.bu1Detail || [],
      selvaTasks: parsedSelvaTasks.length ? parsedSelvaTasks : appConfig.fallbackData?.selvaTasks || [],
      lastUpdated: new Date().toISOString(),
    });
    setStatus('');
  } catch (error) {
    const fallback = appConfig.fallbackData || { objectives: [], bu1Detail: [] };
    applyData({
      objectives: fallback.objectives || [],
      bu1Detail: fallback.bu1Detail || [],
      lastUpdated: state.lastUpdated || new Date().toISOString(),
    });
    setStatus(`Unable to refresh from sheet. Showing the last available data. ${error.message}`, true);
  }
}

async function verifyPassword(password) {
  return true;
}

async function handleLogin(event) {
  event.preventDefault();
  await fetchSheetData();
}

function bootstrap() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.refreshButton.addEventListener('click', fetchSheetData);

  elements.loginView.classList.add('hidden');
  elements.dashboardView.classList.remove('hidden');
  setStatus('Loading live sheet data...');
  fetchSheetData().catch((error) => {
    console.error('Initial sheet load failed:', error);
  });
}

bootstrap();
