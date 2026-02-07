(function () {
  'use strict';

  // =========================
  // Константы ТЗ (не менять)
  // =========================

  var STORAGE_KEY = 'valentine_state_v1';
  var APP_VERSION = 'v1';

  // Зафиксированные тексты (раздел 1 ТЗ) — НЕ МЕНЯТЬ НИ СИМВОЛА
  var FIXED = {
    PROLOGUE: 'Добро пожаловать, Анастасия, в самый валентиновый из всех святых и самый святой из всех валентиновых квизов совместимости.',
    CLIMAX_Q: 'Будете ли Вы моей Валентинкой?',
    FINAL_PHRASE: 'С праздником, роднуля! Я тебя люблю!',
    EASTER_HINT: 'Псс… нажмите 3 раза на любой шар.',
    MEM_COMPLIMENT: 'Ты — мой личный сорт героина'
  };

  // Нефиксированные, но нужные UI-строки (ТЗ задаёт точные тексты для части кнопок/попапов)
  var UI = {
    START_BTN: 'Начать',
    TRY_AGAIN_POPUP_TEXT: 'Ой ой ой, ошибОчка… Попробуй ещё раз',
    TRY_AGAIN_BTN: 'Ещё раз'
  };

  // Пути ассетов (ТЗ, раздел 7)
  var ASSETS = {
    audioMusic: 'assets/audio/music.mp3',
    videoMp4: 'assets/video/valentine.mp4',
    videoWebm: 'assets/video/valentine.webm',

    imgEdward: 'assets/img/quiz/edward.png',
    imgTwilightFrame: 'assets/img/quiz/twilight-frame.webp',
    imgDogQ3: 'assets/img/quiz/millionaire-dog.jpg',
    imgNerpaHead: 'assets/img/easter/nerpa-dog-head.png',
    imgHeartBall: 'assets/img/fx/heart-ball.png'
  };

  // Тайминги (будем использовать в следующих стадиях; здесь — заготовка без “магии”)
  var T = {
    BASE_TRANSITION_MS: 280
  };

  // =========================
  // State (single source of truth)
  // =========================

  var state = getDefaultState();

  // =========================
  // DOM
  // =========================

  var appEl = document.getElementById('app');

  init();

  function init() {
    var restored = loadState();
    if (restored) state = restored;

    ensureRoot();

    // На Стадии 1 оставляем START как главный экран для проверки деплоя.
    // (В Стадии 2 сделаем LOADING + реальную предзагрузку и авто-переход.)
    if (!state.screenId) state.screenId = 'start';

    renderScreen();

    // Debug (только если ?dev=1)
    if (isDev()) {
      window.__valentineDebug = {
        getState: function(){ return state; },
        goToScreen: goToScreen,
        saveState: saveState,
        resetState: function(){
          state = getDefaultState();
          saveState();
          renderScreen();
        }
      };
    }
  }

  function getDefaultState() {
    return {
      appVersion: APP_VERSION,
      screenId: 'start', // enum {loading,start,prologue,quiz,result,climax,final}
      prologueScrollDone: false,
      quiz: {
        currentQuestion: 1,
        answers: [null, null, null, null, null],
        isCorrect: [false, false, false, false, false],
        attempts: [0, 0, 0, 0, 0],
        edwardShown: false
      },
      climax: {
        noRunCount: 0
      },
      finale: {
        videoStarted: false,
        ballsStarted: false,
        ballsFullyCovered: false,
        easterHintShown: false,
        nerpaActivated: false
      },
      audio: {
        musicStarted: false
      }
    };
  }

  // =========================
  // Storage
  // =========================

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.appVersion !== APP_VERSION) return null;

      return parsed;
    } catch (e) {
      console.warn('loadState failed:', e);
      return null;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('saveState failed:', e);
    }
  }

  // =========================
  // Screen machine
  // =========================

  function goToScreen(screenId) {
    // enum {loading,start,prologue,quiz,result,climax,final}
    var ok =
      screenId === 'loading' ||
      screenId === 'start' ||
      screenId === 'prologue' ||
      screenId === 'quiz' ||
      screenId === 'result' ||
      screenId === 'climax' ||
      screenId === 'final';

    if (!ok) {
      console.warn('Unknown screenId:', screenId);
      return;
    }

    if (state.screenId === screenId) return;

    state.screenId = screenId;
    saveState();
    renderScreen();
  }

  function ensureRoot() {
    if (!appEl) return;

    appEl.innerHTML = ''
      + '<div class="stage" role="application">'
      + '  <div class="safe" id="safeRoot"></div>'
      + '  <div class="overlay" id="overlay" aria-hidden="true"></div>'
      + '</div>';
  }

  function renderScreen() {
    var safeRoot = document.getElementById('safeRoot');
    if (!safeRoot) return;

    // Чистим текущий экран
    safeRoot.innerHTML = '';

    // Рендерим новый экран
    var screenEl = document.createElement('div');
    screenEl.className = 'screen';
    screenEl.setAttribute('data-screen', state.screenId);

    // Важно: START по ТЗ — только фон + кнопка “Начать”, больше текста нет.
    if (state.screenId === 'start') {
      var wrap = document.createElement('div');
      wrap.className = 'centerStack';

      var btn = document.createElement('button');
      btn.className = 'btn';
      btn.type = 'button';
      btn.id = 'startBtn';
      btn.textContent = UI.START_BTN;

      // На Стадии 1 — только “живость” кнопки.
      // Музыка строго по клику реализуем в Стадии 3 (через HTMLMediaElement.play()) [web:17].
      btn.addEventListener('click', function () {
        // Ничего не запускаем, чтобы не “опережать” Стадию 3.
        saveState();
      });

      wrap.appendChild(btn);
      screenEl.appendChild(wrap);
    } else {
      // Остальные экраны — пустые заглушки на Стадии 1 (без фикс-текстов/логики).
      // Управление ими начнём в следующих стадиях.
      screenEl.appendChild(document.createElement('div'));
    }

    safeRoot.appendChild(screenEl);

    // Плавный enter: включаем активный класс на следующем кадре
    // (requestAnimationFrame вызывает callback перед следующим repaint) [web:21].
    requestAnimationFrame(function () {
      screenEl.classList.add('screen--active');
    });
  }

  function isDev() {
    return new URLSearchParams(location.search).get('dev') === '1';
  }

  // =========================
  // Заготовки под ТЗ (пока не используем)
  // =========================

  function preloadAssets(onProgress) {
    // Реальная предзагрузка + прогресс будет в Стадии 2.
    // Здесь оставляем сигнатуру под ТЗ.
    void onProgress;
    return Promise.resolve();
  }

  function showToast(text) {
    void text;
  }

  function showModal(text, buttonText, onClose) {
    void text; void buttonText; void onClose;
  }

  function selectAnswer(questionIndex, answerIndex) {
    void questionIndex; void answerIndex;
  }

  function validate(questionIndex) {
    void questionIndex;
    return false;
  }

  function startFinalTimeline() {
    // Видео + шары + пасхалка — будет в Стадиях 8–9.
  }
})();
