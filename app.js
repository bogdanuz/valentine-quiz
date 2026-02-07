(function () {
  'use strict';

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

  var UI = {
    START_BTN: 'Начать',
    LOADING_A11Y: 'Загрузка…'
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

  var T = {
    BASE_TRANSITION_MS: 280,
    START_TO_PROLOGUE_ZOOM_MS: 400
  };

  var state = getDefaultState();

  var runtime = {
    preloadStarted: false,
    preloadDone: false,
    preloadFailed: false,

    target01: 0,
    shown01: 0,
    rafId: 0,

    musicEl: null,
    musicResumeArmed: false,

    prologue: {
      scrollEl: null,
      anchorEl: null,
      scrollRaf: 0,
      lastScrollTop: 0
    }
  };

  var appEl = document.getElementById('app');

  init();

  function init() {
    var restored = loadState();
    if (restored) state = restored;

    ensureRoot();
    if (!state.screenId) state.screenId = 'loading';

    renderScreen();
    armMusicResumeOnNextUserGestureIfNeeded();

    if (isDev()) {
      window.__valentineDebug = {
        getState: function(){ return state; },
        goToScreen: goToScreen,
        saveState: saveState,
        resetState: function(){
          state = getDefaultState();
          saveState();

          runtime.preloadStarted = false;
          runtime.preloadDone = false;
          runtime.preloadFailed = false;

          runtime.target01 = 0;
          runtime.shown01 = 0;
          stopLoadingLoop();

          runtime.musicEl = null;
          runtime.musicResumeArmed = false;

          teardownPrologueRuntime();

          renderScreen();
          armMusicResumeOnNextUserGestureIfNeeded();
        }
      };
    }
  }

  function getDefaultState() {
    return {
      appVersion: APP_VERSION,
      screenId: 'loading', // enum {loading,start,prologue,quiz,result,climax,final}
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

  function goToScreen(screenId) {
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

    teardownPrologueRuntime();

    state.screenId = screenId;
    saveState();
    renderScreen();

    if (state.screenId === 'prologue') {
      setupPrologueRuntime();
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

        preloadAssets(function (p01) {
          runtime.target01 = clamp01(p01);
        }).then(function () {
          runtime.preloadDone = true;
          runtime.target01 = 1;
        }).catch(function (e) {
          runtime.preloadFailed = true;
          console.error('Preload failed:', e);
        });
      }

      return;
    }

    if (state.screenId === 'start') {
      // сброс inline transform, если он остался от пролога
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
      // Стадия 4: только “не-скроллящийся” экран-заглушка.
      var ph = document.createElement('div');
      ph.className = 'quizPlaceholder';
      ph.setAttribute('aria-label', 'Квиз');
      screenEl.appendChild(ph);

      safeRoot.appendChild(screenEl);
      requestAnimationFrame(function () { screenEl.classList.add('screen--active'); });
      stopLoadingLoop();
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

  // =========================
  // ПРОЛОГ (скролл + параллакс + якорь квиза)
  // =========================

  function renderPrologue() {
    var wrap = document.createElement('div');
    wrap.className = 'prologueScroll';
    wrap.id = 'prologueScroll';

    // ВАЖНО: больше не показываем “плашку-плейсхолдер” в прологе (она путала).
    // Оставляем только спейсеры + якорь.
    wrap.innerHTML = ''
      + '<section class="prologueGreetingSection" id="prologueGreeting">'
      + '  <div class="prologueGreetingCard">' + escapeHtml(FIXED.PROLOGUE) + '</div>'
      + '</section>'
      + '<div class="prologueSpacerMid"></div>'
      + '<div class="quizAnchor" id="quizAnchor"></div>'
      + '<div style="height: 480px;"></div>';

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
    if (runtime.prologue.scrollEl) {
      // removeEventListener: достаточно указать тип и функцию
      runtime.prologue.scrollEl.removeEventListener('scroll', onPrologueScroll);
    }
    if (runtime.prologue.scrollRaf) {
      cancelAnimationFrame(runtime.prologue.scrollRaf);
      runtime.prologue.scrollRaf = 0;
    }
    runtime.prologue.scrollEl = null;
    runtime.prologue.anchorEl = null;
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
    runtime.prologue.lastScrollTop = st;

    // Деликатный параллакс фона
    var bg = document.getElementById('stageBg');
    if (bg) {
      var max = Math.max(1, scrollEl.scrollHeight - scrollEl.clientHeight);
      var t = clamp01(st / max);
      var y = -Math.round(t * 18);
      bg.style.transform = 'translate3d(0,' + y + 'px,0) scale(1.045)';
    }

    // Якорь квиза → переход на экран quiz и остановка скролла (по ТЗ)
    var threshold = anchorEl.offsetTop - 20;
    if (st >= threshold && state.prologueScrollDone !== true) {
      state.prologueScrollDone = true;
      saveState();
      goToScreen('quiz');
    }
  }

  // =========================
  // Audio
  // =========================

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

  // =========================
  // LOADING
  // =========================

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

  // =========================
  // Utils
  // =========================

  function clamp01(x) {
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  function isDev() {
    return new URLSearchParams(location.search).get('dev') === '1';
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // Заготовки под следующие стадии
  function showToast(text) { void text; }
  function showModal(text, buttonText, onClose) { void text; void buttonText; void onClose; }
  function selectAnswer(questionIndex, answerIndex) { void questionIndex; void answerIndex; }
  function validate(questionIndex) { void questionIndex; return false; }
  function startFinalTimeline() {}
})();
