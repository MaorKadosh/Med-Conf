const halls = {
  melia: createHall('מליאה'),
  hall1: createHall('אולם 1'),
  hall2: createHall('אולם 2'),
  hall3: createHall('אולם 3'),
};

const STORAGE_KEY = 'military-medicine-conference-timer';
const DEVICE_HALL_KEY = 'military-medicine-conference-device-hall';

let selectedHallKey = 'melia';
let deviceHallKey = localStorage.getItem(DEVICE_HALL_KEY) || 'melia';
let wakeLockSentinel = null;

restoreState();

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
    currentTopicLabel.textContent = speaker.topic;
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
  timerTopic.textContent = speaker.topic;
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
