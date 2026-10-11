(function () {
  const FEED_SOURCES = [
    'data/feed.ics', // mirrored by the GitHub Action (the upstream feed has no CORS headers)
    'https://mixxlog.com/api/calendar/feed.ics',
  ];

  const CATEGORIES = {
    Release: { label: '발매', color: 'var(--c-release)' },
    Media: { label: '미디어', color: 'var(--c-media)' },
    Live: { label: '라이브', color: 'var(--c-live)' },
    Event: { label: '이벤트', color: 'var(--c-event)' },
    Show: { label: '방송', color: 'var(--c-show)' },
    Birthday: { label: '기념일', color: 'var(--c-birthday)' },
    Scheduled: { label: '예정', color: 'var(--c-scheduled)' },
    NOTICE: { label: '공지', color: 'var(--c-other)' },
  };
  const catOf = c => CATEGORIES[c] || { label: c || '기타', color: 'var(--c-other)' };

  const $ = sel => document.querySelector(sel);
  const pad = n => String(n).padStart(2, '0');
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function linkify(text) {
    return escapeHtml(text).replace(/(https?:\/\/[^\s<]+|\b[a-z0-9-]+\.lnk\.to\/[^\s<]+)/gi, url => {
      const href = url.startsWith('http') ? url : 'https://' + url;
      let host;
      try { host = new URL(href).hostname.replace(/^www\./, ''); } catch (e) { host = url; }
      return `<a href="${href}" target="_blank" rel="noopener">${host}</a>`;
    });
  }

  function fmtTime(ev) {
    if (ev.allDay) return '종일';
    return ev.start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  /* ---------------- Theme ---------------- */
  function initTheme() {
    const root = document.documentElement;
    $('#theme-toggle').addEventListener('click', () => {
      const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = current === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* ---------------- Router ---------------- */
  function route() {
    const name = location.hash.replace(/^#\/?/, '') || 'home';
    const view = name === 'calendar' ? 'calendar' : 'home';
    $('#view-home').hidden = view !== 'home';
    $('#view-calendar').hidden = view !== 'calendar';
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.toggle('active', a.dataset.route === view));
    if (bgPlayer && bgPlayer.pauseVideo) view === 'home' ? bgPlayer.playVideo() : bgPlayer.pauseVideo();
    window.scrollTo(0, 0);
  }

  /* ---------------- Hero / comeback ---------------- */
  let bgPlayer = null;
  let comeback = null;

  const LINK_META = {
    spotify: { label: 'Spotify', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.6.6 0 0 1-.9.2c-2.3-1.4-5.3-1.8-8.8-1a.6.6 0 1 1-.3-1.2c3.8-.9 7.1-.5 9.7 1.1.3.2.4.6.3.9zm1.2-2.7a.8.8 0 0 1-1.1.3c-2.7-1.6-6.7-2.1-9.9-1.1a.8.8 0 1 1-.4-1.5c3.6-1.1 8.1-.6 11.2 1.3.4.2.5.7.2 1zm.1-2.8C14.7 9 9.4 8.8 6.3 9.7a.9.9 0 1 1-.5-1.8c3.5-1.1 9.4-.9 13.1 1.3a.9.9 0 0 1-1 1.7z"/></svg>' },
    youtubeMusic: { label: 'YouTube Music', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 15.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zm0-10a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM10 9.5l4.5 2.5-4.5 2.5v-5z"/></svg>' },
    appleMusic: { label: 'Apple Music', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3v12.5a3.5 3.5 0 1 1-2-3.2V7.2l-8 1.6v8.7a3.5 3.5 0 1 1-2-3.2V5l12-2z"/></svg>' },
    melon: { label: 'Melon', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>' },
    youtube: { label: 'M/V', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15.1V8.9l5.7 3.1-5.7 3.1z"/></svg>' },
    smartlink: { label: '모든 플랫폼', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>' },
  };

  async function initHero() {
    try {
      comeback = await fetch('data/comeback.json', { cache: 'no-cache' }).then(r => r.json());
    } catch (e) {
      $('#album-title').textContent = 'NMIXX';
      return;
    }
    $('#album-title').textContent = comeback.album;
    $('#album-meta').innerHTML = `${escapeHtml(comeback.artist)} ${escapeHtml(comeback.albumType || '')}` +
      (comeback.titleTrack ? ` · 타이틀곡 <b>${escapeHtml(comeback.titleTrack)}</b>` : '');
    const release = new Date(comeback.releaseAt);
    $('#release-date').textContent = release.toLocaleString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit',
    }) + ' 발매';

    const released = Date.now() >= release.getTime();
    renderHeroState(released);
    loadBackground(released ? (comeback.mvYoutubeId || comeback.trailerYoutubeId) : comeback.trailerYoutubeId);
    if (!released) startCountdown(release);
  }

  function renderHeroState(released) {
    const eyebrow = $('#hero-eyebrow');
    if (released) {
      eyebrow.innerHTML = '<span class="dot"></span>OUT NOW';
      $('#countdown').hidden = true;
      renderLinks();
    } else {
      eyebrow.textContent = 'COMEBACK COUNTDOWN';
      $('#countdown').hidden = false;
      $('#stream-links').hidden = true;
    }
  }

  function renderLinks() {
    const links = { ...comeback.links };
    if (comeback.mvYoutubeId) links.youtube = `https://www.youtube.com/watch?v=${comeback.mvYoutubeId}`;
    const order = ['spotify', 'youtubeMusic', 'appleMusic', 'melon', 'youtube', 'smartlink'];
    const el = $('#stream-links');
    el.innerHTML = order.filter(k => links[k]).map(k => {
      const m = LINK_META[k];
      return `<a class="link-btn${k === 'spotify' ? ' primary' : ''}" href="${escapeHtml(links[k])}" target="_blank" rel="noopener">${m.icon}${m.label}</a>`;
    }).join('');
    el.hidden = false;
  }

  function startCountdown(release) {
    const els = { d: $('#cd-d'), h: $('#cd-h'), m: $('#cd-m'), s: $('#cd-s') };
    const tick = () => {
      const diff = release.getTime() - Date.now();
      if (diff <= 0) {
        clearInterval(timer);
        renderHeroState(true);
        if (comeback.mvYoutubeId) swapBackground(comeback.mvYoutubeId);
        return;
      }
      const s = Math.floor(diff / 1000);
      els.d.textContent = pad(Math.floor(s / 86400));
      els.h.textContent = pad(Math.floor(s / 3600) % 24);
      els.m.textContent = pad(Math.floor(s / 60) % 60);
      els.s.textContent = pad(s % 60);
    };
    const timer = setInterval(tick, 1000);
    tick();
  }

  function loadBackground(videoId) {
    if (!videoId) return;
    const poster = $('#hero-poster');
    poster.style.backgroundImage = `url(https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg)`;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    window.onYouTubeIframeAPIReady = () => {
      bgPlayer = new YT.Player('bg-player', {
        videoId,
        playerVars: {
          autoplay: 1, mute: 1, controls: 0, disablekb: 1, loop: 1, playlist: videoId,
          modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0,
        },
        events: {
          onReady: e => {
            e.target.mute();
            if (!$('#view-home').hidden) e.target.playVideo();
            $('#sound-toggle').hidden = false;
          },
          onStateChange: e => {
            if (e.data === YT.PlayerState.PLAYING) poster.classList.add('fade');
            if (e.data === YT.PlayerState.ENDED) e.target.seekTo(0);
          },
        },
      });
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);

    const btn = $('#sound-toggle');
    const setIcon = muted => {
      btn.querySelector('.i-muted').style.display = muted ? '' : 'none';
      btn.querySelector('.i-sound').style.display = muted ? 'none' : '';
      btn.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
      btn.title = btn.getAttribute('aria-label');
    };
    setIcon(true);
    btn.addEventListener('click', () => {
      if (!bgPlayer) return;
      if (bgPlayer.isMuted()) { bgPlayer.unMute(); bgPlayer.setVolume(60); setIcon(false); }
      else { bgPlayer.mute(); setIcon(true); }
    });
  }

  function swapBackground(videoId) {
    $('#hero-poster').style.backgroundImage = `url(https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg)`;
    $('#hero-poster').classList.remove('fade');
    if (bgPlayer && bgPlayer.loadPlaylist) bgPlayer.loadPlaylist({ playlist: [videoId], index: 0 });
  }

  /* ---------------- Calendar data ---------------- */
  let allEvents = [];
  const activeCats = new Set(Object.keys(CATEGORIES).concat(['__other']));
  const isActive = ev => activeCats.has(CATEGORIES[ev.category] ? ev.category : '__other');

  async function loadFeed() {
    for (const url of FEED_SOURCES) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) continue;
        const text = await res.text();
        if (!text.includes('BEGIN:VCALENDAR')) continue;
        return ICS.parse(text);
      } catch (e) { /* try next source */ }
    }
    throw new Error('feed unavailable');
  }

  function eventItem(ev, { showDate = true } = {}) {
    const c = catOf(ev.category);
    const date = showDate
      ? `<div class="event-date"><b>${ev.start.getDate()}</b><small>${ev.start.getMonth() + 1}월 ${WEEK[ev.start.getDay()]}</small></div>`
      : '';
    const desc = ev.description ? `<span>${linkify(ev.description.split('\n')[0])}</span>` : '';
    return `<li class="event${showDate ? ' glass' : ''}">${date}
      <div class="event-body">
        <p class="event-title">${escapeHtml(ev.title || '(제목 없음)')}</p>
        <p class="event-sub"><span class="tag" style="--cat:${c.color}">${c.label}</span><span>${fmtTime(ev)}</span>${desc}</p>
      </div></li>`;
  }

  function renderUpcoming() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const horizon = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const list = ICS.expand(allEvents, startOfToday, horizon)
      .filter(ev => ev.allDay ? true : ev.start >= now)
      .slice(0, 9);
    $('#upcoming-list').innerHTML = list.length
      ? list.map(ev => eventItem(ev)).join('')
      : '<li class="muted">예정된 일정이 없어요.</li>';
  }

  /* ---------------- Calendar view ---------------- */
  let viewMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selected = new Date();

  function renderFilters() {
    const el = $('#cal-filters');
    el.innerHTML = Object.entries(CATEGORIES).map(([k, c]) =>
      `<button class="chip" data-cat="${k}" aria-pressed="${activeCats.has(k)}" style="--cat:${c.color}">${c.label}</button>`
    ).join('') + `<button class="chip" data-cat="__other" aria-pressed="${activeCats.has('__other')}" style="--cat:var(--c-other)">기타</button>`;
    el.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
      const k = btn.dataset.cat;
      activeCats.has(k) ? activeCats.delete(k) : activeCats.add(k);
      btn.setAttribute('aria-pressed', activeCats.has(k));
      renderCalendar();
    }));
  }

  function renderCalendar() {
    const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
    $('#cal-title').textContent = `${y}년 ${m + 1}월`;
    const gridStart = new Date(y, m, 1 - new Date(y, m, 1).getDay());
    const gridEnd = new Date(gridStart); gridEnd.setDate(gridStart.getDate() + 42);

    const byDay = new Map();
    for (const ev of ICS.expand(allEvents, gridStart, gridEnd).filter(isActive)) {
      const k = dayKey(ev.start);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(ev);
    }

    const today = new Date();
    let html = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      const evs = byDay.get(dayKey(d)) || [];
      const cls = ['cal-day'];
      if (d.getMonth() !== m) cls.push('out');
      if (sameDay(d, today)) cls.push('today');
      if (sameDay(d, selected)) cls.push('selected');
      if (d.getDay() === 0) cls.push('sun');
      const shown = evs.slice(0, 3).map(ev =>
        `<span class="cal-ev" style="--cat:${catOf(ev.category).color}">${escapeHtml(ev.title || '')}</span>`).join('');
      const more = evs.length > 3 ? `<span class="cal-more">+${evs.length - 3}</span>` : '';
      const dots = `<span class="cal-dots">${evs.slice(0, 4).map(ev => `<i style="--cat:${catOf(ev.category).color}"></i>`).join('')}</span>`;
      html += `<button class="${cls.join(' ')}" data-date="${d.toISOString()}" aria-label="${d.getMonth() + 1}월 ${d.getDate()}일, 일정 ${evs.length}개">
        <span class="num">${d.getDate()}</span>${shown}${more}${dots}</button>`;
    }
    const grid = $('#cal-grid');
    grid.innerHTML = html;
    grid.querySelectorAll('.cal-day').forEach(btn => btn.addEventListener('click', () => {
      selected = new Date(btn.dataset.date);
      if (selected.getMonth() !== m) viewMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
      renderCalendar();
    }));
    renderDay();
  }

  function renderDay() {
    const d = selected;
    $('#day-title').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const to = new Date(from); to.setDate(to.getDate() + 1); to.setMilliseconds(-1);
    const evs = ICS.expand(allEvents, from, to).filter(isActive);
    $('#day-list').innerHTML = evs.length
      ? evs.map(ev => eventItem(ev, { showDate: false })).join('')
      : '<li class="muted">이 날은 일정이 없어요.</li>';
  }

  function initCalendarControls() {
    const shift = n => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + n, 1); renderCalendar(); };
    $('#cal-prev').addEventListener('click', () => shift(-1));
    $('#cal-next').addEventListener('click', () => shift(1));
    $('#cal-today').addEventListener('click', () => {
      selected = new Date();
      viewMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
      renderCalendar();
    });
  }

  async function initCalendar() {
    renderFilters();
    initCalendarControls();
    try {
      allEvents = await loadFeed();
      $('#feed-status').textContent = `일정 ${allEvents.length}개`;
      renderUpcoming();
    } catch (e) {
      $('#feed-status').textContent = '피드를 불러오지 못했어요';
      $('#upcoming-list').innerHTML = '<li class="muted">일정을 불러오지 못했어요.</li>';
    }
    renderCalendar();
  }

  /* ---------------- Boot ---------------- */
  initTheme();
  window.addEventListener('hashchange', route);
  route();
  initHero();
  initCalendar();
})();
