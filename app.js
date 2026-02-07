(function () {
  'use strict';

  // ТЗ: localStorage, 1 ключ
  var STORAGE_KEY = 'valentine_state_v1';
  var APP_VERSION = 'v1';

  // Зафиксированные тексты (копируем из ТЗ, не меняя ни символа)
  var TXT = {
    PROLOGUE: 'Добро пожаловать, Анастасия, в самый валентиновый из всех святых и самый святой из всех валентиновых квизов совместимости.',
    CLIMAX_Q: 'Будете ли Вы моей Валентинкой?',
    FINAL_PHRASE: 'С праздником, роднуля! Я тебя люблю!',
    EASTER_HINT: 'Псс… нажмите 3 раза на любой шар.',
    MEM_COMPLIMENT: 'Ты — мой личный сорт героина',
    WRONG_POPUP: 'Ой ой ой, ошибОчка… Попробуй ещё раз',
    START_BTN: 'Начать'
  };

  // Single source of truth — единый объект состояния
  var state = getDefaultState();

  var appEl = document.getElementById('app');

  init();

  function init() {
    var loaded = loadState();
    if (loaded) state = loaded;

    // На стадии 0 показываем минимальный каркас: стартовый экран с кнопкой "Начать"
    // (Дальше в стадиях переключим старт на LOADING по ТЗ)
    if (!state.screenId) state.screenId = 'start';

    renderScreen();
    saveState();
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

  // loadState/saveState — через JSON stringify/parse (localStorage хранит строку)
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      // минимальная защита от старого/битого состояния
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

  // Экранная машина — явный переход
  function goToScreen(screenId) {
    state.screenId = screenId;
    saveState();
    renderScreen();
  }

  function renderScreen() {
    if (!appEl) return;

    // минимальная разметка сцены 16:9
    appEl.innerHTML = ''
      + '<div class="stage" role="application">'
      + '  <div class="safe" id="safe"></div>'
      + '</div>';

    var safe = document.getElementById('safe');

    if (state.screenId === 'start') {
      safe.innerHTML = ''
        + '<button class="btn" id="startBtn" type="button">'
        + escapeHtml(TXT.START_BTN)
        + '</button>';

      var btn = document.getElementById('startBtn');
      btn.addEventListener('click', function () {
        // На стадии 0 просто фиксируем, что клик был (музыку/переходы — на Стадии 3)
        // Оставляем на start, чтобы не “симулировать” будущую логику.
        saveState();
      });
      return;
    }

    // На стадии 0 другие экраны не реализуем — оставим нейтральную пустоту
    safe.innerHTML = '';
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // Экспорт в window не делаем (но и ES-модулей нет) — всё в одном файле.
})();
