const halls = {
  melia: createHall('מליאה'),
  hall1: createHall('אולם 1'),
  hall2: createHall('אולם 2'),
  hall3: createHall('אולם 3'),
};

const STORAGE_KEY = 'military-medicine-conference-timer';
const DEVICE_HALL_KEY = 'military-medicine-conference-device-hall';
const SCHEDULE_FILE_PATH = 'אולמות.xlsx';

let selectedHallKey = 'melia';
let deviceHallKey = localStorage.getItem(DEVICE_HALL_KEY) || 'melia';
let wakeLockSentinel = null;

restoreState();
loadScheduleFromSpreadsheet().catch((error) => {
  console.error('Unable to load schedule from spreadsheet', error);
});

const hallSelect = document.getElementById('hallSelect');
const speakerForm = document.getElementById('speakerForm');
const speakerNameInput = document.getElementById('speakerName');
const lectureTopicInput = document.getElementById('lectureTopic');
const lectureMinutesInput = document.getElementById('lectureMinutes');
const speakerListContainer = document.getElementById('speakerListContainer');
const activeHallName = document.getElementById('activeHallName');
const currentSpeakerLabel = document.getElementById('currentSpeakerLabel');
const currentTopicLabel = document.getElementById('currentTopicLabel');
const currentTimeLabel = document.getElementById('currentTimeLabel');
const startPauseButton = document.getElementById('startPauseButton');
const resetButton = document.getElementById('resetButton');
const prevSpeakerButton = document.getElementById('prevSpeakerButton');
const nextSpeakerButton = document.getElementById('nextSpeakerButton');
const timerHallName = document.getElementById('timerHallName');
const timerSpeakerName = document.getElementById('timerSpeakerName');
const timerTopic = document.getElementById('timerTopic');
const timerRemaining = document.getElementById('timerRemaining');
const timerProgress = document.getElementById('timerProgress');
const tabButtons = document.querySelectorAll('.tab-button');
const managementScreen = document.getElementById('managementScreen');
const timerScreen = document.getElementById('timerScreen');
const fullscreenButton = document.getElementById('fullscreenButton');
const wakeLockButton = document.getElementById('wakeLockButton');
const setActiveHallButton = document.getElementById('setActiveHall');

hallSelect.value = selectedHallKey;
activeHallName.textContent = halls[selectedHallKey].name;
updateTimerScreenHallName();
renderSpeakerList();
updateStatusDisplay();
updateStartPauseLabel();

speakerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = speakerNameInput.value.trim();
  const topic = lectureTopicInput.value.trim();
  const minutes = parseInt(lectureMinutesInput.value, 10);

  if (!name || !topic || Number.isNaN(minutes) || minutes <= 0) {
    alert('נא למלא את כל השדות ולציין משך זמן חיובי.');
    return;
  }

  const hall = halls[selectedHallKey];
  hall.speakers.push({
    id: generateId(),
    name,
    date: '',
    startTime: '',
    endTime: '',
    topic,
    durationSeconds: minutes * 60,
    remainingSeconds: minutes * 60,
  });

  if (hall.currentIndex === -1) {
    hall.currentIndex = 0;
  }

  saveState();
  renderSpeakerList();
  updateStatusDisplay();
  speakerForm.reset();
  lectureMinutesInput.value = minutes;
  hallSelect.value = selectedHallKey;
});

hallSelect.addEventListener('change', (event) => {
  selectedHallKey = event.target.value;
  activeHallName.textContent = halls[selectedHallKey].name;
  renderSpeakerList();
  updateStatusDisplay();
  updateStartPauseLabel();
});

startPauseButton.addEventListener('click', () => {
  const hall = halls[selectedHallKey];
  if (!hall.speakers.length) {
    alert('הוסף קודם מרצה לרשימה.');
    return;
  }

  if (hall.currentIndex === -1) {
    hall.currentIndex = 0;
  }

  if (hall.timer.isRunning) {
    pauseTimer(hall);
  } else {
    startTimer(hall);
  }
  updateStartPauseLabel();
});

resetButton.addEventListener('click', () => {
  const hall = halls[selectedHallKey];
  if (hall.currentIndex === -1) {
    return;
  }
  resetCurrentSpeaker(hall);
  saveState();
  updateStatusDisplay();
  updateStartPauseLabel();
});

prevSpeakerButton.addEventListener('click', () => {
  const hall = halls[selectedHallKey];
  if (hall.currentIndex > 0) {
    hall.currentIndex -= 1;
    resetCurrentSpeaker(hall);
    renderSpeakerList();
    saveState();
    updateStatusDisplay();
    updateStartPauseLabel();
  }
});

nextSpeakerButton.addEventListener('click', () => {
  const hall = halls[selectedHallKey];
  if (hall.currentIndex < hall.speakers.length - 1) {
    hall.currentIndex += 1;
    resetCurrentSpeaker(hall);
    renderSpeakerList();
    saveState();
    updateStatusDisplay();
    updateStartPauseLabel();
  }
});

setActiveHallButton.addEventListener('click', () => {
  deviceHallKey = selectedHallKey;
  localStorage.setItem(DEVICE_HALL_KEY, deviceHallKey);
  updateTimerScreenHallName();
  updateTimerDisplay();
  setActiveHallButton.classList.add('highlight');
  setTimeout(() => setActiveHallButton.classList.remove('highlight'), 1000);
});

speakerListContainer.addEventListener('click', (event) => {
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) {
    return;
  }
  const { action, index } = actionButton.dataset;
  const hall = halls[selectedHallKey];
  const speakerIndex = Number(index);
  if (Number.isNaN(speakerIndex) || speakerIndex < 0 || speakerIndex >= hall.speakers.length) {
    return;
  }

  if (action === 'activate') {
    hall.currentIndex = speakerIndex;
    resetCurrentSpeaker(hall);
    renderSpeakerList();
    saveState();
    updateStatusDisplay();
    updateStartPauseLabel();
  }

  if (action === 'delete') {
    hall.speakers.splice(speakerIndex, 1);
    if (hall.currentIndex >= hall.speakers.length) {
      hall.currentIndex = hall.speakers.length - 1;
    }
    if (hall.currentIndex === -1) {
      pauseTimer(hall);
      hall.timer.remainingSeconds = 0;
      hall.timer.remainingAtStart = 0;
      hall.timer.startedAt = 0;
    } else {
      resetCurrentSpeaker(hall);
    }
    saveState();
    renderSpeakerList();
    updateStatusDisplay();
    updateStartPauseLabel();
  }
});

fullscreenButton.addEventListener('click', async () => {
  if (!document.fullscreenElement) {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.warn('Fullscreen request failed:', error);
    }
  } else {
    await document.exitFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  fullscreenButton.textContent = document.fullscreenElement ? 'יציאה ממסך מלא' : 'מסך מלא';
});

wakeLockButton.addEventListener('click', async () => {
  if (wakeLockSentinel) {
    await releaseWakeLock();
  } else {
    await requestWakeLock();
  }
});

for (const button of tabButtons) {
  button.addEventListener('click', () => {
    const target = button.dataset.screen;
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
    managementScreen.classList.toggle('active', target === 'management');
    timerScreen.classList.toggle('active', target === 'timer');
  });
}

setInterval(() => {
  const hall = halls[selectedHallKey];
  if (hall) {
    tick(hall);
  }
  const deviceHall = halls[deviceHallKey];
  if (deviceHall && deviceHall !== hall) {
    tick(deviceHall, true);
  }
  updateStatusDisplay();
}, 250);

window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLockSentinel) {
    requestWakeLock();
  }
});

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    alert('הדפדפן אינו תומך במניעת מצב שינה. אנא ודא שהמסך נשאר פעיל.');
    return;
  }

  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
      wakeLockButton.textContent = 'מניעת שינה';
    });
    wakeLockButton.textContent = 'ביטול מניעת שינה';
  } catch (error) {
    console.error('Wake lock request failed', error);
  }
}

async function releaseWakeLock() {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
      wakeLockButton.textContent = 'מניעת שינה';
    } catch (error) {
      console.error('Wake lock release failed', error);
    }
  }
}

function tick(hall, shouldSave = true) {
  if (!hall.timer.isRunning || hall.currentIndex === -1) {
    return;
  }

  const elapsedSeconds = Math.floor((Date.now() - hall.timer.startedAt) / 1000);
  const remaining = hall.timer.remainingAtStart - elapsedSeconds;
  const speaker = hall.speakers[hall.currentIndex];
  const previousRemaining = hall.timer.remainingSeconds;
  if (!speaker) {
    return;
  }

  if (remaining <= 0) {
    hall.timer.isRunning = false;
    hall.timer.remainingSeconds = 0;
    hall.timer.remainingAtStart = 0;
    speaker.remainingSeconds = 0;
    updateStartPauseLabel();
  } else {
    hall.timer.remainingSeconds = remaining;
    speaker.remainingSeconds = Math.max(remaining, 0);
  }

  if (shouldSave && previousRemaining !== hall.timer.remainingSeconds) {
    saveState();
  }
  updateTimerDisplay();
}

function startTimer(hall) {
  if (hall.currentIndex === -1) {
    return;
  }

  const speaker = hall.speakers[hall.currentIndex];
  if (!speaker) {
    return;
  }

  if (hall.timer.remainingSeconds == null || hall.timer.remainingSeconds <= 0) {
    hall.timer.remainingSeconds = speaker.remainingSeconds ?? speaker.durationSeconds;
  }

  hall.timer.isRunning = true;
  hall.timer.startedAt = Date.now();
  hall.timer.remainingAtStart = hall.timer.remainingSeconds;
  speaker.remainingSeconds = hall.timer.remainingSeconds;
  saveState();
  updateTimerDisplay();
  requestWakeLock();
}

function pauseTimer(hall) {
  if (!hall.timer.isRunning) {
    return;
  }

  const elapsedSeconds = Math.floor((Date.now() - hall.timer.startedAt) / 1000);
  hall.timer.remainingSeconds = Math.max(hall.timer.remainingAtStart - elapsedSeconds, 0);
  hall.timer.isRunning = false;
  hall.timer.startedAt = 0;
  hall.timer.remainingAtStart = hall.timer.remainingSeconds;
  const speaker = hall.speakers[hall.currentIndex];
  if (speaker) {
    speaker.remainingSeconds = hall.timer.remainingSeconds;
  }
  saveState();
  updateTimerDisplay();
}

function resetCurrentSpeaker(hall) {
  const speaker = hall.speakers[hall.currentIndex];
  if (!speaker) {
    hall.timer.isRunning = false;
    hall.timer.remainingSeconds = 0;
    hall.timer.remainingAtStart = 0;
    hall.timer.startedAt = 0;
    updateTimerDisplay();
    return;
  }

  speaker.remainingSeconds = speaker.durationSeconds;
  hall.timer.isRunning = false;
  hall.timer.remainingSeconds = speaker.durationSeconds;
  hall.timer.remainingAtStart = speaker.durationSeconds;
  hall.timer.startedAt = 0;
  saveState();
  updateTimerDisplay();
}

function updateStatusDisplay() {
  const hall = halls[selectedHallKey];
  if (!hall || hall.currentIndex === -1 || !hall.speakers[hall.currentIndex]) {
    currentSpeakerLabel.textContent = 'אין מרצה פעיל';
    currentTopicLabel.textContent = '-';
    currentTimeLabel.textContent = '00:00';
  } else {
    const speaker = hall.speakers[hall.currentIndex];
    const remaining = hall.timer.isRunning
      ? Math.max(calculateRemaining(hall), 0)
      : hall.timer.remainingSeconds ?? speaker.remainingSeconds;
    currentSpeakerLabel.textContent = speaker.name;
    currentTopicLabel.textContent = formatSpeakerTopic(speaker);
    currentTimeLabel.textContent = formatTime(remaining ?? speaker.durationSeconds);
  }

  updateTimerDisplay();
}

function updateTimerDisplay() {
  const hall = halls[deviceHallKey];
  if (!hall) {
    timerSpeakerName.textContent = '---';
    timerTopic.textContent = '---';
    timerRemaining.textContent = '00:00';
    timerProgress.style.width = '0%';
    return;
  }

  const speaker = hall.currentIndex !== -1 ? hall.speakers[hall.currentIndex] : null;
  if (!speaker) {
    timerSpeakerName.textContent = '---';
    timerTopic.textContent = '---';
    timerRemaining.textContent = '00:00';
    timerProgress.style.width = '0%';
    return;
  }

  const total = speaker.durationSeconds;
  const remaining = hall.timer.isRunning ? Math.max(calculateRemaining(hall), 0) : hall.timer.remainingSeconds ?? total;

  timerSpeakerName.textContent = speaker.name;
  timerTopic.textContent = formatSpeakerTopic(speaker);
  timerRemaining.textContent = formatTime(remaining);
  const percentage = total > 0 ? Math.max(0, Math.min(100, ((total - remaining) / total) * 100)) : 0;
  timerProgress.style.width = `${percentage}%`;
}

function updateTimerScreenHallName() {
  timerHallName.textContent = halls[deviceHallKey]?.name ?? 'מליאה';
}

function calculateRemaining(hall) {
  const elapsedSeconds = Math.floor((Date.now() - hall.timer.startedAt) / 1000);
  return Math.max(hall.timer.remainingAtStart - elapsedSeconds, 0);
}

function updateStartPauseLabel() {
  const hall = halls[selectedHallKey];
  startPauseButton.textContent = hall.timer.isRunning ? 'עצור טיימר' : 'התחל טיימר';
}

function renderSpeakerList() {
  const hall = halls[selectedHallKey];
  if (!hall.speakers.length) {
    speakerListContainer.innerHTML = '<p class="empty-state">עדיין לא נוספו מרצים לאולם זה.</p>';
    return;
  }

  const rows = hall.speakers
    .map((speaker, index) => {
      const durationText = formatTime(speaker.durationSeconds);
      const isActive = index === hall.currentIndex;
      return `
        <tr class="${isActive ? 'active-row' : ''}">
          <td>${index + 1}</td>
          <td>${speaker.name}</td>
          <td>${speaker.date || '-'}</td>
          <td>${speaker.startTime || '-'}</td>
          <td>${speaker.endTime || '-'}</td>
          <td>${speaker.topic}</td>
          <td>${durationText}</td>
          <td class="actions">
            <button class="secondary-button" data-action="activate" data-index="${index}">הפעל</button>
            <button class="secondary-button" data-action="delete" data-index="${index}">מחק</button>
          </td>
        </tr>
      `;
    })
    .join('');

  speakerListContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>שם המרצה</th>
          <th>תאריך</th>
          <th>התחלה</th>
          <th>סיום</th>
          <th>נושא</th>
          <th>משך</th>
          <th>פעולות</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function formatTime(totalSeconds = 0) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutesPart = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secondsPart = String(seconds % 60).padStart(2, '0');
  return `${minutesPart}:${secondsPart}`;
}

function saveState() {
  const state = Object.entries(halls).reduce((acc, [key, hall]) => {
    acc[key] = {
      name: hall.name,
      speakers: hall.speakers.map((speaker) => ({
        id: speaker.id,
        name: speaker.name,
        date: speaker.date || '',
        startTime: speaker.startTime || '',
        endTime: speaker.endTime || '',
        topic: speaker.topic,
        durationSeconds: speaker.durationSeconds,
        remainingSeconds: speaker.remainingSeconds ?? speaker.durationSeconds,
      })),
      currentIndex: hall.currentIndex,
      timer: {
        isRunning: hall.timer.isRunning,
        remainingSeconds: hall.timer.remainingSeconds,
        remainingAtStart: hall.timer.remainingAtStart,
        startedAt: hall.timer.startedAt,
      },
    };
    return acc;
  }, {});
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreState() {
  const savedState = localStorage.getItem(STORAGE_KEY);
  if (!savedState) {
    return;
  }

  try {
    const parsed = JSON.parse(savedState);
    for (const [key, value] of Object.entries(parsed)) {
      if (halls[key]) {
        halls[key].speakers = (value.speakers || []).map((speaker) => ({
          id: speaker.id || generateId(),
          name: speaker.name || '',
          date: speaker.date || '',
          startTime: speaker.startTime || '',
          endTime: speaker.endTime || '',
          topic: speaker.topic || '',
          durationSeconds: speaker.durationSeconds || 0,
          remainingSeconds:
            typeof speaker.remainingSeconds === 'number'
              ? speaker.remainingSeconds
              : speaker.durationSeconds || 0,
        }));
        halls[key].currentIndex = value.currentIndex ?? (value.speakers?.length ? 0 : -1);
        halls[key].timer = {
          isRunning: false,
          remainingSeconds: value.timer?.remainingSeconds ?? value.speakers?.[0]?.durationSeconds ?? 0,
          remainingAtStart: value.timer?.remainingSeconds ?? value.speakers?.[0]?.durationSeconds ?? 0,
          startedAt: 0,
        };
      }
    }
  } catch (error) {
    console.error('Unable to restore saved state', error);
  }
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `speaker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createHall(name) {
  return {
    name,
    speakers: [],
    currentIndex: -1,
    timer: {
      isRunning: false,
      remainingSeconds: 0,
      remainingAtStart: 0,
      startedAt: 0,
    },
  };
}

function formatSpeakerTopic(speaker) {
  if (!speaker) {
    return '-';
  }
  const topic = speaker.topic || '-';
  const timeRange = [speaker.startTime, speaker.endTime].filter(Boolean).join(' - ');
  if (timeRange) {
    return `${topic} (${timeRange})`;
  }
  return topic;
}

async function loadScheduleFromSpreadsheet() {
  if (typeof XLSX === 'undefined') {
    console.warn('XLSX library is not available; skipping automatic schedule import.');
    return;
  }

  try {
    const response = await fetch(SCHEDULE_FILE_PATH, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to fetch spreadsheet: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const hallKeys = Object.keys(halls);

    workbook.SheetNames.forEach((sheetName, index) => {
      const hallKey = hallKeys[index];
      if (!hallKey) {
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        return;
      }

      const hall = halls[hallKey];
      const speakers = parseWorksheetIntoSpeakers(worksheet);
      if (!speakers.length) {
        return;
      }

      hall.speakers = speakers;
      hall.currentIndex = speakers.length ? 0 : -1;
      const firstDuration = speakers[0]?.durationSeconds ?? 0;
      hall.timer = {
        isRunning: false,
        remainingSeconds: firstDuration,
        remainingAtStart: firstDuration,
        startedAt: 0,
      };
    });

    saveState();
    renderSpeakerList();
    updateStatusDisplay();
    updateStartPauseLabel();
    updateTimerScreenHallName();
  } catch (error) {
    console.error('Failed to import schedule from spreadsheet', error);
    throw error;
  }
}

function parseWorksheetIntoSpeakers(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
  if (!rows.length) {
    return [];
  }

  const headers = rows[0];
  const columnIndexes = {
    date: headers.indexOf('תאריך'),
    start: headers.indexOf('שעה התחלה'),
    end: headers.indexOf('שעה סיום'),
    name: headers.indexOf('שם הדובר/ת'),
    topic: headers.indexOf('נושא ההרצאה'),
    minutes: headers.indexOf('זמן בדקות'),
  };

  return rows
    .slice(1)
    .map((row) => {
      const name = readCell(row, columnIndexes.name);
      const topic = readCell(row, columnIndexes.topic);
      const minutes = parseMinutes(readCellRaw(row, columnIndexes.minutes));
      if (!name || !minutes) {
        return null;
      }

      return {
        id: generateId(),
        name,
        date: normalizeDate(readCellRaw(row, columnIndexes.date)),
        startTime: normalizeTime(readCellRaw(row, columnIndexes.start)),
        endTime: normalizeTime(readCellRaw(row, columnIndexes.end)),
        topic: topic || '-',
        durationSeconds: minutes * 60,
        remainingSeconds: minutes * 60,
      };
    })
    .filter(Boolean);
}

function readCell(row, index) {
  const value = readCellRaw(row, index);
  if (value == null) {
    return '';
  }
  return String(value).trim();
}

function readCellRaw(row, index) {
  if (!row || index === -1 || typeof index !== 'number') {
    return '';
  }
  return row[index];
}

function normalizeDate(value) {
  if (value == null || value === '') {
    return '';
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateParts(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const millis = value * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + millis);
    if (!Number.isNaN(date.getTime())) {
      return formatDateParts(date);
    }
  }

  const text = String(value).trim();
  if (!text) {
    return '';
  }

  const parts = text.split(/[./-]/);
  if (parts.length === 3 && parts[0].length <= 4 && parts[2].length >= 2) {
    const [day, month, year] = parts;
    const normalizedDay = day.padStart(2, '0');
    const normalizedMonth = month.padStart(2, '0');
    const normalizedYear = year.length === 2 ? `20${year}` : year;
    return `${normalizedDay}.${normalizedMonth}.${normalizedYear}`;
  }

  return text;
}

function formatDateParts(date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = String(utcDate.getUTCDate()).padStart(2, '0');
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const year = String(utcDate.getUTCFullYear());
  return `${day}.${month}.${year}`;
}

function parseMinutes(value) {
  if (value == null || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return Math.round(value);
  }
  const normalized = String(value).replace(',', '.').trim();
  const numeric = Number(normalized);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return Math.round(numeric);
}

function normalizeTime(value) {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }

  const text = String(value).trim();
  if (!text) {
    return '';
  }

  if (/^\d{1,2}:\d{1,2}$/.test(text)) {
    const [hours, minutes] = text.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  }

  const numeric = Number(text.replace(',', '.'));
  if (!Number.isNaN(numeric)) {
    return normalizeTime(numeric);
  }

  return text;
}
