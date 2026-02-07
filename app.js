(function () {
  'use strict';

  var STORAGE_KEY = 'valentine_state_v1';
  var APP_VERSION = 'v1';

  // Фикс-тексты (НЕ МЕНЯТЬ)
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

    TOAST_CORRECT: 'ВЕРНО!',
    WRONG_POPUP_TEXT: 'Ой ой ой, ошибОчка… Попробуй ещё раз',
    WRONG_POPUP_BTN: 'Ещё раз',

    EDWARD_TITLE: 'Эдвард Каллен',
    EDWARD_OK: 'Окей'
  };

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

  // Тайминги (только то, что в ТЗ явно указано)
  var T = {
    TOAST_IN_MS: 160,
    TOAST_HOLD_MS: 900,
    TOAST_OUT_MS: 160,

    MEM_TEXT_MS: 700,          // Q2 мем-текст 700ms
    EDWARD_SCALE_IN_MS: 260,   // scale-in 260ms (делаем CSS transition)
    EDWARD_SHAKE_MS: 600       // shake 600ms (CSS keyframes)
  };

  var state = getDefaultState();

  var runtime = {
    preloadStarted: false,
    preloadDone: false,
    target01: 0,
    shown01: 0,
    rafId: 0,

    musicEl: null,
    musicResumeArmed: false,

    prologue: {
      scrollEl: null,
      anchorEl: null,
      scrollRaf: 0
    },

    overlayEl: null,
    toastEl: null,

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
      saveState(); // сохраняем нормализованное состояние
    }

    ensureRoot();
    if (!state.screenId) state.screenId = 'loading';

    renderScreen();
    armMusicResumeOnNextUserGestureIfNeeded();
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
      climax: { noRunCount: 0 },
      finale: {
        videoStarted: false,
        ballsStarted: false,
        ballsFullyCovered: false,
        easterHintShown: false,
        nerpaActivated: false
      },
      audio: { musicStarted: false }
    };
  }

  // Нормализация (защита от “битого/старого” state в localStorage)
  function normalizeState(loaded) {
    var d = getDefaultState();
    if (!loaded || typeof loaded !== 'object') return d;

    // screenId
    if (typeof loaded.screenId === 'string') d.screenId = loaded.screenId;

    // prologueScrollDone
    d.prologueScrollDone = !!loaded.prologueScrollDone;

    // audio
    if (loaded.audio && typeof loaded.audio === 'object') {
      d.audio.musicStarted = !!loaded.audio.musicStarted;
    }

    // quiz
    if (loaded.quiz && typeof loaded.quiz === 'object') {
      d.quiz.currentQuestion = clampInt(loaded.quiz.currentQuestion, 1, 5);

      if (Array.isArray(loaded.quiz.answers) && loaded.quiz.answers.length === 5) {
        d.quiz.answers = loaded.quiz.answers.slice(0, 5);
      }
      if (Array.isArray(loaded.quiz.isCorrect) && loaded.quiz.isCorrect.length === 5) {
        d.quiz.isCorrect = loaded.quiz.isCorrect.map(function (v) { return !!v; }).slice(0, 5);
      }
      if (Array.isArray(loaded.quiz.attempts) && loaded.quiz.attempts.length === 5) {
        d.quiz.attempts = loaded.quiz.attempts.map(function (v) { return clampInt(v, 0, 9999); }).slice(0, 5);
      }

      d.quiz.edwardShown = !!loaded.quiz.edwardShown;
    }

    // climax/finale
    if (loaded.climax && typeof loaded.climax === 'object') {
      d.climax.noRunCount = clampInt(loaded.climax.noRunCount, 0, 9999);
    }
    if (loaded.finale && typeof loaded.finale === 'object') {
      d.finale.videoStarted = !!loaded.finale.videoStarted;
      d.finale.ballsStarted = !!loaded.finale.ballsStarted;
      d.finale.ballsFullyCovered = !!loaded.finale.ballsFullyCovered;
      d.finale.easterHintShown = !!loaded.finale.easterHintShown;
      d.finale.nerpaActivated = !!loaded.finale.nerpaActivated;
    }

    return d;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      // appVersion в ТЗ строка; мы не ломаем совместимость — просто нормализуем
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

  function ensureRoot() {
    if (!appEl) return;

    appEl.innerHTML = ''
      + '<div class="stage" role="application">'
      + '  <div class="stageBg" id="stageBg"></div>'
      + '  <div class="safe" id="safeRoot"></div>'
      + '  <div class="toast" id="toast"><div class="toastBox" id="toastBox"></div></div>'
      + '  <div class="overlay" id="overlay" aria-hidden="true"></div>'
      + '</div>';

    runtime.overlayEl = document.getElementById('overlay');
    runtime.toastEl = document.getElementById('toast');
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
    requestPrologueUpdate();
  }

  function teardownPrologueRuntime() {
    if (runtime.prologue.scrollEl) runtime.prologue.scrollEl.removeEventListener('scroll', onPrologueScroll);
    if (runtime.prologue.scrollRaf) cancelAnimationFrame(runtime.prologue.scrollRaf);
    runtime.prologue.scrollEl = null;
    runtime.prologue.anchorEl = null;
    runtime.prologue.scrollRaf = 0;
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

    var st = scrollEl.scrollTop;

    var bg = document.getElementById('stageBg');
    if (bg) {
      var max = Math.max(1, scrollEl.scrollHeight - scrollEl.clientHeight);
      var t = clamp01(st / max);
      var y = -Math.round(t * 18);
      bg.style.transform = 'translate3d(0,' + y + 'px,0) scale(1.045)';
    }

    var threshold = anchorEl.offsetTop - 20;
    if (st >= threshold) {
      state.prologueScrollDone = true;
      saveState();
      goToScreen('quiz');
    }
  }

  // ===== QUIZ data =====

  var QUIZ = [
    {
      id: 1,
      text: 'Юбилейный уровень: 10‑е 14 февраля вместе. Сколько дней прошло с нашего первого?',
      answers: ['3640', '3654', '3670', '3699'],
      correctIndex: 1,
      repeatOnWrong: true,
      compliment: 'Ты — мой дом, даже когда мы не дома'
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
      answers: ['Хочу скорее увидеть твою стрелу'],
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

  function qIndexFromState() {
    return clampInt(state.quiz.currentQuestion, 1, 5) - 1;
  }

  function renderQuiz() {
    // На всякий случай: если вдруг состояние снова “битое” — нормализуем на лету
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
      + '  <div class="quizAnswersArea" id="qAnswers"></div>'
      + '</div>';

    var qText = wrap.querySelector('#qText');
    var qMedia = wrap.querySelector('#qMedia');
    var qAnswers = wrap.querySelector('#qAnswers');

    qText.textContent = q.text || '';

    qMedia.innerHTML = '';

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

    if (q.showTimer) {
      var timer = document.createElement('div');
      timer.className = 'quizTimer';
      timer.id = 'q3Timer';
      timer.innerHTML = '1<span class="quizTimerColon">:</span>00';
      qMedia.appendChild(timer);
    }

    if (q.id === 5) {
      var plaque = document.createElement('div');
      plaque.className = 'colorPlaque';
      plaque.innerHTML =
        '<div class="colorSwatch" style="background:#ADFF2F;"></div>' +
        '<div class="colorLabel">Kinetic Yellow</div>';
      qMedia.appendChild(plaque);
    }

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

    // “назад” всегда доступна (но на Q1 просто ничего не делает)
    backBtn.disabled = false;
    nextBtn.disabled = !canGoNextFromCurrent();

    backBtn.addEventListener('click', function () {
      var qI = qIndexFromState();
      if (qI <= 0) return;
      state.quiz.currentQuestion = qI; // previous question number
      saveState();
      renderScreen();
    });

    nextBtn.addEventListener('click', function () {
      if (!canGoNextFromCurrent()) return;
      var qI = qIndexFromState();
      if (qI >= 4) return; // на Стадии 6 будет переход к RESULT
      state.quiz.currentQuestion = qI + 2;
      saveState();
      renderScreen();
    });

    return wrap;
  }

  function canGoNextFromCurrent() {
    var qIdx = qIndexFromState();

    // Q1/Q2/Q5: вперед только после верного
    if (qIdx === 0 || qIdx === 1 || qIdx === 4) return state.quiz.isCorrect[qIdx] === true;

    // Q3/Q4: верно после выбора/клика
    return state.quiz.isCorrect[qIdx] === true;
  }

  function selectAnswer(answerIndex) {
    var qIdx = qIndexFromState();
    var q = QUIZ[qIdx];

    runtime.wrongHold.active = false;
    runtime.wrongHold.qIdx = -1;
    runtime.wrongHold.ansIdx = -1;

    state.quiz.answers[qIdx] = answerIndex;
    saveState();

    // Q3/Q4 всегда верно
    if (q.alwaysCorrect) {
      state.quiz.isCorrect[qIdx] = true;
      saveState();

      showToast(UI.TOAST_CORRECT);
      showComplimentLine(q.id);

      renderScreen();
      return;
    }

    var isCorrect = (answerIndex === q.correctIndex);

    if (isCorrect) {
      state.quiz.isCorrect[qIdx] = true;
      saveState();

      showToast(UI.TOAST_CORRECT);

      if (q.id === 2) {
        // строго: после верного Q2: toast → комплимент → Edward (1 раз)
        setTimeout(function () {
          showComplimentLine(2);
          runEdwardBlockIfNeeded();
        }, T.TOAST_IN_MS);
      } else {
        showComplimentLine(q.id);
      }

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

      renderScreen(); // важно: чтобы подсветка применялась через runtime.wrongHold

      showModal(UI.WRONG_POPUP_TEXT, UI.WRONG_POPUP_BTN, function () {
        runtime.wrongHold.active = false;
        runtime.wrongHold.qIdx = -1;
        runtime.wrongHold.ansIdx = -1;
        renderScreen();
      });

      return;
    }
  }

  function showComplimentLine(qId) {
    var line = '';
    if (qId === 1) line = 'Ты — мой дом, даже когда мы не дома';
    if (qId === 2) line = 'Ты — мой личный сорт героина';
    if (qId === 3) line = 'Ты — лучшее, что со мной случалось!';
    if (qId === 4) line = 'Ты — самая красивая, умная, заботливая, понимающая и сексуальная женщина!';
    if (qId === 5) line = 'Спасибо за твою поддержку!';

    if (!line) return;

    var safeRoot = document.getElementById('safeRoot');
    if (!safeRoot) return;

    var old = document.getElementById('memLine');
    if (old) old.remove();

    var el = document.createElement('div');
    el.id = 'memLine';
    el.className = 'memLine';
    el.textContent = line;

    el.style.position = 'absolute';
    el.style.top = '92px';
    el.style.left = '0';
    el.style.right = '0';
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '11';

    safeRoot.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('memLine--show'); });

    // Для Q2 строго 700ms; для остальных держим столько же, сколько toast hold (900ms)
    var keepMs = (qId === 2) ? T.MEM_TEXT_MS : T.TOAST_HOLD_MS;

    setTimeout(function () {
      if (!el || !el.parentNode) return;
      el.classList.remove('memLine--show');
      setTimeout(function () {
        if (el && el.parentNode) el.remove();
      }, 240);
    }, keepMs);
  }

  function runEdwardBlockIfNeeded() {
    if (state.quiz.edwardShown === true) return;

    state.quiz.edwardShown = true;
    saveState();

    setTimeout(function () {
      showEdwardModal();
    }, T.MEM_TEXT_MS);
  }

  function showEdwardModal() {
    var html = ''
      + '<div class="modalHeader">'
      + '  <div class="modalTitle">' + escapeHtml(UI.EDWARD_TITLE) + '</div>'
      + '  <button class="modalClose" id="modalCloseBtn" type="button" aria-label="закрыть">×</button>'
      + '</div>'
      + '<img class="modalImg" src="' + escapeAttr(ASSETS.imgEdward) + '" alt="" />';

    var modalEl = showModalCustom(html, UI.EDWARD_OK, function(){});
    if (modalEl) {
      // shake 600ms (если reduce-motion — смягчим позже на Стадии 11)
      requestAnimationFrame(function () {
        modalEl.classList.add('modal--shake');
      });
    }
  }

  // ===== Toast =====

  function showToast(text) {
    var toast = runtime.toastEl;
    var box = document.getElementById('toastBox');
    if (!toast || !box) return;

    box.textContent = text;
    toast.classList.add('toast--show');

    setTimeout(function () {
      toast.classList.remove('toast--show');
    }, T.TOAST_IN_MS + T.TOAST_HOLD_MS + T.TOAST_OUT_MS);
  }

  // ===== Modal =====

  function showModal(text, buttonText, onClose) {
    var html = '<p class="modalText">' + escapeHtml(text) + '</p>';
    return showModalCustom(html, buttonText, onClose);
  }

  function showModalCustom(innerHtml, buttonText, onClose) {
    var overlay = runtime.overlayEl;
    if (!overlay) return null;

    overlay.innerHTML = ''
      + '<div class="modal" id="modalRoot">'
      + innerHtml
      + '<button class="btn" id="modalOkBtn" type="button">' + escapeHtml(buttonText) + '</button>'
      + '</div>';

    overlay.classList.add('overlay--show');
    overlay.setAttribute('aria-hidden', 'false');

    var ok = document.getElementById('modalOkBtn');
    var close = document.getElementById('modalCloseBtn');
    var modalRoot = document.getElementById('modalRoot');

    function done() {
      overlay.classList.remove('overlay--show');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = '';
      if (typeof onClose === 'function') onClose();
    }

    ok.addEventListener('click', done);
    if (close) close.addEventListener('click', done);

    return modalRoot;
  }

  // ===== Q3 timer =====

  function startQ3TimerIfNeeded() {
    stopQ3Timer();
    var qIdx = qIndexFromState();
    if (qIdx !== 2) return;

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

    var sec = Math.floor(leftMs / 1000); // 60..0
    var mm = Math.floor(sec / 60);       // 1..0
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

    var p = runtime.musicEl.play();
    if (p && typeof p.then === 'function') {
      p.then(function () {
        state.audio.musicStarted = true;
        saveState();
      }).catch(function (e) {
        console.warn('Music play() blocked/failed:', e);
      });
    } else {
      state.audio.musicStarted = true;
      saveState();
    }
  }

  function armMusicResumeOnNextUserGestureIfNeeded() {
    if (!state.audio || state.audio.musicStarted !== true) return;
    if (runtime.musicResumeArmed) return;
    if (state.screenId === 'loading' || state.screenId === 'start') return;

    runtime.musicResumeArmed = true;

    var fired = false;

    function fireOnce() {
      if (fired) return;
      fired = true;

      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);

      startMusicFromUserGesture();
    }

    function onClick() { fireOnce(); }

    function onKeyDown(e) {
      if (!e) return;
      if (e.key === 'Enter' || e.key === ' ') fireOnce();
    }

    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  // ===== LOADING preload =====

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
      + '  <path d="M26 18 C28 14, 32 12, 36 12" stroke="rgba(255,255,255,0.18)" stroke-width="3" stroke-linecap="round"></path>'
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

    var items = urls.map(function (url) {
      return { url: url, loaded: 0, total: 0, known: false, done: false };
    });

    function update() {
      var n = items.length;
      var sum = 0;
      for (var i = 0; i < n; i++) {
        var it = items[i];
        var ratio = 0;
        if (it.known && it.total > 0) ratio = it.loaded / it.total;
        else ratio = it.done ? 1 : 0;
        sum += clamp01(ratio);
      }
      onProgress01(sum / n);
    }

    update();

    var tasks = items.map(function (it) {
      return fetchWithProgress(it.url, function (loaded, total, known) {
        it.loaded = loaded;
        it.total = total;
        it.known = known;
        update();
      }).then(function () {
        it.done = true;
        update();
      });
    });

    return Promise.all(tasks).then(function () { onProgress01(1); });
  }

  function fetchWithProgress(url, onItemProgress) {
    return fetch(url, { cache: 'force-cache' }).then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ' for ' + url);

      var body = resp.body;
      var lenHeader = resp.headers.get('Content-Length');
      var total = lenHeader ? parseInt(lenHeader, 10) : 0;
      var known = !!(total && total > 0);

      if (!body || !body.getReader) {
        return resp.arrayBuffer().then(function (buf) {
          var size = known ? total : (buf ? buf.byteLength : 0);
          onItemProgress(size, size, known || !!size);
        });
      }

      var reader = body.getReader();
      var loaded = 0;

      onItemProgress(0, total, known);

      function readNext() {
        return reader.read().then(function (res) {
          if (res.done) {
            onItemProgress(loaded, known ? total : loaded, known);
            return;
          }
          loaded += res.value.byteLength;
          onItemProgress(loaded, total, known);
          return readNext();
        });
      }

      return readNext();
    });
  }

  function startLoadingLoop() {
    if (runtime.rafId) return;

    function tick() {
      if (state.screenId !== 'loading') {
        runtime.rafId = 0;
        return;
      }

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
    if (runtime.rafId) {
      cancelAnimationFrame(runtime.rafId);
      runtime.rafId = 0;
    }
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

  // ===== utils =====

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
