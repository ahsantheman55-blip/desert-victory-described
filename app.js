(function () {
  "use strict";

  var DATA = window.DESERT_VICTORY;
  var CUES = (DATA && DATA.cues ? DATA.cues.slice() : []).sort(function (a, b) {
    return a.t - b.t;
  });
  var DURATION = (DATA && DATA.duration) || 4229.5;

  var running = false;
  var paused = false;
  var basePerf = 0;
  var pausedAt = 0;
  var offset = 0; // seconds already elapsed when started or last resumed, plus nudges
  var nextIndex = 0;
  var tickTimer = null;
  var wakeLock = null;
  var keepAwake = false;
  var speakDesc = true;
  var speakNotes = true;

  var el = {
    status: document.getElementById("status"),
    clock: document.getElementById("clock"),
    now: document.getElementById("now"),
    start: document.getElementById("start"),
    pause: document.getElementById("pause"),
    resume: document.getElementById("resume"),
    back: document.getElementById("back"),
    forward: document.getElementById("forward"),
    earlier: document.getElementById("earlier"),
    later: document.getElementById("later"),
    jumpForm: document.getElementById("jump-form"),
    jump: document.getElementById("jump"),
    togDesc: document.getElementById("tog-desc"),
    togNotes: document.getElementById("tog-notes"),
    voice: document.getElementById("voice"),
    rate: document.getElementById("rate"),
    wake: document.getElementById("wake"),
    cueList: document.getElementById("cue-list")
  };

  function pad(n, w) {
    var s = String(Math.floor(Math.abs(n)));
    while (s.length < w) s = "0" + s;
    return s;
  }

  function formatTime(t) {
    if (t < 0) t = 0;
    var cs = Math.floor(t * 10) % 10;
    var s = Math.floor(t) % 60;
    var m = Math.floor(t / 60) % 60;
    var h = Math.floor(t / 3600);
    return h + ":" + pad(m, 2) + ":" + pad(s, 2) + "." + cs;
  }

  function formatCueTime(t) {
    var s = Math.floor(t) % 60;
    var m = Math.floor(t / 60) % 60;
    var h = Math.floor(t / 3600);
    if (h) return h + ":" + pad(m, 2) + ":" + pad(s, 2);
    return m + ":" + pad(s, 2);
  }

  function currentTime() {
    if (!running) return Math.max(0, offset);
    if (paused) return Math.max(0, pausedAt);
    var t = offset + (performance.now() - basePerf) / 1000;
    if (t < 0) t = 0;
    return t;
  }

  function setStatus(text) {
    el.status.textContent = text;
  }

  function setNow(text) {
    el.now.textContent = text;
  }

  function updateButtons() {
    el.pause.disabled = !running || paused;
    el.resume.disabled = !running || !paused;
  }

  function stopSpeech() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  function chosenVoice() {
    var id = el.voice.value;
    if (!id || !window.speechSynthesis) return null;
    var voices = window.speechSynthesis.getVoices();
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].name + "|" + voices[i].lang === id) return voices[i];
    }
    return null;
  }

  function speak(text, kind) {
    if (!window.speechSynthesis || !text) return;
    stopSpeech();
    var u = new SpeechSynthesisUtterance(text);
    var v = chosenVoice();
    if (v) u.voice = v;
    u.rate = parseFloat(el.rate.value) || 1;
    u.lang = (v && v.lang) || "en-GB";
    u.onend = function () {
      if (el.now.textContent.indexOf(text) !== -1) {
        setNow("Waiting for the next cue.");
      }
    };
    window.speechSynthesis.speak(u);
    setNow((kind === "note" ? "Historian’s note. " : "Description. ") + text);
  }

  function enabled(cue) {
    if (cue.type === "note") return speakNotes;
    return speakDesc;
  }

  function seekTo(t, announce) {
    if (t < 0) t = 0;
    if (t > DURATION) t = DURATION;
    stopSpeech();
    offset = t;
    pausedAt = t;
    if (running && !paused) {
      basePerf = performance.now();
    }
    nextIndex = 0;
    while (nextIndex < CUES.length && CUES[nextIndex].t <= t + 0.04) {
      nextIndex += 1;
    }
    el.clock.textContent = formatTime(t);
    if (announce) {
      setStatus("Clock set to " + formatTime(t) + ".");
      setNow("Waiting for the next cue.");
    }
  }

  function startFromZero() {
    running = true;
    paused = false;
    offset = 0;
    nextIndex = 0;
    basePerf = performance.now();
    stopSpeech();
    setStatus("The clock is running. Line it up with the film, and nudge if you need to.");
    setNow("Waiting for the first cue.");
    updateButtons();
    if (keepAwake) requestWake();
    startTick();
  }

  function pauseClock() {
    if (!running || paused) return;
    pausedAt = currentTime();
    paused = true;
    el.clock.textContent = formatTime(pausedAt);
    stopSpeech();
    setStatus("Paused at " + formatTime(pausedAt) + ".");
    updateButtons();
  }

  function resumeClock() {
    if (!running || !paused) return;
    offset = pausedAt;
    paused = false;
    basePerf = performance.now();
    setStatus("Resumed at " + formatTime(offset) + ".");
    updateButtons();
  }

  function nudge(seconds, label) {
    var t = currentTime() + seconds;
    var wasPaused = paused;
    seekTo(t, false);
    if (running && !wasPaused) {
      paused = false;
      basePerf = performance.now();
    }
    setStatus(label + " Clock now " + formatTime(currentTime()) + ".");
  }

  function parseJump(raw) {
    raw = (raw || "").trim();
    if (!raw) return null;
    var parts = raw.split(/[:.]/);
    if (parts.length === 1 && /^\d+$/.test(parts[0])) {
      return parseInt(parts[0], 10);
    }
    if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    if (parts.length === 3 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
      return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
    }
    return null;
  }

  function tick() {
    var t = currentTime();
    el.clock.textContent = formatTime(t);
    if (!running || paused) return;
    while (nextIndex < CUES.length && CUES[nextIndex].t <= t) {
      var cue = CUES[nextIndex];
      nextIndex += 1;
      if (enabled(cue)) {
        speak(cue.text, cue.type);
      }
    }
    if (t >= DURATION + 1) {
      pauseClock();
      setStatus("The Archive copy has finished, at 1 hour 10 minutes 29.5 seconds.");
    }
  }

  function startTick() {
    if (tickTimer) return;
    tickTimer = setInterval(tick, 100);
  }

  function fillVoices() {
    if (!window.speechSynthesis) return;
    var voices = window.speechSynthesis.getVoices();
    var current = el.voice.value;
    el.voice.innerHTML = "";
    var opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Default system voice";
    el.voice.appendChild(opt);
    var prefer = null;
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      var o = document.createElement("option");
      o.value = v.name + "|" + v.lang;
      o.textContent = v.name + " (" + v.lang + ")";
      el.voice.appendChild(o);
      if (!prefer && /en-GB/i.test(v.lang)) prefer = o.value;
    }
    var found = false;
    for (var j = 0; j < el.voice.options.length; j++) {
      if (el.voice.options[j].value === current) { found = true; break; }
    }
    if (found) el.voice.value = current;
    else if (prefer) el.voice.value = prefer;
  }

  function requestWake() {
    if (!navigator.wakeLock || !keepAwake) return;
    navigator.wakeLock.request("screen").then(function (lock) {
      wakeLock = lock;
      lock.addEventListener("release", function () {
        if (keepAwake && running && !paused) requestWake();
      });
    }).catch(function () {
      setStatus(el.status.textContent + " The keep-awake request was refused.");
    });
  }

  async function releaseWake() {
    if (wakeLock) {
      try { await wakeLock.release(); } catch (e) {}
      wakeLock = null;
    }
  }

  function setPressed(button, on, onLabel, offLabel) {
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.textContent = on ? onLabel : offLabel;
  }

  function renderCueList() {
    el.cueList.innerHTML = "";
    for (var i = 0; i < CUES.length; i++) {
      var c = CUES[i];
      var li = document.createElement("li");
      var tag = c.type === "note" ? "Historian’s note" : "Description";
      li.innerHTML = "<span class=\"tag\">" + formatCueTime(c.t) + " — " + tag + ".</span> " + escapeHtml(c.text);
      el.cueList.appendChild(li);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  el.start.addEventListener("click", function () {
    startFromZero();
  });
  el.pause.addEventListener("click", pauseClock);
  el.resume.addEventListener("click", resumeClock);
  el.back.addEventListener("click", function () { nudge(-5, "Went back 5 seconds."); });
  el.forward.addEventListener("click", function () { nudge(5, "Went forward 5 seconds."); });
  el.earlier.addEventListener("click", function () { nudge(1, "Nudged one second earlier. The spoken cues will now come one second sooner."); });
  el.later.addEventListener("click", function () { nudge(-1, "Nudged one second later. The spoken cues will now come one second later."); });
  el.jumpForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var t = parseJump(el.jump.value);
    if (t === null) {
      setStatus("I could not read that time. Try 25:40, or 1:02:00.");
      el.jump.focus();
      return;
    }
    var wasRunning = running;
    var wasPaused = paused;
    if (!wasRunning) {
      running = true;
      paused = true;
    }
    seekTo(t, true);
    if (wasRunning && !wasPaused) {
      paused = false;
      basePerf = performance.now();
    }
    updateButtons();
    startTick();
  });

  el.togDesc.addEventListener("click", function () {
    speakDesc = !speakDesc;
    setPressed(el.togDesc, speakDesc, "Descriptions on", "Descriptions off");
    if (!speakDesc) stopSpeech();
  });
  el.togNotes.addEventListener("click", function () {
    speakNotes = !speakNotes;
    setPressed(el.togNotes, speakNotes, "Historian’s notes on", "Historian’s notes off");
    if (!speakNotes) stopSpeech();
  });
  el.wake.addEventListener("click", function () {
    keepAwake = !keepAwake;
    setPressed(el.wake, keepAwake, "Keep the screen awake: on", "Keep the screen awake: off");
    if (keepAwake) requestWake();
    else releaseWake();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && keepAwake && running && !paused) {
      requestWake();
    }
  });

  if (window.speechSynthesis) {
    fillVoices();
    window.speechSynthesis.onvoiceschanged = fillVoices;
  }

  renderCueList();
  startTick();
  updateButtons();
})();
