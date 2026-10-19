(function () {
  const $ = sel => document.querySelector(sel);
  const MEMBER_KO = { LILY: '릴리', HAEWON: '해원', SULLYOON: '설윤', BAE: '배이', JIWOO: '지우', KYUJIN: '규진' };

  const ICON = {
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15.1V8.9l5.7 3.1-5.7 3.1z"/></svg>',
    spotify: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.6.6 0 0 1-.9.2c-2.3-1.4-5.3-1.8-8.8-1a.6.6 0 1 1-.3-1.2c3.8-.9 7.1-.5 9.7 1.1.3.2.4.6.3.9zm1.2-2.7a.8.8 0 0 1-1.1.3c-2.7-1.6-6.7-2.1-9.9-1.1a.8.8 0 1 1-.4-1.5c3.6-1.1 8.1-.6 11.2 1.3.4.2.5.7.2 1zm.1-2.8C14.7 9 9.4 8.8 6.3 9.7a.9.9 0 1 1-.5-1.8c3.5-1.1 9.4-.9 13.1 1.3a.9.9 0 0 1-1 1.7z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };
  const YT_LABEL = { mv: 'M/V', audio: 'YouTube', search: 'YouTube Music 검색' };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const year = d => d.slice(0, 4);
  const fmtDate = d => d.replace(/-/g, '.');
  const fmtDur = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  let data = null;
  let tab = 'albums';
  let memberFilter = null;
  try { tab = localStorage.getItem('music-tab') || 'albums'; } catch (e) {}

  function chips(members) {
    return (members || []).map(m => `<span class="member-chip">${MEMBER_KO[m] || m}</span>`).join('');
  }

  function linkIcons(item) {
    const yt = item.youtubeKind || 'search';
    return `<span class="track-links">
      <a class="mini-link yt${yt === 'mv' ? ' is-mv' : ''}" href="${esc(item.youtube)}" target="_blank" rel="noopener"
         title="${YT_LABEL[yt]}" aria-label="${esc(item.name)} ${YT_LABEL[yt]}">${ICON.youtube}${yt === 'mv' ? '<b>MV</b>' : ''}</a>
      <a class="mini-link sp" href="${esc(item.spotify)}" target="_blank" rel="noopener" title="Spotify" aria-label="${esc(item.name)} Spotify">${ICON.spotify}</a>
    </span>`;
  }

  /* ---------- Album grid ---------- */
  function renderAlbumGrid(list) {
    return `<div class="album-grid">${list.map((a, i) => `
      <button class="album-card glass" data-idx="${i}">
        <img class="album-cover" src="${esc(a.cover)}" alt="" loading="lazy" width="300" height="300">
        <span class="album-info">
          <span class="album-name">${esc(a.name)}</span>
          <span class="album-sub">${esc(a.label)} · ${year(a.date)}${a.artists !== 'NMIXX' ? ` · ${esc(a.artists)}` : ''}</span>
        </span>
      </button>`).join('')}</div>`;
  }

  function openAlbum(a) {
    const titleTrack = a.tracks.find(t => t.title && t.youtubeKind === 'mv');
    $('#dlg-inner').innerHTML = `
      <button class="icon-btn dlg-close" aria-label="닫기">${ICON.close}</button>
      <div class="dlg-head">
        <img class="dlg-cover" src="${esc(a.cover)}" alt="${esc(a.name)} 앨범 커버" width="300" height="300">
        <div class="dlg-meta">
          <p class="eyebrow">${esc(a.label)}</p>
          <h2 id="dlg-title">${esc(a.name)}</h2>
          <p class="album-sub">${esc(a.artists)} · ${fmtDate(a.date)} · ${a.tracks.length}곡</p>
          <div class="links dlg-links">
            <a class="link-btn primary" href="${esc(a.spotify)}" target="_blank" rel="noopener">${ICON.spotify}Spotify</a>
            ${titleTrack ? `<a class="link-btn" href="${esc(titleTrack.youtube)}" target="_blank" rel="noopener">${ICON.youtube}타이틀곡 M/V</a>` : ''}
          </div>
        </div>
      </div>
      <ol class="track-list">${a.tracks.map(t => `
        <li class="track">
          <span class="track-n">${t.n}</span>
          <span class="track-main">
            <span class="track-name">${esc(t.name)}${t.title ? '<span class="title-badge">TITLE</span>' : ''}</span>
            ${t.artists !== a.artists || t.members.length ? `<span class="track-sub">${t.artists !== a.artists ? esc(t.artists) : ''}${chips(t.members)}</span>` : ''}
          </span>
          <span class="track-dur">${fmtDur(t.duration)}</span>
          ${linkIcons(t)}
        </li>`).join('')}</ol>`;
    const dlg = $('#album-dialog');
    dlg.querySelector('.dlg-close').addEventListener('click', () => dlg.close());
    dlg.showModal();
  }

  /* ---------- Member songs ---------- */
  function renderMemberSongs() {
    const list = data.members.filter(s => !memberFilter || s.members.includes(memberFilter));
    return `<ul class="song-list">${list.map(s => `
      <li class="song glass">
        <img class="song-cover" src="${esc(s.cover)}" alt="" loading="lazy" width="64" height="64">
        <span class="song-main">
          <span class="track-name">${esc(s.name)}</span>
          <span class="track-sub">${esc(s.artists)}</span>
          <span class="track-sub">${chips(s.members)}<span class="song-note">${esc(s.note)} · ${fmtDate(s.date)}</span></span>
        </span>
        ${linkIcons(s)}
      </li>`).join('') || '<li class="muted">해당 멤버의 참여곡이 없어요.</li>'}</ul>`;
  }

  function renderMemberFilters() {
    const el = $('#music-filters');
    const counts = {};
    data.members.forEach(s => s.members.forEach(m => { counts[m] = (counts[m] || 0) + 1; }));
    const keys = Object.keys(MEMBER_KO).filter(m => counts[m]);
    el.innerHTML = `<button class="chip plain" data-m="" aria-pressed="${!memberFilter}">전체 ${data.members.length}</button>` +
      keys.map(m => `<button class="chip plain" data-m="${m}" aria-pressed="${memberFilter === m}">${MEMBER_KO[m]} ${counts[m]}</button>`).join('');
    el.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      memberFilter = b.dataset.m || null;
      render();
    }));
  }

  /* ---------- Shell ---------- */
  function render() {
    document.querySelectorAll('.segmented [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    const body = $('#music-body');
    const filters = $('#music-filters');
    filters.hidden = tab !== 'members';
    if (tab === 'members') {
      renderMemberFilters();
      body.innerHTML = renderMemberSongs();
      return;
    }
    const list = data[tab];
    body.innerHTML = renderAlbumGrid(list);
    body.querySelectorAll('.album-card').forEach(card =>
      card.addEventListener('click', () => openAlbum(list[+card.dataset.idx])));
  }

  async function init() {
    document.querySelectorAll('.segmented [role=tab]').forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      try { localStorage.setItem('music-tab', tab); } catch (e) {}
      render();
    }));
    const dlg = $('#album-dialog');
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

    try {
      data = await fetch('data/discography.json', { cache: 'no-cache' }).then(r => r.json());
    } catch (e) {
      $('#music-body').innerHTML = '<p class="muted">디스코그래피를 불러오지 못했어요.</p>';
      return;
    }
    const songCount = new Set(data.albums.flatMap(a => a.tracks.map(t => t.name.toLowerCase()))).size;
    $('#music-sub').textContent = `앨범 ${data.albums.length}장 · ${songCount}곡 · 콜라보 ${data.collabs.length} · 멤버 참여곡 ${data.members.length}`;
    if (!data[tab]) tab = 'albums';
    render();
  }

  init();
})();
