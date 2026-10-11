// Minimal iCalendar (RFC 5545) parser covering what the MIXXlog feed uses:
// line folding, escaped text, UTC / floating / all-day dates, and FREQ=YEARLY.
(function (global) {
  function unfold(text) {
    return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  }

  function unescapeText(v) {
    return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  }

  function parseDate(value, params) {
    const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    if (params.VALUE === 'DATE' || h === undefined) {
      return { date: new Date(+y, +mo - 1, +d), allDay: true };
    }
    const date = z
      ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
      : new Date(+y, +mo - 1, +d, +h, +mi, +s);
    return { date, allDay: false };
  }

  function parse(text) {
    const events = [];
    let cur = null;
    for (const line of unfold(text).split('\n')) {
      if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
      if (line === 'END:VEVENT') { if (cur && cur.start) events.push(cur); cur = null; continue; }
      if (!cur) continue;
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const [name, ...rawParams] = line.slice(0, idx).split(';');
      const value = line.slice(idx + 1);
      const params = Object.fromEntries(rawParams.map(p => p.split('=')));
      switch (name) {
        case 'UID': cur.uid = value; break;
        case 'SUMMARY': cur.title = unescapeText(value).trim(); break;
        case 'DESCRIPTION': cur.description = unescapeText(value).trim(); break;
        case 'CATEGORIES': cur.category = unescapeText(value).trim(); break;
        case 'LOCATION': cur.location = unescapeText(value).trim(); break;
        case 'RRULE': cur.rrule = value; break;
        case 'DTSTART': {
          const d = parseDate(value, params);
          if (d) { cur.start = d.date; cur.allDay = d.allDay; }
          break;
        }
        case 'DTEND': {
          const d = parseDate(value, params);
          if (d) cur.end = d.date;
          break;
        }
      }
    }
    return events;
  }

  // Expand events into concrete occurrences within [from, to].
  function expand(events, from, to) {
    const out = [];
    for (const ev of events) {
      if (ev.rrule && /FREQ=YEARLY/.test(ev.rrule)) {
        for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
          if (y < ev.start.getFullYear()) continue;
          const s = new Date(ev.start);
          s.setFullYear(y);
          if (s >= from && s <= to) out.push({ ...ev, start: s, key: ev.uid + '@' + y });
        }
      } else if (ev.start >= from && ev.start <= to) {
        out.push({ ...ev, key: ev.uid });
      }
    }
    return out.sort((a, b) => a.start - b.start);
  }

  global.ICS = { parse, expand };
})(window);
