(function () {
  'use strict';

  var STORAGE_KEY = 'valentine_state_v1';
  var APP_VERSION = 'v1';

  // Зафиксированные тексты (НЕ МЕНЯТЬ)
  var FIXED = {
    PROLOGUE: 'Добро пожаловать, Анастасия, в самый валентиновый из всех святых и самый святой из всех валентиновых квизов совместимости.',
    CLIMAX_Q: 'Будете ли Вы моей Валентинкой?',
    FINAL_PHRASE: 'С праздником, роднуля! Я тебя люблю!',
    EASTER_HINT: 'Псс… нажмите 3 раза на любой шар.',
    MEM_COMPLIMENT: 'Ты — мой личный сорт героина'
  };

  var UI = {
    START_BTN: 'Начать',
    LOADING_A11Y: 'Загрузка…',

    WRONG_POPUP_TEXT: 'Ой ой ой, ошибОчка… Попробуй ещё раз',
    WRONG_POPUP_BTN: 'Ещё раз',

    CORRECT_TITLE: 'ВЕРНО!',
    NEXT_Q_BTN: 'Следующий вопрос',
    OK_BTN: 'Окей'
  };

  var ASSETS = {
    audioMusic: 'assets/audio/music.mp3',
    videoMp4: 'assets/video/valentine.mp4',
    videoWebm: 'assets/video/valentine.webm',

    imgEdward: 'assets/img/quiz/edward.png',
    imgTwilightFrame: 'assets/img/quiz/twilight-frame.webp',
    imgDogQ3: 'assets/img/quiz/millionaire-dog.jpg',
    imgRetroQ1: 'assets/img/quiz/retro.jpg',
    imgKupidonQ4: 'assets/img/quiz/kupidon.jpg',
    imgNerpaHead: 'assets/img/easter/nerpa-dog-head.png',
    imgHeartBall: 'assets/img/fx/heart-ball.png'
  };

  var T = {
    MEM_TEXT_MS: 700
  };

  var QUIZ = [
    {
      id: 1,
      text: 'Юбилейный уровень: это наше 10‑е 14 февраля вместе. Сколько дней прошло с нашего первого?',
      answers: ['3640', '3654', '3670', '3699'],
      correctIndex: 1,
      repeatOnWrong: true,
      compliment: 'Я устал считать, сколько мы вместе, но никогда не устану выбирать тебя каждый день'
    },
    {
      id: 2,
      text: 'Тест на внимательность: из какого сериала/фильма этот кадр?',
      answers: ['Бумажный дом', 'Новичок', 'Суммерки', 'После жизни'],
      correctIndex: 2,
      repeatOnWrong: true,
      compliment: 'Ты — мой личный сорт героина',
      showTwilightFrame: true
    },
    {
      id: 3,
      text: '',
      answers: ['Французская нерпа', 'Луковый суп', 'Луи Пигодье', 'Бигош Лукович'],
      alwaysCorrect: true,
      compliment: 'Ты — лучшее, что со мной случалось!',
      showDog: true,
      showTimer: true
    },
    {
      id: 4,
      text: 'Разрешите моему купидону попасть сегодня в сердце — и не только…',
      answers: ['Хочу скорее увидеть твою стрелу!'],
      alwaysCorrect: true,
      compliment: 'Ты — самая красивая, умная, заботливая, понимающая и сексуальная женщина!',
      isWideSingle: true
    },
    {
      id: 5,
      text: 'Почему нам обоим так нравится этот оттенок?',
      answers: [
        'Потому что он звучит как мечта, которую мы уже придумали вместе.',
        'Потому что Лу выбирала цвет: все были серые, и это был рандомный вариант',
        'Потому что это тот самый цвет, которым мы точно не покрасим стены дома.',
        'Потому что в нём есть ощущение праздника.'
      ],
      correctIndex: 0,
      repeatOnWrong: true,
      compliment: 'Спасибо за твою поддержку!',
      showColorPlaque: true
    }
  ];

  var state = getDefaultState();

  var runtime = {
    preloadStarted: false,
    preloadDone: false,
    target01: 0,
    shown01: 0,
    rafId: 0,

    musicEl: null,

    prologue: {
      scrollEl: null,
      anchorEl: null,
      scrollRaf: 0,
      onResize: null
    },

    overlayEl: null,

    q3TimerStartMs: 0,
    q3TimerRaf: 0,

    wrongHold: { active: false, qIdx: -1, ansIdx: -1 }
  };

  var appEl = document.getElementById('app');

  init();

  function init() {
    var loaded = loadState();
    if (loaded) {
      state = normalizeState(loaded);
      saveState();
    }

    ensureRoot();
    if (!state.screenId) state.screenId = 'loading';

    renderScreen();
  }

  function getDefaultState() {
    return {
      appVersion: APP_VERSION,
      screenId: 'loading', // {loading,start,prologue,quiz,result,climax,final}
      prologueScrollDone: false,
      quiz: {
        currentQuestion: 1,
        answers: [null, null, null, null, null],
        isCorrect: [false, false, false, false, false],
        attempts: [0, 0, 0, 0, 0],
        edwardShown: false
      },
      audio: { musicStarted: false }
    };
  }

  function normalizeState(loaded) {
    var d = getDefaultState();
    if (!loaded || typeof loaded !== 'object') return d;

    if (typeof loaded.screenId === 'string') d.screenId = loaded.screenId;
    d.prologueScrollDone = !!loaded.prologueScrollDone;

    if (loaded.audio && typeof loaded.audio === 'object') {
      d.audio.musicStarted = !!loaded.audio.musicStarted;
    }

    if (loaded.quiz && typeof loaded.quiz === 'object') {
      d.quiz.currentQuestion = clampInt(loaded.quiz.currentQuestion, 1, 5);

      if (Array.isArray(loaded.quiz.answers) && loaded.quiz.answers.length === 5) d.quiz.answers = loaded.quiz.answers.slice(0, 5);
      if (Array.isArray(loaded.quiz.isCorrect) && loaded.quiz.isCorrect.length === 5) d.quiz.isCorrect = loaded.quiz.isCorrect.map(Boolean).slice(0, 5);
      if (Array.isArray(loaded.quiz.attempts) && loaded.quiz.attempts.length === 5) d.quiz.attempts = loaded.quiz.attempts.map(function(v){ return clampInt(v, 0, 9999); }).slice(0, 5);

      d.quiz.edwardShown = !!loaded.quiz.edwardShown;
    }

    return d;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
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

  function ensureRoot() {
    if (!appEl) return;

    appEl.innerHTML = ''
      + '<div class="stage" role="application">'
      + '  <div class="stageBg" id="stageBg"></div>'
      + '  <div class="safe" id="safeRoot"></div>'
      + '  <div class="overlay" id="overlay" aria-hidden="true"></div>'
      + '</div>';

    runtime.overlayEl = document.getElementById('overlay');
  }

  function goToScreen(screenId) {
    if (state.screenId === screenId) return;

    teardownPrologueRuntime();
    stopQ3Timer();

    state.screenId = screenId;
    saveState();
    renderScreen();

    if (state.screenId === 'prologue') setupPrologueRuntime();
    if (state.screenId === 'quiz') startQ3TimerIfNeeded();
  }

  function renderScreen() {
    var safeRoot = document.getElementById('safeRoot');
    if (!safeRoot) return;

    safeRoot.innerHTML = '';

    var screenEl = document.createElement('div');
    screenEl.className = 'screen';
    screenEl.setAttribute('data-screen', state.screenId);

    if (state.screenId === 'loading') {
      screenEl.appendChild(renderLoading());
      safeRoot.appendChild(screenEl);
      requestAnimationFrame(function () { screenEl.classList.add('screen--active'); });

      if (!runtime.preloadStarted) {
        runtime.preloadStarted = true;
        startLoadingLoop();
        preloadAssets(function (p01) { runtime.target01 = clamp01(p01); })
          .then(function () { runtime.preloadDone = true; runtime.target01 = 1; })
          .catch(function (e) { console.error('Preload failed:', e); });
      }
      return;
    }

    if (state.screenId === 'start') {
      var bg0 = document.getElementById('stageBg');
      if (bg0) bg0.style.transform = '';

      var wrap = document.createElement('div');
      wrap.className = 'centerStack';

      var btn = document.createElement('button');
      btn.className = 'btn';
      btn.type = 'button';
      btn.id = 'startBtn';
      btn.textContent = UI.START_BTN;

      btn.addEventListener('click', function () {
        startMusicFromUserGesture();
        zoomBackgroundIn();
        goToScreen('prologue');
      });

      wrap.appendChild(btn);
      screenEl.appendChild(wrap);

      safeRoot.appendChild(screenEl);
      requestAnimationFrame(function () { screenEl.classList.add('screen--active'); });

      stopLoadingLoop();
      return;
    }

    if (state.screenId === 'prologue') {
      screenEl.appendChild(renderPrologue());
      safeRoot.appendChild(screenEl);
      requestAnimationFrame(function () { screenEl.classList.add('screen--active'); });
      stopLoadingLoop();
      setupPrologueRuntime();
      return;
    }

    if (state.screenId === 'quiz') {
      screenEl.appendChild(renderQuiz());
      safeRoot.appendChild(screenEl);
      requestAnimationFrame(function () { screenEl.classList.add('screen--active'); });
      stopLoadingLoop();
      startQ3TimerIfNeeded();
      return;
    }

    safeRoot.appendChild(screenEl);
    requestAnimationFrame(function () { screenEl.classList.add('screen--active'); });
    stopLoadingLoop();
  }

  function zoomBackgroundIn() {
    var bg = document.getElementById('stageBg');
    if (!bg) return;
    bg.classList.add('stageBg--zoomIn');
  }

  // ===== PROLOGUE =====

  function renderPrologue() {
    var wrap = document.createElement('div');
    wrap.className = 'prologueScroll';
    wrap.id = 'prologueScroll';

    wrap.innerHTML = ''
      + '<section class="prologueGreetingSection" id="prologueGreeting">'
      + '  <div class="prologueGreetingCard">' + escapeHtml(FIXED.PROLOGUE) + '</div>'
      + '</section>'
      + '<div style="height: 520px;"></div>'
      + '<div class="quizAnchor" id="quizAnchor"></div>'
      + '<div style="height: 520px;"></div>';

    return wrap;
  }

  function setupPrologueRuntime() {
    var scrollEl = document.getElementById('prologueScroll');
    var anchorEl = document.getElementById('quizAnchor');
    if (!scrollEl || !anchorEl) return;

    runtime.prologue.scrollEl = scrollEl;
    runtime.prologue.anchorEl = anchorEl;

    scrollEl.addEventListener('scroll', onPrologueScroll, { passive: true });

    runtime.prologue.onResize = function () {
      requestPrologueUpdate();
    };
    window.addEventListener('resize', runtime.prologue.onResize);

    // “страховка”: обновим несколько раз после входа (шрифты/лейаут)
    requestPrologueUpdate();
    setTimeout(requestPrologueUpdate, 0);
    setTimeout(requestPrologueUpdate, 180);
  }

  function teardownPrologueRuntime() {
    if (runtime.prologue.scrollEl) runtime.prologue.scrollEl.removeEventListener('scroll', onPrologueScroll);
    if (runtime.prologue.scrollRaf) cancelAnimationFrame(runtime.prologue.scrollRaf);

    if (runtime.prologue.onResize) window.removeEventListener('resize', runtime.prologue.onResize);

    runtime.prologue.scrollEl = null;
    runtime.prologue.anchorEl = null;
    runtime.prologue.scrollRaf = 0;
    runtime.prologue.onResize = null;
  }

  function onPrologueScroll() {
    requestPrologueUpdate();
  }

  function requestPrologueUpdate() {
    if (runtime.prologue.scrollRaf) return;
    runtime.prologue.scrollRaf = requestAnimationFrame(function () {
      runtime.prologue.scrollRaf = 0;
      updatePrologueScrollEffects();
    });
  }

  function updatePrologueScrollEffects() {
    var scrollEl = runtime.prologue.scrollEl;
    var anchorEl = runtime.prologue.anchorEl;
    if (!scrollEl || !anchorEl) return;

    // Параллакс
    var st = scrollEl.scrollTop;
    var bg = document.getElementById('stageBg');
    if (bg) {
      var max = Math.max(1, scrollEl.scrollHeight - scrollEl.clientHeight);
      var t = clamp01(st / max);
      var y = -Math.round(t * 18);
      bg.style.transform = 'translate3d(0,' + y + 'px,0) scale(1.045)';
    }

    // Надёжный триггер якоря через геометрию
    var a = anchorEl.getBoundingClientRect();
    var c = scrollEl.getBoundingClientRect();
    var relTop = a.top - c.top; // положение якоря внутри скролл-контейнера

    if (relTop <= scrollEl.clientHeight - 40) {
      state.prologueScrollDone = true;
      saveState();
      goToScreen('quiz');
    }
  }

  // ===== QUIZ =====

  function qIndexFromState() {
    return clampInt(state.quiz.currentQuestion, 1, 5) - 1;
  }

  function renderQuiz() {
    state = normalizeState(state);
    saveState();

    var qIdx = qIndexFromState();
    var q = QUIZ[qIdx];

    var wrap = document.createElement('div');
    wrap.className = 'quizLayout';

    wrap.innerHTML = ''
      + '<div class="quizTopbar">'
      + '  <button class="navBtn" id="navBack" type="button" aria-label="назад"><span class="navIcon">‹</span></button>'
      + '  <div class="quizCounter">Вопрос ' + (qIdx + 1) + '/5</div>'
      + '  <button class="navBtn navBtn--right" id="navNext" type="button" aria-label="вперёд"><span class="navIcon">›</span></button>'
      + '</div>'
      + '<div class="quizBody">'
      + '  <div class="quizQuestionArea">'
      + '    <div class="quizQuestionText" id="qText"></div>'
      + '    <div class="quizMediaRow" id="qMedia"></div>'
      + '  </div>'
      + '  <div class="quizAnswersArea">'
      + '    <div class="quizAnswersGrid" id="qAnswers"></div>'
      + '  </div>'
      + '</div>';

    var qText = wrap.querySelector('#qText');
    var qMedia = wrap.querySelector('#qMedia');
    var qAnswers = wrap.querySelector('#qAnswers');

    qText.textContent = q.text || '';

    qMedia.innerHTML = '';

    if (q.id === 1) {
  var imgR = document.createElement('img');
  imgR.className = 'quizImage';
  imgR.src = ASSETS.imgRetroQ1;
  imgR.alt = '';
  imgR.onerror = function () { imgR.remove(); };
  qMedia.appendChild(imgR);
}

if (q.id === 4) {
  var imgK = document.createElement('img');
  imgK.className = 'quizImage';
  imgK.src = ASSETS.imgKupidonQ4;
  imgK.alt = '';
  imgK.onerror = function () { imgK.remove(); };
  qMedia.appendChild(imgK);
}


    if (q.showTwilightFrame) {
      var imgT = document.createElement('img');
      imgT.className = 'quizImage';
      imgT.src = ASSETS.imgTwilightFrame;
      imgT.alt = '';
      qMedia.appendChild(imgT);
    }

    if (q.showDog) {
      var imgD = document.createElement('img');
      imgD.className = 'quizImage';
      imgD.src = ASSETS.imgDogQ3;
      imgD.alt = '';
      qMedia.appendChild(imgD);
    }

    if (q.id === 5) {
  var plaque = document.createElement('div');
  plaque.className = 'colorPlaque';
  plaque.innerHTML =
    '<div class="colorSwatch" style="background:#ADFF2F;"></div>' +
    '<div class="colorLabel">Kinetic Yellow</div>';
  qMedia.appendChild(plaque);
}

    // Q3 большой таймер в правом верхнем
    if (q.showTimer) {
      var corner = document.createElement('div');
      corner.className = 'q3CornerTimer';
      corner.id = 'q3Timer';
      corner.innerHTML = '1<span class="quizTimerColon">:</span>00';
      wrap.appendChild(corner);
    }

    // 2 колонки для 4 вариантов
    if (q.answers.length === 4) qAnswers.classList.add('quizAnswersGrid--2col');

    // Answers
    qAnswers.innerHTML = '';
    var selected = state.quiz.answers[qIdx];

    for (var i = 0; i < q.answers.length; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn answerBtn' + (q.isWideSingle ? ' btn--wide' : '');
      b.textContent = q.answers[i];
      b.setAttribute('data-ans', String(i));

      if (selected === i) b.classList.add('answerBtn--selected');
      if (state.quiz.isCorrect[qIdx] === true && selected === i) b.classList.add('answerBtn--correct');

      if (runtime.wrongHold.active && runtime.wrongHold.qIdx === qIdx && runtime.wrongHold.ansIdx === i) {
        b.classList.add('answerBtn--wrongHold');
      }

      b.addEventListener('click', function (ev) {
        var idx = parseInt(ev.currentTarget.getAttribute('data-ans'), 10);
        selectAnswer(idx);
      });

      qAnswers.appendChild(b);
    }

    // Topbar nav
    var backBtn = wrap.querySelector('#navBack');
    var nextBtn = wrap.querySelector('#navNext');

    backBtn.disabled = (qIdx === 0);
    nextBtn.disabled = !canGoNextFromCurrent();

    backBtn.addEventListener('click', function () {
      var qi = qIndexFromState();
      if (qi <= 0) return;
      state.quiz.currentQuestion = qi;
      saveState();
      renderScreen();
    });

    nextBtn.addEventListener('click', function () {
      goNextQuestion();
    });

    return wrap;
  }

  function canGoNextFromCurrent() {
    var qIdx = qIndexFromState();
    return state.quiz.isCorrect[qIdx] === true;
  }

  function goNextQuestion() {
    if (!canGoNextFromCurrent()) return;

    var qIdx = qIndexFromState();
    if (qIdx >= 4) {
      // Стадия 6: тут будет переход на RESULT
      return;
    }

    state.quiz.currentQuestion = qIdx + 2;
    saveState();
    closeOverlay();
    renderScreen();
  }

  function selectAnswer(answerIndex) {
    var qIdx = qIndexFromState();
    var q = QUIZ[qIdx];

    runtime.wrongHold.active = false;
    runtime.wrongHold.qIdx = -1;
    runtime.wrongHold.ansIdx = -1;

    state.quiz.answers[qIdx] = answerIndex;
    saveState();

    // Всегда верно (Q3/Q4)
    if (q.alwaysCorrect) {
      state.quiz.isCorrect[qIdx] = true;
      saveState();
      showCorrectOverlay(q);
      renderScreen();
      return;
    }

    var isCorrect = (answerIndex === q.correctIndex);

    if (isCorrect) {
      state.quiz.isCorrect[qIdx] = true;
      saveState();

      // Q2: “стикер Эдварда” один раз
      var showEdwardSticker = false;
      if (q.id === 2 && state.quiz.edwardShown !== true) {
        state.quiz.edwardShown = true;
        saveState();
        showEdwardSticker = true;
      }

      showCorrectOverlay(q, showEdwardSticker);
      renderScreen();
      return;
    }

    // Неверно (Q1/Q2/Q5)
    if (q.repeatOnWrong === true) {
      state.quiz.attempts[qIdx] = (state.quiz.attempts[qIdx] || 0) + 1;
      saveState();

      runtime.wrongHold.active = true;
      runtime.wrongHold.qIdx = qIdx;
      runtime.wrongHold.ansIdx = answerIndex;

      renderScreen();

      showModal(UI.WRONG_POPUP_TEXT, UI.WRONG_POPUP_BTN, function () {
        runtime.wrongHold.active = false;
        runtime.wrongHold.qIdx = -1;
        runtime.wrongHold.ansIdx = -1;
        renderScreen();
      });

      return;
    }
  }

  function showCorrectOverlay(q, withEdwardSticker) {
    var overlay = runtime.overlayEl;
    if (!overlay) return;

    var btnText = (q.id === 5) ? UI.OK_BTN : UI.NEXT_Q_BTN;

    var stickerHtml = '';
    if (withEdwardSticker === true) {
      stickerHtml = '<img class="stickerEdward" src="' + escapeAttr(ASSETS.imgEdward) + '" alt="" />';
    }

    overlay.innerHTML = ''
      + '<div class="modal" id="modalRoot">'
      + stickerHtml
      + '<div class="successTitle">' + escapeHtml(UI.CORRECT_TITLE) + '</div>'
      + '<div class="successCompliment">' + escapeHtml(q.compliment || '') + '</div>'
      + '<div class="successActions">'
      + '  <button class="btn btn--wide" id="correctNextBtn" type="button">' + escapeHtml(btnText) + '</button>'
      + '</div>'
      + '</div>';

    overlay.classList.add('overlay--show');
    overlay.setAttribute('aria-hidden', 'false');

    var btn = document.getElementById('correctNextBtn');
    btn.addEventListener('click', function () {
      if (q.id === 5) {
        closeOverlay();
        return;
      }
      goNextQuestion();
    });
  }

  function showModal(text, buttonText, onClose) {
    var overlay = runtime.overlayEl;
    if (!overlay) return;

    overlay.innerHTML = ''
      + '<div class="modal" id="modalRoot">'
      + '<p class="modalText">' + escapeHtml(text) + '</p>'
      + '<div class="successActions">'
      + '  <button class="btn" id="modalOkBtn" type="button">' + escapeHtml(buttonText) + '</button>'
      + '</div>'
      + '</div>';

    overlay.classList.add('overlay--show');
    overlay.setAttribute('aria-hidden', 'false');

    var ok = document.getElementById('modalOkBtn');
    ok.addEventListener('click', function () {
      closeOverlay();
      if (typeof onClose === 'function') onClose();
    });
  }

  function closeOverlay() {
    var overlay = runtime.overlayEl;
    if (!overlay) return;
    overlay.classList.remove('overlay--show');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '';
  }

  // ===== Q3 timer =====

  function startQ3TimerIfNeeded() {
    stopQ3Timer();
    if (state.screenId !== 'quiz') return;
    if (qIndexFromState() !== 2) return;

    runtime.q3TimerStartMs = performance.now();
    tickQ3Timer();
  }

  function tickQ3Timer() {
    if (state.screenId !== 'quiz') return;
    if (qIndexFromState() !== 2) return;

    var el = document.getElementById('q3Timer');
    var now = performance.now();

    var elapsed = now - runtime.q3TimerStartMs;
    var loopMs = 60000;
    var t = elapsed % loopMs;
    var leftMs = loopMs - t;

    var sec = Math.floor(leftMs / 1000);
    var mm = Math.floor(sec / 60);
    var ss = sec % 60;
    var ss2 = (ss < 10 ? '0' : '') + ss;

    if (el) el.innerHTML = String(mm) + '<span class="quizTimerColon">:</span>' + ss2;

    runtime.q3TimerRaf = requestAnimationFrame(tickQ3Timer);
  }

  function stopQ3Timer() {
    if (runtime.q3TimerRaf) cancelAnimationFrame(runtime.q3TimerRaf);
    runtime.q3TimerRaf = 0;
  }

  // ===== Audio =====

  function startMusicFromUserGesture() {
    if (!runtime.musicEl) {
      runtime.musicEl = new Audio();
      runtime.musicEl.preload = 'auto';
      runtime.musicEl.src = ASSETS.audioMusic;
      runtime.musicEl.volume = 0.5;
    }
    runtime.musicEl.play().catch(function(){});
    state.audio.musicStarted = true;
    saveState();
  }

  // ===== Loading / preload =====

  function renderLoading() {
    var wrap = document.createElement('div');
    wrap.className = 'loadingWrap';
    wrap.setAttribute('aria-label', UI.LOADING_A11Y);

    wrap.innerHTML = ''
      + '<svg class="loadingHeart" viewBox="0 0 100 90" role="img" aria-label="Прогресс загрузки">'
      + '  <defs>'
      + '    <clipPath id="heartClip">'
      + '      <path d="M50 84 C30 68, 10 52, 10 32 C10 18, 20 8, 34 8 C42 8, 48 12, 50 18 C52 12, 58 8, 66 8 C80 8, 90 18, 90 32 C90 52, 70 68, 50 84 Z"></path>'
      + '    </clipPath>'
      + '    <linearGradient id="fillGrad" x1="0" x2="0" y1="1" y2="0">'
      + '      <stop offset="0%" stop-color="#ff2a5d"></stop>'
      + '      <stop offset="100%" stop-color="#ff5b8a"></stop>'
      + '    </linearGradient>'
      + '  </defs>'
      + '  <rect id="heartFillRect" x="0" y="90" width="100" height="0" fill="url(#fillGrad)" clip-path="url(#heartClip)"></rect>'
      + '  <path d="M50 84 C30 68, 10 52, 10 32 C10 18, 20 8, 34 8 C42 8, 48 12, 50 18 C52 12, 58 8, 66 8 C80 8, 90 18, 90 32 C90 52, 70 68, 50 84 Z"'
      + '        fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.42)" stroke-width="2"></path>'
      + '</svg>'
      + '<div class="loadingPercent" id="loadingPercent">0%</div>';

    return wrap;
  }

  function preloadAssets(onProgress01) {
    var urls = [
      ASSETS.audioMusic,
      ASSETS.videoMp4,
      ASSETS.videoWebm,
      ASSETS.imgEdward,
      ASSETS.imgTwilightFrame,
      ASSETS.imgDogQ3,
      ASSETS.imgNerpaHead,
      ASSETS.imgHeartBall
    ];

    var done = 0;

    return Promise.all(urls.map(function (url) {
      return fetch(url, { cache: 'force-cache' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
        .then(function () { done++; onProgress01(done / urls.length); });
    })).then(function () { onProgress01(1); });
  }

  function startLoadingLoop() {
    if (runtime.rafId) return;

    function tick() {
      if (state.screenId !== 'loading') { runtime.rafId = 0; return; }

      runtime.shown01 = runtime.shown01 + (runtime.target01 - runtime.shown01) * 0.14;

      if (runtime.preloadDone && runtime.shown01 > 0.999) {
        runtime.shown01 = 1;
        renderLoadingUI(1);
        if (state.screenId === 'loading') goToScreen('start');
        runtime.rafId = 0;
        return;
      }

      renderLoadingUI(runtime.shown01);
      runtime.rafId = requestAnimationFrame(tick);
    }

    runtime.rafId = requestAnimationFrame(tick);
  }

  function stopLoadingLoop() {
    if (runtime.rafId) { cancelAnimationFrame(runtime.rafId); runtime.rafId = 0; }
  }

  function renderLoadingUI(p01) {
    var percentEl = document.getElementById('loadingPercent');
    var rect = document.getElementById('heartFillRect');

    if (percentEl) percentEl.textContent = Math.round(clamp01(p01) * 100) + '%';

    if (rect) {
      var h = clamp01(p01) * 90;
      var y = 90 - h;
      rect.setAttribute('y', String(y));
      rect.setAttribute('height', String(h));
    }
  }

  // ===== Utils =====

  function clamp01(x) {
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  function clampInt(x, min, max) {
    var v = parseInt(x, 10);
    if (!isFinite(v)) v = min;
    if (v < min) v = min;
    if (v > max) v = max;
    return v;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }
})();
