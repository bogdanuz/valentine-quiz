(function () {
  'use strict';

  var STORAGE_KEY = 'valentine_state_v1';
  var APP_VERSION = 'v1';

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
    GO_FURTHER: 'Идти дальше',

    YES: 'ДА',
    NO: 'НЕТ'
  };

  var PHYSICS = {
  BALL_GRAVITY: 130,
  BALL_MAX_VY: 250,
  BALL_MAX_VX: 50,
  BALL_BOUNCE: 0.03,
  BALL_AIR_DRAG: 0.972,
  BALL_GROUND_FRICTION: 0.94,
  BALL_FREEZE_TIME: 20.0,
  BALL_SPAWN_COUNT: 50,
  BALL_SPAWN_COUNT_MOBILE: 35, // Меньше для мобилок
  
  DOG_SIZE_RATIO: 0.56,
  DOG_SPEED_MIN: 80,
  DOG_SPEED_MAX: 120,
  DOG_EMERGE_SPEED: 60
};

    var ASSETS = {
    audioMusic: 'assets/audio/music.mp3',

    imgEdward: 'assets/img/quiz/edward.png',
    imgTwilightFrame: 'assets/img/quiz/twilight-frame.webp',
    imgDogQ3: 'assets/img/quiz/millionaire-dog.jpg',
    imgRetroQ1: 'assets/img/quiz/retro.jpg',
    imgKupidonQ4: 'assets/img/quiz/kupidon.jpg',

    // FINAL
    videoMp4: 'assets/video/valentine.mp4',
    videoWebm: 'assets/video/valentine.webm',

    // FX
    imgHeartBall: 'assets/img/fx/heart-ball.png',
    
    // EASTER (пасхалка)
    imgNerpaDog: 'assets/img/easter/nerpa-dog-head.png'
  };

  var QUIZ = [
    {
      id: 1,
      text: 'Юбилейный уровень: 10‑е 14 февраля вместе. Сколько дней прошло с нашего первого?',
      answers: ['3640', '3654', '3670', '3699'],
      correctIndex: 1,
      repeatOnWrong: true,
      compliment: 'Я устал считать, сколько мы вместе, но никогда не устану выбирать тебя каждый день',
      img: 'imgRetroQ1'
    },
    {
      id: 2,
      text: 'Тест на внимательность: из какого сериала/фильма этот кадр?',
      answers: ['Бумажный дом', 'Новичок', 'Суммерки', 'После жизни'],
      correctIndex: 2,
      repeatOnWrong: true,
      compliment: 'Ты — мой личный сорт героина',
      img: 'imgTwilightFrame'
    },
    {
      id: 3,
      text: 'Кто изображен на фото?',
      answers: ['Французская нерпа', 'Луковый суп', 'Луи Пигодье', 'Бигош Лукович'],
      alwaysCorrect: true,
      compliment: 'Вы — лучшее, что со мной случалось!',
      img: 'imgDogQ3',
      showTimer: true
    },
    {
      id: 4,
      text: 'Разрешите моему купидону попасть сегодня в сердце — и не только…',
      answers: ['Хочу скорее увидеть твою стрелу'],
      alwaysCorrect: true,
      compliment: 'Ты — самая красивая, умная, заботливая, понимающая и сексуальная женщина!',
      isWideSingle: true,
      img: 'imgKupidonQ4'
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

// Детект мобильного устройства
var IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                window.innerWidth < 768;
  
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

    climax: {
      arenaEl: null,
      yesBtn: null,
      noBtn: null,
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
      screenId: 'loading', // {loading,start,prologue,quiz,climax,final}
      prologueScrollDone: false,
      quiz: {
        currentQuestion: 1,
        answers: [null, null, null, null, null],
        isCorrect: [false, false, false, false, false],
        attempts: [0, 0, 0, 0, 0],
        edwardShown: false
      },
      climax: { noRunCount: 0 },
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

    if (loaded.climax && typeof loaded.climax === 'object') {
      d.climax.noRunCount = clampInt(loaded.climax.noRunCount, 0, 9999);
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
      + '  <button class="globalReset" id="globalMute" type="button" aria-label="Mute" style="right:64px;">'
      + '    <span class="globalResetIcon" id="muteIcon">🔊</span>'
      + '    <span class="globalResetLabel">Mute</span>'
      + '  </button>'
      + '  <button class="globalReset" id="globalReset" type="button" aria-label="Reset">'
      + '    <span class="globalResetIcon">∞</span>'
      + '    <span class="globalResetLabel">Reset</span>'
      + '  </button>'
      + '</div>';

    runtime.overlayEl = document.getElementById('overlay');
        setupGlobalResetOnce();
  }

  function setupMusicAutoResume() {
  if (!state || !state.audio || !state.audio.musicStarted) return;

  var fired = false;
  function resume() {
    if (fired) return;
    fired = true;
    startMusicFromUserGesture();
  }

  document.addEventListener('pointerdown', resume, { once: true });
  document.addEventListener('keydown', resume, { once: true });
  document.addEventListener('touchstart', resume, { once: true, passive: true });
}

  setupMusicAutoResume();

  function goToScreen(screenId) {
  if (state.screenId === screenId) return;

  teardownPrologueRuntime();
  teardownClimaxRuntime();
  teardownFinalRuntime();
  stopQ3Timer();

  state.screenId = screenId;
  saveState();
  renderScreen();
}

  function renderScreen() {
  var safeRoot = document.getElementById('safeRoot');
  if (!safeRoot) return;

  // НЕ очищаем safeRoot сразу — оставляем прошлый экран на 1 кадр
  var prev = safeRoot.querySelector('.screen');

  var screenEl = document.createElement('div');
  screenEl.className = 'screen';
  screenEl.setAttribute('data-screen', state.screenId);

  function mount(onActivated) {
    safeRoot.appendChild(screenEl);

    requestAnimationFrame(function () {
      screenEl.classList.add('screen--active');

      if (prev && prev !== screenEl) {
        prev.classList.remove('screen--active');
        prev.classList.add('screen--out');

        var cleaned = false;
        function cleanup() {
          if (cleaned) return;
          cleaned = true;
          if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
        }

        prev.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, 500);
      }

      if (typeof onActivated === 'function') onActivated();
    });
  }

  if (state.screenId === 'loading') {
    screenEl.appendChild(renderLoading());
    mount();

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
      goToScreen('prologue');
    });

    wrap.appendChild(btn);
    screenEl.appendChild(wrap);

    mount();
    stopLoadingLoop();
    return;
  }

  if (state.screenId === 'prologue') {
    screenEl.appendChild(renderPrologue());
    mount(function () {
      stopLoadingLoop();
      setupPrologueRuntime();
    });
    return;
  }

  if (state.screenId === 'quiz') {
    screenEl.appendChild(renderQuiz());
    mount(function () {
      stopLoadingLoop();
      startQ3TimerIfNeeded();
    });
    return;
  }

  if (state.screenId === 'climax') {
    screenEl.appendChild(renderClimax());
    mount(function () {
      stopLoadingLoop();
      setupClimaxRuntime();
    });
    return;
  }

  if (state.screenId === 'final') {
    screenEl.appendChild(renderFinal());
    mount(function () {
      stopLoadingLoop();
      setupFinalRuntime();
    });
    return;
  }

  mount();
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
      + '<div style="position:fixed;bottom:clamp(20px,5vh,30px);left:50%;transform:translateX(-50%);font-size:clamp(24px,5vw,32px);opacity:0.65;animation:prologueBounce 1.8s ease-in-out infinite;pointer-events:none;">↓</div>'
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

    runtime.prologue.onResize = function () { requestPrologueUpdate(); };
    window.addEventListener('resize', runtime.prologue.onResize);

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

  function onPrologueScroll() { requestPrologueUpdate(); }

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

    var st = scrollEl.scrollTop;

    var bg = document.getElementById('stageBg');
    if (bg) {
      var max = Math.max(1, scrollEl.scrollHeight - scrollEl.clientHeight);
      var t = clamp01(st / max);
      var y = -Math.round(t * 18);
      bg.style.transform = 'translate3d(0,' + y + 'px,0) scale(1.045)';
    }

    var a = anchorEl.getBoundingClientRect();
    var c = scrollEl.getBoundingClientRect();
    var relTop = a.top - c.top;

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

    if (q.img && ASSETS[q.img]) {
      var img = document.createElement('img');
      img.className = 'quizImage';
      img.src = ASSETS[q.img];
      img.alt = '';
      img.onerror = function () { img.remove(); };
      qMedia.appendChild(img);
    }

    if (q.showColorPlaque) {
      var plaque = document.createElement('div');
      plaque.className = 'colorPlaque';
      plaque.innerHTML =
        '<div class="colorSwatch" style="background:#ADFF2F;"></div>' +
        '<div class="colorLabel">Kinetic Yellow</div>';
      qMedia.appendChild(plaque);
    }

    if (q.showTimer) {
      var corner = document.createElement('div');
      corner.className = 'q3CornerTimer';
      corner.id = 'q3Timer';
      corner.innerHTML = '1<span class="quizTimerColon">:</span>00';
      wrap.appendChild(corner);
    }

    if (q.answers.length === 4) qAnswers.classList.add('quizAnswersGrid--2col');

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
      closeOverlay();
      goToScreen('climax');
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

    if (q.alwaysCorrect) {
      state.quiz.isCorrect[qIdx] = true;
      saveState();
      showCorrectOverlay(q, false);
      renderScreen();
      return;
    }

    var isCorrect = (answerIndex === q.correctIndex);

    if (isCorrect) {
      state.quiz.isCorrect[qIdx] = true;
      saveState();

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
    }
  }

  function showCorrectOverlay(q, withEdwardSticker) {
    var overlay = runtime.overlayEl;
    if (!overlay) return;

    var btnText = (q.id === 5) ? UI.GO_FURTHER : UI.NEXT_Q_BTN;

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
        goToScreen('climax');
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

// ===== CLIMAX =====

function renderClimax() {
  var wrap = document.createElement('div');
  wrap.className = 'climaxWrap';

  wrap.innerHTML = ''
    + '<div class="climaxInner">'
    + '  <div class="climaxQ">' + escapeHtml(FIXED.CLIMAX_Q) + '</div>'
    + '  <div class="climaxArena" id="climaxArena">'
    + '    <div class="climaxSparkles"></div>'
    + '    <div class="climaxControls">'
    + '      <button class="btn climaxYes" id="yesBtn" type="button">' + escapeHtml(UI.YES) + '</button>'
    + '      <button class="btn climaxNo" id="noBtn" type="button">' + escapeHtml(UI.NO) + '</button>'
    + '    </div>'
    + '  </div>'
    + '</div>';

  return wrap;
}

function setupClimaxRuntime() {
  // защита от повторного вызова
  teardownClimaxRuntime();

  var arena = document.getElementById('climaxArena');
  var yesBtn = document.getElementById('yesBtn');
  var noBtn = document.getElementById('noBtn');
  if (!arena || !yesBtn || !noBtn) return;

  runtime.climax.arenaEl = arena;
  runtime.climax.yesBtn = yesBtn;
  runtime.climax.noBtn = noBtn;

  // YES
  runtime.climax.onYes = function () {
    goToScreen('final');
  };
  yesBtn.addEventListener('click', runtime.climax.onYes);

  // старт: рядом по центру
  setInitialClimaxPositions();
  keepNoInCentralBounds();

  // первый толчок: первое движение в зоне арены
  runtime.climax.firstNudgeDone = false;
  runtime.climax.onFirstNudge = function () {
    if (runtime.climax.firstNudgeDone) return;
    runtime.climax.firstNudgeDone = true;
    moveNoButton(true);
  };
  runtime.climax.firstNudgeHost = arena;
  arena.addEventListener('pointermove', runtime.climax.onFirstNudge, { passive: true });
  arena.addEventListener('mousemove', runtime.climax.onFirstNudge, { passive: true });

  // дальше убегает только при попытке навести/нажать на НЕТ
  runtime.climax.onNoRun = function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    moveNoButton(false);
  };

  noBtn.addEventListener('pointerenter', runtime.climax.onNoRun);
  noBtn.addEventListener('pointerdown', runtime.climax.onNoRun);
  noBtn.addEventListener('mouseenter', runtime.climax.onNoRun);
  noBtn.addEventListener('mousedown', runtime.climax.onNoRun);

  // resize
  runtime.climax.onResize = function () {
    keepNoInCentralBounds();
  };
  window.addEventListener('resize', runtime.climax.onResize);
}

function setInitialClimaxPositions() {
  var arena = runtime.climax.arenaEl;
  var yesBtn = runtime.climax.yesBtn;
  var noBtn = runtime.climax.noBtn;
  if (!arena || !yesBtn || !noBtn) return;

  var a = arena.getBoundingClientRect();
  var yesR = yesBtn.getBoundingClientRect();
  var noR = noBtn.getBoundingClientRect();

  var gap = 18;
  var totalW = yesR.width + gap + noR.width;

  var y = Math.round(a.height * 0.54);
  var startLeft = Math.round((a.width - totalW) / 2);

  var yesLeft = startLeft;
  var noLeft = startLeft + yesR.width + gap;

  yesBtn.style.left = Math.round(clampCentralX(a.width, yesR.width, yesLeft)) + 'px';
  yesBtn.style.top  = Math.round(clampCentralY(a.height, yesR.height, y - Math.round(yesR.height / 2))) + 'px';

  noBtn.style.left = Math.round(clampCentralX(a.width, noR.width, noLeft)) + 'px';
  noBtn.style.top  = Math.round(clampCentralY(a.height, noR.height, y - Math.round(noR.height / 2))) + 'px';
}

function clampCentralX(arenaW, btnW, x) {
  var min = (arenaW - btnW) * 0.20;
  var max = (arenaW - btnW) * 0.80;
  return clamp(x, min, max);
}

function clampCentralY(arenaH, btnH, y) {
  var min = (arenaH - btnH) * 0.20;
  var max = (arenaH - btnH) * 0.80;
  return clamp(y, min, max);
}

function keepNoInCentralBounds() {
  var arena = runtime.climax.arenaEl;
  var noBtn = runtime.climax.noBtn;
  if (!arena || !noBtn) return;

  var a = arena.getBoundingClientRect();
  var n = noBtn.getBoundingClientRect();

  var curLeft = parseFloat(noBtn.style.left);
  var curTop  = parseFloat(noBtn.style.top);

  if (!isFinite(curLeft) || !isFinite(curTop)) {
    setInitialClimaxPositions();
    return;
  }

  noBtn.style.left = Math.round(clampCentralX(a.width, n.width, curLeft)) + 'px';
  noBtn.style.top  = Math.round(clampCentralY(a.height, n.height, curTop)) + 'px';
}

function teardownClimaxRuntime() {
  if (runtime.climax.onResize) {
    window.removeEventListener('resize', runtime.climax.onResize);
  }

  if (runtime.climax.firstNudgeHost && runtime.climax.onFirstNudge) {
    runtime.climax.firstNudgeHost.removeEventListener('pointermove', runtime.climax.onFirstNudge);
    runtime.climax.firstNudgeHost.removeEventListener('mousemove', runtime.climax.onFirstNudge);
  }

  if (runtime.climax.noBtn && runtime.climax.onNoRun) {
    runtime.climax.noBtn.removeEventListener('pointerenter', runtime.climax.onNoRun);
    runtime.climax.noBtn.removeEventListener('pointerdown', runtime.climax.onNoRun);
    runtime.climax.noBtn.removeEventListener('mouseenter', runtime.climax.onNoRun);
    runtime.climax.noBtn.removeEventListener('mousedown', runtime.climax.onNoRun);
  }

  if (runtime.climax.yesBtn && runtime.climax.onYes) {
    runtime.climax.yesBtn.removeEventListener('click', runtime.climax.onYes);
  }

  runtime.climax.firstNudgeHost = null;
  runtime.climax.onFirstNudge = null;
  runtime.climax.onNoRun = null;
  runtime.climax.onYes = null;

  runtime.climax.firstNudgeDone = false;

  runtime.climax.arenaEl = null;
  runtime.climax.yesBtn = null;
  runtime.climax.noBtn = null;
  runtime.climax.onResize = null;
}

function moveNoButton(isFirstNudge) {
  var arena = runtime.climax.arenaEl;
  var yesBtn = runtime.climax.yesBtn;
  var noBtn = runtime.climax.noBtn;
  if (!arena || !yesBtn || !noBtn) return;

  var a = arena.getBoundingClientRect();
  var y = yesBtn.getBoundingClientRect();
  var n = noBtn.getBoundingClientRect();

  var curLeft = parseFloat(noBtn.style.left);
  var curTop  = parseFloat(noBtn.style.top);

  if (!isFinite(curLeft) || !isFinite(curTop)) {
    setInitialClimaxPositions();
    curLeft = parseFloat(noBtn.style.left);
    curTop  = parseFloat(noBtn.style.top);
  }

  // Центр "ДА" в координатах арены
  var yesCx = (y.left - a.left) + y.width / 2;
  var yesCy = (y.top  - a.top) + y.height / 2;

  // Границы 20–80% (для left/top)
  var leftMin = (a.width - n.width) * 0.20;
  var leftMax = (a.width - n.width) * 0.80;
  var topMin  = (a.height - n.height) * 0.20;
  var topMax  = (a.height - n.height) * 0.80;

  function clampLocal(v, mn, mx) { return v < mn ? mn : (v > mx ? mx : v); }

  // Случайная добавка
  var jitter = (isFirstNudge === true) ? 18 : 44;
  var jx = (Math.random() * 2 - 1) * jitter;
  var jy = (Math.random() * 2 - 1) * jitter;

  // Иногда "телепорт" (только не на первом толчке)
  var teleportChance = (isFirstNudge === true) ? 0.0 : 0.40;
  if (Math.random() < teleportChance) {
    var tries = 0;

    var minR = 240;
    var maxR = Math.min(a.width, a.height) * 0.48;

    while (tries < 22) {
      tries++;

      var ang = Math.random() * Math.PI * 2;
      var r = minR + Math.random() * Math.max(60, (maxR - minR));

      var x = (yesCx + Math.cos(ang) * r) - n.width / 2 + jx * 0.35;
      var t = (yesCy + Math.sin(ang) * r) - n.height / 2 + jy * 0.35;

      x = clampLocal(x, leftMin, leftMax);
      t = clampLocal(t, topMin, topMax);

      // не слишком близко к "ДА"
      var noCx2 = x + n.width / 2;
      var noCy2 = t + n.height / 2;
      var dx2 = noCx2 - yesCx;
      var dy2 = noCy2 - yesCy;

      if (Math.sqrt(dx2*dx2 + dy2*dy2) > 220) {
        noBtn.style.left = Math.round(x) + 'px';
        noBtn.style.top  = Math.round(t) + 'px';
        return;
      }
    }

    // если не нашли идеальную точку — всё равно прыгаем
    noBtn.style.left = Math.round(clampLocal(curLeft + jx * 4, leftMin, leftMax)) + 'px';
    noBtn.style.top  = Math.round(clampLocal(curTop  + jy * 4, topMin, topMax)) + 'px';
    return;
  }

  // Обычный "рывок" от ДА + сильное влево/вправо (орбита)
  var noCx = curLeft + n.width / 2;
  var noCy = curTop  + n.height / 2;

  var dx = noCx - yesCx;
  var dy = noCy - yesCy;
  var len = Math.sqrt(dx*dx + dy*dy) || 1;
  dx /= len;
  dy /= len;

  var px = -dy;
  var py = dx;
  var orbitSign = (Math.random() < 0.5) ? -1 : 1;

  var step  = (isFirstNudge === true) ? 140 : 280;
  var orbit = (isFirstNudge === true) ? 140 : 320;

  if (isFirstNudge !== true && Math.random() < 0.50) {
    step *= 1.35;
    orbit *= 1.30;
  }

  var nextLeft = curLeft + dx * step + px * orbit * orbitSign + jx;
  var nextTop  = curTop  + dy * step + py * orbit * orbitSign + jy;

  nextLeft = clampLocal(nextLeft, leftMin, leftMax);
  nextTop  = clampLocal(nextTop, topMin, topMax);

  noBtn.style.left = Math.round(nextLeft) + 'px';
  noBtn.style.top  = Math.round(nextTop) + 'px';
}

  // ===== FINAL =====

  function renderFinal() {
    var wrap = document.createElement('div');
    wrap.className = 'finalWrap';

    wrap.innerHTML = ''
      + '<div class="finalVideoFrame">'
      + '  <video class="finalVideo" id="finalVideo" muted playsinline preload="auto" loop>'
      + '    <source src="' + escapeAttr(ASSETS.videoWebm) + '" type="video/webm" />'
      + '    <source src="' + escapeAttr(ASSETS.videoMp4) + '" type="video/mp4" />'
      + '  </video>'
      + '</div>'
      + '<canvas class="finalCanvas" id="finalCanvas" role="img" aria-label="Падающие сердечки"></canvas>'
      + '<div class="finalHud">'
      + '  <div class="finalHint" id="finalHint" role="status" aria-live="polite">' + escapeHtml(FIXED.EASTER_HINT) + '</div>'
      + '  <div class="finalCongrats" id="finalCongrats" role="status" aria-live="polite">' + escapeHtml(FIXED.FINAL_PHRASE) + '</div>'
      + '  <div class="finalToast" id="finalToast" role="alert" aria-live="assertive">Режим «Бульдозер» активирован!</div>'
      + '  <div class="finalControls">'
      + '    <button class="finalMiniBtn" id="finalReplay" type="button">К валентинке</button>'
      + '    <button class="finalMiniBtn" id="finalClearBalls" type="button">Убрать шары</button>'
      + '  </div>'
      + '</div>';

    return wrap;
  }

function setupFinalRuntime() {
  teardownFinalRuntime();

  var video = document.getElementById('finalVideo');
  var canvas = document.getElementById('finalCanvas');
  var hint = document.getElementById('finalHint');
  var congrats = document.getElementById('finalCongrats');
  var toast = document.getElementById('finalToast');
  var replayBtn = document.getElementById('finalReplay');
  var clearBtn = document.getElementById('finalClearBalls');

  if (!video || !canvas) return;

  runtime.final = {
    videoEl: video,
    canvasEl: canvas,
    ctx: null,
    raf: 0,
    lastMs: 0,
    lastVideoT: 0,

    balls: [],
    ballsStarted: false,
    ballsFade01: 1,
    fadeMode: 0,
    ballsCleared: false,

    hintEl: hint,
    hintShown: false,
    hintAt: 6.0,

    congratsEl: congrats,
    congratsShown: false,
    congratsAt: 5.0,

    toastEl: toast,

    ballImg: null,
    ballImgReady: false,

    dog: null,
    dogImg: null,
    dogImgReady: false,

    tripleCount: 0,
    tripleLastMs: 0,

    onResize: null,
    onPointerDown: null
  };

  runtime.final.ctx = canvas.getContext('2d');

  runtime.final.ballImg = new Image();
  runtime.final.ballImg.onload = function () {
    if (runtime.final) runtime.final.ballImgReady = true;
  };
  runtime.final.ballImg.onerror = function () {
    if (runtime.final) runtime.final.ballImgReady = false;
  };
  runtime.final.ballImg.src = ASSETS.imgHeartBall;

  runtime.final.dogImg = new Image();
  runtime.final.dogImg.onload = function () {
    if (runtime.final) runtime.final.dogImgReady = true;
  };
  runtime.final.dogImg.onerror = function () {
    if (runtime.final) runtime.final.dogImgReady = false;
  };
  runtime.final.dogImg.src = ASSETS.imgNerpaDog;

  runtime.final.onPointerDown = function (ev) {
    if (!runtime.final) return;
    var rect = canvas.getBoundingClientRect();
    var x = ev.clientX - rect.left;
    var y = ev.clientY - rect.top;

    var hit = finalHitBall(x, y);
    if (!hit) return;

    var now = performance.now();
    if (now - runtime.final.tripleLastMs <= 650) runtime.final.tripleCount++;
    else runtime.final.tripleCount = 1;
    runtime.final.tripleLastMs = now;

    if (runtime.final.tripleCount >= 3) {
      runtime.final.tripleCount = 0;
      triggerEasterFromFinal(hit);
    }
  };
  canvas.addEventListener('pointerdown', runtime.final.onPointerDown);

  runtime.final.onResize = function () { finalResizeCanvas(); };
  window.addEventListener('resize', runtime.final.onResize);

  if (replayBtn) replayBtn.addEventListener('click', finalRestartSequence);
  if (clearBtn) clearBtn.addEventListener('click', finalToggleBalls);

  video.muted = true;
  video.loop = true;
  video.play().catch(function(){});
    // ДОБАВЛЕНО: обработка ошибок видео
  video.addEventListener('error', function() {
    var msg = document.createElement('div');
    msg.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;font-size:clamp(18px,4vw,22px);text-align:center;padding:20px;z-index:999;background:rgba(10,12,22,0.85);';
    msg.innerHTML = 'Видео не загрузилось 😢<br><br><button class="btn" onclick="location.reload()">Обновить страницу</button>';
    if (canvas.parentNode) canvas.parentNode.appendChild(msg);
  });


  finalResizeCanvas();

  runtime.final.lastMs = performance.now();
  runtime.final.lastVideoT = 0;

  runtime.final.raf = requestAnimationFrame(finalTick);
}
  
  function teardownFinalRuntime() {
  if (!runtime.final) return;

  if (runtime.final.raf) cancelAnimationFrame(runtime.final.raf);
  if (runtime.final.onResize) window.removeEventListener('resize', runtime.final.onResize);

  if (runtime.final.canvasEl && runtime.final.onPointerDown) {
    runtime.final.canvasEl.removeEventListener('pointerdown', runtime.final.onPointerDown);
  }

  runtime.final = null;
}

  function finalResizeCanvas() {
    if (!runtime.final) return;
    var canvas = runtime.final.canvasEl;
    var ctx = runtime.final.ctx;
    if (!canvas || !ctx) return;

    var rect = canvas.getBoundingClientRect();
    var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // ДОБАВЛЕНО: кэшируем размеры для finalDraw
    runtime.final.cachedW = rect.width;
    runtime.final.cachedH = rect.height;
  }

function finalHitBall(x, y) {
  if (!runtime.final || !runtime.final.balls) return null;

  // ищем с конца: визуально “верхний” шар будет последним отрисованным
  for (var i = runtime.final.balls.length - 1; i >= 0; i--) {
    var b = runtime.final.balls[i];
    var dx = x - b.x;
    var dy = y - b.y;
    if (dx*dx + dy*dy <= b.r*b.r) return b;
  }
  return null;
}

// Заглушка под Стадию 9: пока просто лог в консоль, потом заменим на настоящую пасхалку
function triggerEasterFromFinal(ball) {
  if (!runtime.final) return;
  if (runtime.final.dog) return; // уже есть собака

  var canvas = runtime.final.canvasEl;
  var rect = canvas.getBoundingClientRect();
  var w = rect.width;
  var h = rect.height;

  var dogW = Math.min(w, h) * PHYSICS.DOG_SIZE_RATIO;
  var dogH = dogW * 0.85;

  runtime.final.dog = {
    x: w * 0.5,
    y: h + dogH * 0.6,  // начинаем ЗА экраном снизу
    targetY: h - dogH * 0.35,  // целевая позиция (видна голова)
    w: dogW,
    h: dogH,
    vx: PHYSICS.DOG_SPEED_MIN + Math.random() * (PHYSICS.DOG_SPEED_MAX - PHYSICS.DOG_SPEED_MIN),
    facing: -1,  // ИСПРАВЛЕНО: -1 = смотрит влево (потому что PNG отзеркален)
    emerging: true,
    emergeSpeed: PHYSICS.DOG_EMERGE_SPEED
  };

  finalShowToast();
  finalHideCongrats();
  finalHideHint();
}

  function finalTick(nowMs) {
  if (!runtime.final) return;

  var dt = (nowMs - runtime.final.lastMs) / 1000;
  runtime.final.lastMs = nowMs;
  if (!isFinite(dt) || dt <= 0) dt = 0.016;
  if (dt > 0.05) dt = 0.05;

  var video = runtime.final.videoEl;
  var t = 0;
  if (video) t = video.currentTime || 0;

  // ИСПРАВЛЕНО: детекция лупа видео — НЕ рестартим шары автоматически
  if (t + 0.15 < runtime.final.lastVideoT) {
    // Видео перескочило на начало, но шары НЕ трогаем
  }
  runtime.final.lastVideoT = t;

  // Старт шаров только если НЕ были очищены вручную
  if (!runtime.final.ballsCleared && !runtime.final.ballsStarted && t >= 3.0) {
    runtime.final.ballsStarted = true;
    runtime.final.ballsFade01 = 1;
    runtime.final.fadeMode = 0;
    runtime.final.ballsStartTime = t;  // ДОБАВЛЕНО: запомним время старта
    finalSpawnBalls(); // автоматически по IS_MOBILE
    finalHideHint();
    finalHideCongrats();
    runtime.final.hintAt = t + 2.0 + Math.random() * 3.5;
    runtime.final.congratsAt = t + 5.0;
    runtime.final.hintShown = false;
    runtime.final.congratsShown = false;
  }

  if (runtime.final.ballsStarted && !runtime.final.hintShown && t >= runtime.final.hintAt) {
    runtime.final.hintShown = true;
    finalShowHint();
  }

  if (runtime.final.ballsStarted && !runtime.final.congratsShown && t >= runtime.final.congratsAt) {
    runtime.final.congratsShown = true;
    finalShowCongrats();
  }

  // Заморозка шаров через константу
  var ballsAge = runtime.final.ballsStarted ? (t - (runtime.final.ballsStartTime || 0)) : 0;
  var shouldFreeze = runtime.final.ballsStarted && ballsAge >= PHYSICS.BALL_FREEZE_TIME;

  if (!shouldFreeze) {
    finalUpdateBalls(dt);
  }
  // Если shouldFreeze === true, то finalUpdateBalls не вызывается → шары застывают

  finalUpdateDog(dt);
  finalDraw();

  runtime.final.raf = requestAnimationFrame(finalTick);
}

  function finalShowHint() {
    if (!runtime.final || !runtime.final.hintEl) return;
    runtime.final.hintEl.classList.add('finalHint--show');
  }

  function finalHideHint() {
    if (!runtime.final || !runtime.final.hintEl) return;
    runtime.final.hintEl.classList.remove('finalHint--show');
  }

  function finalRestartSequence() {
    if (!runtime.final) return;

    // ИСПРАВЛЕНО: сбрасываем всё, чтобы шары автоматически стартовали через 3 сек
    runtime.final.ballsStarted = false;
    runtime.final.ballsCleared = false;  // ВАЖНО: снимаем флаг "очищено вручную"
    runtime.final.hintShown = false;
    runtime.final.congratsShown = false;
    finalHardClearBalls();
    finalHideHint();
    finalHideCongrats();
    finalRemoveDog();

    var v = runtime.final.videoEl;
    if (v) {
      try { v.currentTime = 0; } catch (e) {}
      v.play().catch(function(){});
    }
  }

  function finalFadeOutBalls() {
    if (!runtime.final) return;
    runtime.final.fadeMode = 1;
  }

  function finalHardClearBalls() {
    if (!runtime.final) return;
    runtime.final.balls = [];
    runtime.final.ballsFade01 = 1;
    runtime.final.fadeMode = 0;
  }

  function finalSpawnBalls(count) {
  if (!runtime.final) return;

  var canvas = runtime.final.canvasEl;
  var rect = canvas.getBoundingClientRect();
  var w = rect.width;
  var h = rect.height;

  // ИСПРАВЛЕНО: адаптивное кол-во шаров
  if (count === undefined) {
    count = IS_MOBILE ? PHYSICS.BALL_SPAWN_COUNT_MOBILE : PHYSICS.BALL_SPAWN_COUNT;
  }

  var baseR = Math.min(w, h) * 0.16;
  if (!isFinite(baseR)) baseR = 120;
  baseR = clamp(baseR, 70, IS_MOBILE ? 140 : 180); // ИСПРАВЛЕНО: меньше макс размер на мобилках

  runtime.final.balls = [];
  runtime.final.spawn = {
    total: count,
    spawned: 0,
    baseR: baseR,
    w: w,
    h: h,
    nextIn: 0.15 + Math.random() * 0.25
  };
}

function finalUpdateBalls(dt) {
  if (!runtime.final) return;

  // fade-out
  if (runtime.final.fadeMode === 1) {
    runtime.final.ballsFade01 -= dt / 0.35;
    if (runtime.final.ballsFade01 <= 0) {
      runtime.final.ballsFade01 = 0;
      runtime.final.fadeMode = 0;
      runtime.final.balls = [];
      return;
    }
  } else {
    runtime.final.ballsFade01 = 1;
  }

  var balls = runtime.final.balls;
  if (!balls) return;

  var canvas = runtime.final.canvasEl;
  var rect = canvas.getBoundingClientRect();
  var w = rect.width;
  var h = rect.height;

  // --- Постепенный спавн ---
  if (!runtime.final.spawn) {
    runtime.final.spawn = { 
      total: 0, spawned: 0, baseR: Math.min(w, h) * 0.16, 
      w: w, h: h, nextIn: 999 
    };
  }

  runtime.final.spawn.w = w;
  runtime.final.spawn.h = h;

  runtime.final.spawn.nextIn -= dt;
  if (runtime.final.spawn.nextIn <= 0 && 
      runtime.final.spawn.spawned < runtime.final.spawn.total) {
    
    var batch = 2 + Math.floor(Math.random() * 3); // 2-4 штуки
    var left = runtime.final.spawn.total - runtime.final.spawn.spawned;
    if (batch > left) batch = left;

    for (var k = 0; k < batch; k++) {
      var baseR = runtime.final.spawn.baseR;
      var rr = baseR * (0.80 + Math.random() * 0.50);

      // ИСПРАВЛЕНО: равномерный спавн по всей ширине (без centerBias)
      var x = rr + Math.random() * Math.max(1, (w - rr * 2));
      
      // ИСПРАВЛЕНО: появляются ГЛУБОКО за экраном сверху, 
      // постепенно вылезают (от 0.5 до 1.5 высоты экрана выше)
      var y = -rr - h * (0.5 + Math.random() * 1.0);

      balls.push({
        id: runtime.final.spawn.spawned + 1,
        r: rr,
        x: x,
        y: y,
        vx: (Math.random() * 2 - 1) * 2,  // еще меньше дрейфа
        vy: 0,
        hue: Math.floor(Math.random() * 360),
        softness: 0.75 + Math.random() * 0.25,
        
        // ДОБАВЛЕНО: вращение
        rotation: Math.random() * Math.PI * 2,  // начальный угол
        angularVelocity: (Math.random() * 2 - 1) * 0.3  // медленное вращение
      });

      runtime.final.spawn.spawned++;
    }

    runtime.final.spawn.nextIn = 0.20 + Math.random() * 0.35;
  }

  if (balls.length === 0) return;

   // Физика из констант
  var g = PHYSICS.BALL_GRAVITY;
  var air = PHYSICS.BALL_AIR_DRAG;
  var bounce = PHYSICS.BALL_BOUNCE;
  var groundFriction = PHYSICS.BALL_GROUND_FRICTION;

  var maxVy = PHYSICS.BALL_MAX_VY;
  var maxVx = PHYSICS.BALL_MAX_VX;
  
  var angularDrag = 0.98; // сопротивление вращению [web:20]

  var steps = Math.max(1, Math.min(2, Math.ceil(dt / 0.020)));
  var subDt = dt / steps;

  for (var s = 0; s < steps; s++) {
    // integrate
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];

      b.vy += g * subDt;

      // Демпфирование
      b.vx *= air;
      b.vy *= air;
      b.angularVelocity *= angularDrag; // тормозим вращение [web:20]

      // Клампинг скорости
      if (b.vy > maxVy) b.vy = maxVy;
      if (b.vx > maxVx) b.vx = maxVx;
      if (b.vx < -maxVx) b.vx = -maxVx;

      b.x += b.vx * subDt;
      b.y += b.vy * subDt;
      
      // ДОБАВЛЕНО: обновление угла вращения [web:15]
      b.rotation += b.angularVelocity * subDt;

      // walls - мягкие границы + вращение от удара
      if (b.x - b.r < 0) { 
        b.x = b.r; 
        b.vx = Math.abs(b.vx) * bounce; 
        b.vx *= 0.5;
        // добавляем вращение от удара [web:11]
        b.angularVelocity += (Math.random() * 2 - 1) * 0.15;
      }
      if (b.x + b.r > w) { 
        b.x = w - b.r; 
        b.vx = -Math.abs(b.vx) * bounce;
        b.vx *= 0.5;
        b.angularVelocity += (Math.random() * 2 - 1) * 0.15;
      }

      // ceiling
      if (b.y - b.r < 0) {
        b.y = b.r;
        b.vy = Math.abs(b.vy) * bounce;
        b.vy *= 0.5;
        b.angularVelocity += (Math.random() * 2 - 1) * 0.10;
      }

      // floor - сильное успокоение
      if (b.y + b.r > h) {
        b.y = h - b.r;
        b.vy = -Math.abs(b.vy) * bounce;
        b.vx *= groundFriction;

        // Полная остановка на полу
        if (Math.abs(b.vy) < 10) b.vy = 0;
        if (Math.abs(b.vx) < 2) b.vx = 0;
        if (Math.abs(b.angularVelocity) < 0.05) b.angularVelocity = 0;
      }
    }

    // --- ЕЩЕ МЯГЧЕ СТОЛКНОВЕНИЯ: убираем дрожание ---
    for (var a = 0; a < balls.length; a++) {
      for (var c = a + 1; c < balls.length; c++) {
        var A = balls[a];
        var B = balls[c];

        var dx = B.x - A.x;
        var dy = B.y - A.y;
        var dist2 = dx*dx + dy*dy;
        var minD = A.r + B.r;

        if (dist2 <= 0 || dist2 >= minD*minD) continue;

        var dist = Math.sqrt(dist2) || 0.0001;
        var nx = dx / dist;
        var ny = dy / dist;

        var overlap = (minD - dist);
        
        // ИСПРАВЛЕНО: еще мягче коррекция [web:17]
        var avgSoft = (A.softness + B.softness) * 0.5;
        var corr = overlap * 0.25 * avgSoft; // УМЕНЬШЕНО с 0.30
        
        A.x -= nx * corr;
        A.y -= ny * corr;
        B.x += nx * corr;
        B.y += ny * corr;

        // ИСПРАВЛЕНО: минимальная передача импульса
        var rvx = B.vx - A.vx;
        var rvy = B.vy - A.vy;
        var velAlong = rvx * nx + rvy * ny;
        
        if (velAlong > 0) continue;

        // УМЕНЬШЕНО: почти нет отскока
        var restitution = 0.01 * avgSoft; // УМЕНЬШЕНО с 0.02
        var j = -(1.0 + restitution) * velAlong;
        j *= 0.05; // УМЕНЬШЕНО с 0.08 - убирает резонанс [web:17]

        A.vx -= j * nx * 0.5;
        A.vy -= j * ny * 0.5;
        B.vx += j * nx * 0.5;
        B.vy += j * ny * 0.5;

        // УСИЛЕНО: очень сильное гашение [web:20]
        var contactDamp = 0.88; // УМЕНЬШЕНО с 0.92
        A.vx *= contactDamp; 
        A.vy *= contactDamp;
        B.vx *= contactDamp; 
        B.vy *= contactDamp;
        
        // ДОБАВЛЕНО: вращение от столкновения [web:11]
        // Тангенциальная компонента для вращения
        var tx = -ny;
        var ty = nx;
        var tangentVel = rvx * tx + rvy * ty;
        
        // Очень медленное вращение от касания
        var angularImpulse = tangentVel / (A.r + B.r) * 0.08;
        A.angularVelocity -= angularImpulse;
        B.angularVelocity += angularImpulse;
        
        // Гасим угловую скорость
        A.angularVelocity *= 0.95;
        B.angularVelocity *= 0.95;
      }
    }
  }
}

function finalDraw() {
  if (!runtime.final) return;

  var ctx = runtime.final.ctx;
  var canvas = runtime.final.canvasEl;
  if (!ctx || !canvas) return;

  // ИСПРАВЛЕНО: используем кэшированные размеры
  var w = runtime.final.cachedW || canvas.width;
  var h = runtime.final.cachedH || canvas.height;

  ctx.clearRect(0, 0, w, h);

  var balls = runtime.final.balls;
  if (!balls || balls.length === 0) return;

  var a01 = clamp01(runtime.final.ballsFade01);

  var img = runtime.final.ballImg;
  var imgReady = runtime.final.ballImgReady === true;

  for (var i = 0; i < balls.length; i++) {
    var b = balls[i];

    ctx.globalAlpha = 0.95 * a01;

    if (imgReady && img) {
      ctx.drawImage(img, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    } else {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + b.hue + ', 85%, 62%, 0.72)';
      ctx.fill();
    }

        ctx.globalAlpha = 1;
  }

    // Собака-бульдозер
  if (runtime.final.dog && runtime.final.dogImgReady && runtime.final.dogImg) {
    var dog = runtime.final.dog;
    
    // ДОБАВЛЕНО: тень под собакой
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(dog.x, dog.y + dog.h * 0.4, dog.w * 0.4, dog.h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Рисуем собаку
    ctx.save();
    ctx.translate(dog.x, dog.y);
    // ИСПРАВЛЕНО: facing=1 = отзеркалить (PNG смотрит влево)
    if (dog.facing > 0) ctx.scale(-1, 1);
    ctx.globalAlpha = 0.98;
    ctx.drawImage(runtime.final.dogImg, -dog.w * 0.5, -dog.h * 0.5, dog.w, dog.h);
    ctx.restore();
  }
}

function finalUpdateDog(dt) {
  if (!runtime.final || !runtime.final.dog) return;

  var dog = runtime.final.dog;
  var canvas = runtime.final.canvasEl;
  var rect = canvas.getBoundingClientRect();
  var w = rect.width;

  // Анимация выползания снизу
  if (dog.emerging) {
    dog.y -= dog.emergeSpeed * dt;
    if (dog.y <= dog.targetY) {
      dog.y = dog.targetY;
      dog.emerging = false;
    }
  }

  // Горизонтальное движение
  dog.x += dog.vx * dt;

  // ИСПРАВЛЕНО: инвертированная логика (PNG смотрит влево = facing -1)
  if (dog.x - dog.w * 0.5 < 0) {
    dog.x = dog.w * 0.5;
    dog.vx = Math.abs(dog.vx);
    dog.facing = 1; // вправо = нужно отзеркалить PNG
  }
  if (dog.x + dog.w * 0.5 > w) {
    dog.x = w - dog.w * 0.5;
    dog.vx = -Math.abs(dog.vx);
    dog.facing = -1; // влево = оригинальный PNG
  }

  var balls = runtime.final.balls;
  if (!balls) return;

  for (var i = 0; i < balls.length; i++) {
    var b = balls[i];

    var dx = b.x - dog.x;
    var dy = b.y - (dog.y - dog.h * 0.3);
    var dist2 = dx*dx + dy*dy;
    var minD = b.r + dog.w * 0.35;

    if (dist2 > 0 && dist2 < minD*minD) {
      var dist = Math.sqrt(dist2) || 0.001;
      var nx = dx / dist;
      var ny = dy / dist;

      var overlap = minD - dist;
      var push = overlap * 0.6;

      b.x += nx * push;
      b.y += ny * push;

      var velAlong = b.vx * nx + b.vy * ny;
      if (velAlong < 0) {
        var j = -velAlong * 0.8;
        b.vx += j * nx;
        b.vy += j * ny;
      }

      b.vx *= 0.92;
      b.vy *= 0.92;
    }
  }
}

function finalRemoveDog() {
  if (!runtime.final) return;
  runtime.final.dog = null;
}

function finalShowToast() {
  if (!runtime.final || !runtime.final.toastEl) return;
  runtime.final.toastEl.classList.add('finalToast--show');
  setTimeout(function() {
    if (runtime.final && runtime.final.toastEl) {
      runtime.final.toastEl.classList.remove('finalToast--show');
    }
  }, 2200);
}

function finalShowCongrats() {
  if (!runtime.final || !runtime.final.congratsEl) return;
  runtime.final.congratsEl.classList.add('finalCongrats--show');
}

function finalHideCongrats() {
  if (!runtime.final || !runtime.final.congratsEl) return;
  runtime.final.congratsEl.classList.remove('finalCongrats--show');
}

function finalToggleBalls() {
  if (!runtime.final) return;

  var btn = document.getElementById('finalClearBalls');
  if (!btn) return;

  var video = runtime.final.videoEl;
  var t = video ? (video.currentTime || 0) : 0;

  if (runtime.final.ballsCleared) {
    // Был режим "шары убраны" → включаем "Шаропад"
    btn.textContent = 'Убрать шары';
    runtime.final.ballsCleared = false;
    runtime.final.ballsStarted = true;
    runtime.final.ballsFade01 = 1;
    runtime.final.fadeMode = 0;
    runtime.final.ballsStartTime = t;
    finalSpawnBalls(); // ИСПРАВЛЕНО: без аргумента = автоматически по IS_MOBILE
    // УБРАНО: finalHideCongrats() — поздравление остаётся
    runtime.final.congratsShown = true; // принудительно оставляем видимым
  } else {
    // Был режим "шары есть" → убираем шары
    btn.textContent = 'Шаропад';
    runtime.final.ballsCleared = true;
    finalFadeOutBalls();
    finalRemoveDog();
    finalHideCongrats();
  }
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

  // ===== Loading / preload (soft) =====

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
  ASSETS.imgEdward,
  ASSETS.imgTwilightFrame,
  ASSETS.imgDogQ3,
  ASSETS.imgRetroQ1,
  ASSETS.imgKupidonQ4,
  ASSETS.imgHeartBall,
  ASSETS.imgNerpaDog // ДОБАВЛЕНО: прелоад собаки
];
      // Мягкий прогрев видео для финала (чтобы появлялось быстрее)
  // fetch(..., { cache: 'force-cache' }) старается взять/обновить HTTP-кэш. [web:531]
  (function preloadFinalVideoSoft() {
    var v = document.createElement('video');
    var url = ASSETS.videoMp4;

    try {
      if (v && v.canPlayType) {
        var canWebm = v.canPlayType('video/webm');
        if (canWebm && canWebm !== 'no' && ASSETS.videoWebm) url = ASSETS.videoWebm;
      }
    } catch (e) {}

    fetch(url, { cache: 'force-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .catch(function () {});
  })();

    var done = 0;
    // ДОБАВЛЕНО: Горячий старт видео (прогреваем decoder)
var ghost = document.createElement('video');
ghost.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
ghost.muted = true;
ghost.preload = 'auto';
ghost.src = ASSETS.videoMp4;
document.body.appendChild(ghost);
ghost.load();
setTimeout(function(){ if(ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 8000);
    function markDone() {
      done++;
      onProgress01(done / urls.length);
    }

    return Promise.all(urls.map(function (url) {
      return fetch(url, { cache: 'force-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        })
        .catch(function (e) {
          console.warn('Preload skipped:', url, e);
        })
        .then(markDone);
    })).then(function () {
      onProgress01(1);
    });
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

    var resetBound = false;

  function setupGlobalResetOnce() {
    if (resetBound) return;
    resetBound = true;

    var resetBtn = document.getElementById('globalReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        location.reload();
      });
    }

    // ДОБАВЛЕНО: кнопка Mute
    var muteBtn = document.getElementById('globalMute');
    if (muteBtn) {
      muteBtn.addEventListener('click', function () {
        if (!runtime.musicEl) return;
        runtime.musicEl.muted = !runtime.musicEl.muted;
        var icon = document.getElementById('muteIcon');
        if (icon) icon.textContent = runtime.musicEl.muted ? '🔇' : '🔊';
      });
    }
  }
  
  // ===== Utils =====

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  function clamp(x, min, max) {
    if (x < min) return min;
    if (x > max) return max;
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

  function escapeAttr(s) { return escapeHtml(s); }
})();
