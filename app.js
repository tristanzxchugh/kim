(function () {
  'use strict';

  const TZ = 'Asia/Manila';
  const STORAGE_KEY = 'kim-date-plan-v1';
  const OFFSET = 8 * 3600 * 1000;
  const EMAIL_CONFIG = {
    publicKey: 'YOUR_EMAILJS_PUBLIC_KEY',
    serviceId: 'YOUR_EMAILJS_SERVICE_ID',
    templateId: 'YOUR_EMAILJS_TEMPLATE_ID',
    recipientEmail: 'reyestristanhilario@gmail.com',
  };
  const JOTFORM_CONFIG = {
    formId: 'YOUR_JOTFORM_FORM_ID',
    fields: {
      idea: 'q3_idea',
      suggestion: 'q4_suggestion',
      date: 'q5_date',
      time: 'q6_time',
      confirmed_at: 'q7_confirmedAt',
    },
  };
  const WEB3FORMS_CONFIG = {
    accessKey: '38dbc518-667c-40ca-9c9e-3ee097254bba',
  };

  const state = {
    screen: 1,
    envelopeOpened: false,
    declined: false,
    idea: null,
    suggestion: '',
    date: null,
    time: null,
    confirmed: false,
    emailSent: false,
  };

  function manilaNowShifted() { return new Date(Date.now() + OFFSET); }
  function todayIso() { return manilaNowShifted().toISOString().slice(0, 10); }
  function shiftedFromIso(iso) { return new Date(iso + 'T00:00:00Z'); }
  function actualFromIso(iso) { return new Date(iso + 'T00:00:00+08:00'); }
  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }
  function parseDate(s) { return shiftedFromIso(s); }
  function formatLongDate(s) {
    const d = actualFromIso(s);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }).format(d);
  }
  function formatIdea(idea) {
    if (idea === 'picnic') return 'Picnic';
    if (idea === 'coffee') return 'Coffee';
    if (idea === 'yours') return 'Your Idea';
    return '';
  }
  function validSuggestion(v) { return v.trim().length > 0 && v.trim().length <= 300; }
  function emailConfigured() {
    return !EMAIL_CONFIG.publicKey.startsWith('YOUR_') &&
      !EMAIL_CONFIG.serviceId.startsWith('YOUR_') &&
      !EMAIL_CONFIG.templateId.startsWith('YOUR_');
  }
  function jotformConfigured() {
    return !JOTFORM_CONFIG.formId.startsWith('YOUR_') && JOTFORM_CONFIG.formId.trim() !== '';
  }
  function web3formsConfigured() {
    return !WEB3FORMS_CONFIG.accessKey.startsWith('YOUR_') && WEB3FORMS_CONFIG.accessKey.trim() !== '';
  }
  function initEmail() {
    if (window.emailjs && emailConfigured()) {
      try { emailjs.init({ publicKey: EMAIL_CONFIG.publicKey }); } catch (e) { /* ignore */ }
    }
  }
  let emailSending = false;
  async function sendDateEmail() {
    const status = $('email-status');
    const retry = $('btn-retry-email');
    if (!status) return;
    if (state.emailSent) {
      status.hidden = false;
      status.textContent = 'Date details sent successfully. ♡';
      if (retry) retry.hidden = true;
      return;
    }
    if (emailSending) return;
    if (jotformConfigured()) {
      emailSending = true;
      status.hidden = false;
      status.textContent = 'Sending to Jotform…';
      try {
        const form = document.createElement('form');
        form.action = 'https://submit.jotform.com/submit/' + encodeURIComponent(JOTFORM_CONFIG.formId);
        form.method = 'POST';
        form.target = '_blank';
        form.style.display = 'none';
        const values = {
          idea: formatIdea(state.idea),
          suggestion: state.suggestion && state.suggestion.trim() ? state.suggestion.trim() : 'None',
          date: state.date ? formatLongDate(state.date) : '',
          time: state.time ? `${formatTime(state.time)} (Philippine time)` : '',
          confirmed_at: new Date().toLocaleString('en-US', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }),
        };
        Object.keys(JOTFORM_CONFIG.fields).forEach(key => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = JOTFORM_CONFIG.fields[key];
          input.value = values[key] || '';
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        state.emailSent = true;
        saveState();
        status.textContent = 'Sent to Jotform in a new tab. ♡';
        if (retry) retry.hidden = true;
      } catch (err) {
        console.error('Jotform submit failed:', err);
        status.textContent = 'Could not submit to Jotform.';
        if (retry) retry.hidden = false;
      } finally {
        emailSending = false;
      }
      return;
    }
    if (web3formsConfigured()) {
      emailSending = true;
      status.hidden = false;
      status.textContent = 'Sending via Web3Forms…';
      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            access_key: WEB3FORMS_CONFIG.accessKey,
            subject: 'New date plan from Kim',
            from_name: 'Kim Date Invitation',
            idea: formatIdea(state.idea),
            suggestion: state.suggestion && state.suggestion.trim() ? state.suggestion.trim() : 'None',
            date: state.date ? formatLongDate(state.date) : '',
            time: state.time ? `${formatTime(state.time)} (Philippine time)` : '',
            confirmed_at: new Date().toLocaleString('en-US', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.success === true || data.success === 'true') {
          state.emailSent = true;
          saveState();
          status.textContent = 'Date details sent successfully. ♡';
          if (retry) retry.hidden = true;
        } else {
          throw new Error(data.message || 'Web3Forms failed');
        }
      } catch (err) {
        console.error('Web3Forms send failed:', err);
        status.textContent = 'Could not send via Web3Forms. Check your access key.';
        if (retry) retry.hidden = false;
      } finally {
        emailSending = false;
      }
      return;
    }
    if (!window.emailjs || !emailConfigured()) {
      // Fallback: FormSubmit (no account/keys required; recipient must activate once)
      try {
        const res = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(EMAIL_CONFIG.recipientEmail), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            _subject: 'New date plan from Kim',
            idea: formatIdea(state.idea),
            suggestion: state.suggestion && state.suggestion.trim() ? state.suggestion.trim() : 'None',
            date: state.date ? formatLongDate(state.date) : '',
            time: state.time ? `${formatTime(state.time)} (Philippine time)` : '',
            confirmed_at: new Date().toLocaleString('en-US', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.success === 'true' || data.success === true) {
          state.emailSent = true;
          saveState();
          status.textContent = 'Date details sent successfully. ♡';
          if (retry) retry.hidden = true;
          emailSending = false;
          return;
        }
        throw new Error(data.message || 'FormSubmit failed');
      } catch (err) {
        console.error('Email send failed:', err);
        status.textContent = 'Email not activated yet. Check the recipient inbox for the FormSubmit activation link, then retry.';
        if (retry) retry.hidden = false;
        emailSending = false;
        return;
      }
    }
    emailSending = true;
    if (retry) retry.hidden = true;
    status.hidden = false;
    status.textContent = 'Sending date details…';
    const params = {
      to_email: EMAIL_CONFIG.recipientEmail,
      idea: formatIdea(state.idea),
      suggestion: state.suggestion && state.suggestion.trim() ? state.suggestion.trim() : 'None',
      date: state.date ? formatLongDate(state.date) : '',
      time: state.time ? `${formatTime(state.time)} (Philippine time)` : '',
      confirmed_at: new Date().toLocaleString('en-US', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' }),
    };
    try {
      await emailjs.send(EMAIL_CONFIG.serviceId, EMAIL_CONFIG.templateId, params);
      state.emailSent = true;
      saveState();
      status.textContent = 'Date details sent successfully. ♡';
      if (retry) retry.hidden = true;
    } catch (err) {
      console.error('Email send failed:', err);
      status.textContent = 'Could not send the email. Please try again.';
      if (retry) retry.hidden = false;
    } finally {
      emailSending = false;
    }
  }

  function saveState() {
    try {       sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { /* ignore */ }
  }
  function loadState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (typeof parsed.screen === 'number' && parsed.screen >= 1 && parsed.screen <= 5) state.screen = parsed.screen;
      if (typeof parsed.envelopeOpened === 'boolean') state.envelopeOpened = parsed.envelopeOpened;
      if (typeof parsed.declined === 'boolean') state.declined = parsed.declined;
      if (['picnic','coffee','yours'].includes(parsed.idea)) state.idea = parsed.idea;
      if (typeof parsed.suggestion === 'string') state.suggestion = parsed.suggestion.slice(0, 300);
      if (typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) state.date = parsed.date;
      if (typeof parsed.time === 'string' && /^\d{2}:\d{2}$/.test(parsed.time)) state.time = parsed.time;
      if (typeof parsed.confirmed === 'boolean') state.confirmed = parsed.confirmed;
      if (typeof parsed.emailSent === 'boolean') state.emailSent = parsed.emailSent;
    } catch (e) { /* ignore */ }
  }
  function validateRestored() {
    if (state.date && state.time) {
      const now = manilaNowShifted();
      const slot = new Date(shiftedFromIso(state.date).getTime() + timeToMs(state.time));
      if (slot < now) {
        state.date = null; state.time = null; state.confirmed = false;
        if (state.screen >= 4) state.screen = 3;
      }
    }
    if (state.date) {
      const d = shiftedFromIso(state.date);
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) { state.date = null; state.time = null; }
    }
    if (state.confirmed && (!state.date || !state.time)) state.confirmed = false;
    if (state.screen === 5 && !state.confirmed) state.screen = state.date && state.time ? 4 : (state.idea ? 2 : 1);
  }
  function timeToMs(t) {
    const [hh, mm] = t.split(':').map(Number);
    return (hh * 60 + mm) * 60000;
  }

  const $ = (id) => document.getElementById(id);
  const screens = [1,2,3,4,5].map(n => $(`screen-${n}`));

  function showScreen(n) {
    if (n === 1) renderScreen1();
    if (n === 2) renderIdeas();
    if (n === 3) { renderDates(); renderTimes(); }
    if (n === 4) renderReview();
    state.screen = n;
    screens.forEach((s, i) => {
      const active = (i + 1 === n);
      s.hidden = !active;
      s.classList.toggle('active', active);
      if (active) {
        const h = s.querySelector('h1, h2');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      }
    });
    updateProgress();
    saveState();
    if (n === 5 && state.confirmed) {
      setTimeout(() => sendDateEmail(), 0);
    }
  }

  function updateProgress() {
    const prog = $('progress');
    if (state.screen >= 2 && !state.declined) {
      prog.hidden = false;
      for (let i = 1; i <= 5; i++) {
        const dot = $(`p${i}`);
        dot.classList.toggle('active', i <= state.screen);
      }
    } else {
      prog.hidden = true;
    }
  }

  // Screen 1
  const envelope = $('envelope');
  let opening = false;
  function completeOpen() {
    opening = false;
    state.envelopeOpened = true;
    envelope.classList.add('is-complete');
    envelope.style.pointerEvents = 'none';
    const letter = document.querySelector('.env-letter');
    if (letter) letter.classList.add('is-revealed');
    $('invitation-card').hidden = false;
    $('invitation-card').classList.add('is-revealed');
    saveState();
  }
  function openEnvelope(skip) {
    if (state.envelopeOpened) return;
    if (skip) { completeOpen(); return; }
    if (opening) return;
    opening = true;
    envelope.classList.add('is-opening');
    setTimeout(() => envelope.classList.add('is-extracting'), 1100);
    setTimeout(() => {
      const letter = document.querySelector('.env-letter');
      if (letter) letter.classList.add('is-revealed');
    }, 2300);
    setTimeout(completeOpen, 4300);
  }
  envelope.addEventListener('click', () => openEnvelope(true));
  envelope.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnvelope(true); }
  });
  // skip animation removed per request

  function renderScreen1() {
    const wrap = document.querySelector('.envelope-wrap');
    const card = $('invitation-card');
    if (state.envelopeOpened) {
      wrap.hidden = true; card.hidden = false;
    } else {
      wrap.hidden = false; card.hidden = true;
      envelope.classList.remove('opening');
    }
    if (state.declined) {
      $('decline-msg').hidden = false;
      $('btn-back-letter').hidden = false;
    } else {
      $('decline-msg').hidden = true;
      $('btn-back-letter').hidden = true;
    }
  }

  $('btn-yes').addEventListener('click', () => {
    state.declined = false; saveState(); showScreen(2);
  });
  let noClicks = 0;
  let lastNoPos = null;
  function rectsOverlap(a, b, pad) {
    pad = pad || 8;
    return !(a.right + pad < b.left || a.left > b.right + pad || a.bottom + pad < b.top || a.top > b.bottom + pad);
  }
  function moveNoButton() {
    const card = $('invitation-card');
    const noBtn = $('btn-no');
    const cardRect = card.getBoundingClientRect();
    const noW = noBtn.offsetWidth;
    const noH = noBtn.offsetHeight;
    const maxX = Math.max(0, card.clientWidth - noW - 8);
    const maxY = Math.max(0, card.clientHeight - noH - 8);
    if (noBtn.style.position !== 'absolute') {
      const r = noBtn.getBoundingClientRect();
      noBtn.style.position = 'absolute';
      noBtn.style.left = (r.left - cardRect.left) + 'px';
      noBtn.style.top = (r.top - cardRect.top) + 'px';
      void noBtn.offsetHeight;
      }
      const protectedEls = [$('h-invite'), $('btn-yes')];
      if (!$('decline-msg').hidden) protectedEls.push($('decline-msg'));
    if (!$('btn-back-letter').hidden) protectedEls.push($('btn-back-letter'));
    const protRects = protectedEls.map(el => {
      const r = el.getBoundingClientRect();
      return { left: r.left - cardRect.left, top: r.top - cardRect.top, right: r.right - cardRect.left, bottom: r.bottom - cardRect.top };
    });
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = Math.floor(Math.random() * (maxX + 1));
      const y = Math.floor(Math.random() * (maxY + 1));
      const noBox = { left: x, top: y, right: x + noW, bottom: y + noH };
      let ok = true;
      for (const pr of protRects) {
        if (rectsOverlap(noBox, pr, 10)) { ok = false; break; }
      }
      if (lastNoPos && Math.hypot(x - lastNoPos.x, y - lastNoPos.y) < 40) ok = false;
      if (ok) {
        noBtn.style.position = 'absolute';
        noBtn.style.left = x + 'px';
        noBtn.style.top = y + 'px';
        lastNoPos = { x, y };
        return;
      }
    }
  }
  $('btn-no').addEventListener('click', () => {
    noClicks++;
    state.declined = false;
    $('decline-msg').hidden = true;
    $('btn-back-letter').hidden = true;
    const yes = $('btn-yes');
    const scale = Math.min(2.4, 1 + noClicks * 0.15);
    yes.style.transform = `scale(${scale})`;
    moveNoButton();
    saveState();
  });
  $('btn-back-letter').addEventListener('click', () => {
    state.declined = false;
    saveState();
    renderScreen1();
  });

  // Screen 2
  const ideaCards = document.querySelectorAll('.idea-card');
  function renderIdeas() {
    ideaCards.forEach(c => {
      const sel = c.dataset.idea === state.idea;
      c.classList.toggle('selected', sel);
      c.setAttribute('aria-pressed', sel ? 'true' : 'false');
    });
    const wrap = $('suggestion-wrap');
    if (state.idea === 'yours') {
      wrap.classList.add('is-open');
      wrap.setAttribute('aria-hidden', 'false');
      const ta = $('suggestion');
      if (ta.value !== state.suggestion) ta.value = state.suggestion;
      updateCount();
    } else {
      wrap.classList.remove('is-open');
      wrap.setAttribute('aria-hidden', 'true');
    }
    $('idea-validation').hidden = true;
    $('sugg-error').hidden = true;
  }
  ideaCards.forEach(c => {
    c.addEventListener('click', () => {
      state.idea = c.dataset.idea;
      renderIdeas();
      saveState();
    });
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); }
    });
  });
  const sugg = $('suggestion');
  sugg.addEventListener('input', () => {
    state.suggestion = sugg.value;
    updateCount();
    saveState();
  });
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const ta = $('suggestion');
      if (ta.value.trim() !== '') return;
      const text = chip.dataset.suggestion || '';
      ta.value = text;
      state.suggestion = text;
      updateCount();
      saveState();
      ta.focus();
    });
  });
  function updateCount() {
    $('sugg-count').textContent = `${sugg.value.length} / 300`;
  }
  $('btn-idea-back').addEventListener('click', () => showScreen(1));
  $('btn-idea-next').addEventListener('click', () => {
    if (!state.idea) {
      $('idea-validation').hidden = false;
      $('idea-validation').textContent = 'Please choose a date idea.';
      return;
    }
    if (state.idea === 'yours' && !validSuggestion(state.suggestion)) {
      const err = $('sugg-error');
      err.hidden = false;
      err.textContent = 'Please share a meaningful idea (not empty).';
      sugg.focus();
      return;
    }
    $('sugg-error').hidden = true;
    showScreen(3);
  });

  // Screen 3
  const TIME_SLOTS = ['17:00','17:30','18:00','18:30','19:00','19:30'];
  function generateWeekends() {
    const today = todayIso();
    const allowed = ['2026-10-31', '2026-11-01', '2026-11-14', '2026-11-15'];
    const out = [];
    allowed.forEach(iso => {
      if (iso < today) return;
      const d = shiftedFromIso(iso);
      const wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) return;
      if (iso === today) {
        const now = manilaNowShifted();
        const hasFuture = TIME_SLOTS.some(t => {
          const slot = new Date(shiftedFromIso(iso).getTime() + timeToMs(t));
          return slot > now;
        });
        if (!hasFuture) return;
      }
      out.push(iso);
    });
    return out;
  }

  function isToday(iso) { return iso === todayIso(); }

  function renderDates() {
    const container = $('dates');
    container.innerHTML = '';
    generateWeekends().forEach(iso => {
      const d = actualFromIso(iso);
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'date-tile';
      tile.dataset.date = iso;
      tile.setAttribute('aria-pressed', state.date === iso ? 'true' : 'false');
      if (state.date === iso) tile.classList.add('selected');
      const dayName = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
      const monDay = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }).format(d);
      tile.innerHTML = `<div class="date-day">${dayName}</div><div class="date-main">${monDay}</div><div class="date-check">✓</div>`;
      tile.addEventListener('click', () => {
        state.date = iso;
        state.time = null;
        renderDates();
        renderTimes();
        saveState();
      });
      container.appendChild(tile);
    });
  }

  function renderTimes() {
    const container = $('times');
    container.innerHTML = '';
    if (!state.date) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'Select a date first.';
      container.appendChild(p);
      return;
    }
    const now = manilaNowShifted();
    TIME_SLOTS.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'time-btn';
      btn.textContent = formatTime(t);
      btn.dataset.time = t;
      let disabled = false;
      if (isToday(state.date)) {
        const slot = new Date(shiftedFromIso(state.date).getTime() + timeToMs(t));
        if (slot <= now) disabled = true;
      }
      btn.disabled = disabled;
      if (state.time === t && !disabled) btn.classList.add('selected');
      btn.setAttribute('aria-pressed', (state.time === t) ? 'true' : 'false');
      btn.addEventListener('click', () => {
        if (disabled) return;
        state.time = t;
        renderTimes();
        saveState();
      });
      container.appendChild(btn);
    });
  }
  function formatTime(t) {
    const [hh, mm] = t.split(':').map(Number);
    const d = new Date(2000, 0, 1, hh, mm);
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
  }

  $('btn-sched-back').addEventListener('click', () => showScreen(2));
  $('btn-sched-next').addEventListener('click', () => {
    const v = $('sched-validation');
    if (!state.date) { v.hidden = false; v.textContent = 'Please choose a date.'; return; }
    if (!state.time) { v.hidden = false; v.textContent = 'Please choose a time.'; return; }
    v.hidden = true;
    showScreen(4);
  });

  // Screen 4
  function renderReview() {
    $('sum-idea').textContent = formatIdea(state.idea);
    const suggRow = $('sum-sugg-row');
    if (state.idea === 'yours') {
      suggRow.hidden = false;
      $('sum-sugg').textContent = state.suggestion;
    } else {
      suggRow.hidden = true;
    }
    $('sum-date').textContent = state.date ? formatLongDate(state.date) : '—';
    $('sum-time').textContent = state.time ? `${formatTime(state.time)} (Philippine time)` : '—';
    $('review-validation').hidden = true;
  }
  $('edit-idea').addEventListener('click', () => showScreen(2));
  $('edit-date').addEventListener('click', () => showScreen(3));
  $('edit-time').addEventListener('click', () => showScreen(3));
  $('btn-review-back').addEventListener('click', () => showScreen(3));
  $('btn-confirm').addEventListener('click', () => {
    const v = $('review-validation');
    if (!state.idea) { showScreen(2); return; }
    if (state.idea === 'yours' && !validSuggestion(state.suggestion)) { showScreen(2); return; }
    if (!state.date || !state.time) { v.hidden = false; v.textContent = 'Please complete your schedule.'; showScreen(3); return; }
    const now = manilaNowShifted();
    const slot = new Date(shiftedFromIso(state.date).getTime() + timeToMs(state.time));
    if (slot <= now) {
      v.hidden = false;
      v.textContent = 'That time has passed. Please choose a new time.';
      state.date = null; state.time = null;
      saveState();
      showScreen(3);
      return;
    }
    const d = shiftedFromIso(state.date);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) {
      v.hidden = false; v.textContent = 'Please choose a weekend date.';
      state.date = null; state.time = null; saveState(); showScreen(3); return;
    }
    state.confirmed = true;
    state.emailSent = false;
    saveState();
    showScreen(5);
    startCelebration();
  });

  // Screen 5
  function startCelebration() {
    const layer = $('hearts-layer');
    layer.innerHTML = '';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const burstCount = 0;
    for (let i = 0; i < burstCount; i++) {
      const h = document.createElement('span');
      h.className = 'heart-particle';
      h.textContent = Math.random() > 0.5 ? '♡' : '♥';
      const x = 50 + (Math.random() - 0.5) * 60;
      const dx = (Math.random() - 0.5) * 80;
      h.style.left = x + '%';
      h.style.bottom = '40%';
      h.style.setProperty('--dx', dx + 'px');
      h.style.animationDelay = (Math.random() * 0.4) + 's';
      h.style.color = Math.random() > 0.5 ? '#9BB8A0' : '#C7AE88';
      layer.appendChild(h);
    }
  }

  $('btn-view-date').addEventListener('click', () => {
    const body = $('modal-body');
    body.innerHTML = '';
    const rows = [['Date idea', formatIdea(state.idea)]];
    if (state.idea === 'yours') rows.push(['Your suggestion', escapeHtml(state.suggestion)]);
    rows.push(['Date', formatLongDate(state.date)]);
    rows.push(['Time', `${formatTime(state.time)} (Philippine time)`]);
    rows.forEach(([k, v]) => {
      const r = document.createElement('div');
      r.className = 'row';
      const a = document.createElement('strong'); a.textContent = k;
      const b = document.createElement('span'); b.innerHTML = v;
      r.appendChild(a); r.appendChild(b);
      body.appendChild(r);
    });
    $('modal').hidden = false;
    modalLastFocus = document.activeElement;
    document.addEventListener('keydown', trapModalKey);
    setTimeout(() => $('modal-close').focus(), 10);
  });
  $('btn-edit-plan').addEventListener('click', () => {
    state.confirmed = false;
    state.emailSent = false;
    saveState();
    showScreen(4);
  });
  const retryBtn = $('btn-retry-email');
  if (retryBtn) retryBtn.addEventListener('click', () => sendDateEmail());

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let modalLastFocus = null;
  function trapModalKey(e) {
    if (e.key !== 'Tab') return;
    const panel = document.querySelector('.modal-panel');
    if (!panel) return;
    const focusables = Array.from(panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.disabled);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function closeModal() {
    $('modal').hidden = true;
    document.removeEventListener('keydown', trapModalKey);
    if (modalLastFocus && typeof modalLastFocus.focus === 'function') modalLastFocus.focus();
    else $('btn-view-date').focus();
  }
  $('modal-close').addEventListener('click', closeModal);
  $('modal-backdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modal').hidden) closeModal();
  });

  // Cat pop-up on "No"
  const catStage = $('cat-stage');
  const catImage = $('cat-image');
  function pulseYesCat() {
    const btnYesEl = $('btn-yes');
    if (!btnYesEl) return;
    const current = (btnYesEl.style.transform.match(/scale\(([^)]+)\)/) || [0, '1'])[1];
    const base = parseFloat(current) || 1;
    if (btnYesEl.animate) {
      btnYesEl.animate([
        { transform: 'scale(' + base + ')' },
        { transform: 'scale(' + (base * 1.05) + ')' },
        { transform: 'scale(' + base + ')' },
      ], { duration: 450, easing: 'ease-in-out' });
    }
  }
  function showCat() {
    if (!catStage || !catImage) return;
    catImage.classList.remove('is-popping');
    void catImage.offsetWidth;
    if (catStage.classList.contains('is-active')) {
      catImage.classList.add('is-popping');
      setTimeout(() => catImage.classList.remove('is-popping'), 450);
      pulseYesCat();
      return;
    }
    catStage.classList.add('is-active');
    catImage.classList.add('is-popping');
    setTimeout(() => catImage.classList.remove('is-popping'), 450);
    setTimeout(() => pulseYesCat(), 120);
  }
  function dismissCat() {
    if (!catStage) return;
    catStage.classList.remove('is-active');
    if (catImage) catImage.classList.remove('is-popping');
  }
  const btnNoEl = $('btn-no');
  const btnYesEl = $('btn-yes');
  if (btnNoEl) btnNoEl.addEventListener('click', () => { setTimeout(showCat, 0); });
  if (btnYesEl) btnYesEl.addEventListener('click', dismissCat);

  // Init
  loadState();
  validateRestored();
  initEmail();
  renderScreen1();
  if (!state.envelopeOpened) {
    document.querySelector('.envelope-wrap').hidden = false;
    $('invitation-card').hidden = true;
  } else {
    document.querySelector('.envelope-wrap').hidden = false;
    $('invitation-card').hidden = false;
    envelope.classList.add('is-complete');
    envelope.style.pointerEvents = 'none';
    const letter = document.querySelector('.env-letter');
    if (letter) letter.classList.add('is-revealed');
    $('invitation-card').classList.add('is-revealed');
  }
  if (state.screen === 1) {
    showScreen(1);
    if (!state.envelopeOpened) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(() => { if (!state.envelopeOpened) openEnvelope(reduced); }, reduced ? 0 : 900);
    }
  } else {
    if (!state.envelopeOpened) state.envelopeOpened = true;
    document.querySelector('.envelope-wrap').hidden = false;
    $('invitation-card').hidden = false;
    envelope.classList.add('is-complete');
    envelope.style.pointerEvents = 'none';
    const letter = document.querySelector('.env-letter');
    if (letter) letter.classList.add('is-revealed');
    $('invitation-card').classList.add('is-revealed');
    renderIdeas(); renderDates(); renderTimes(); renderReview();
    showScreen(state.screen);
    if (state.screen === 5) startCelebration();
  }
  saveState();
})();
