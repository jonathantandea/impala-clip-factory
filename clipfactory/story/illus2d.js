// illus2d.js: 2-D close-up illustrations for the flat look (agenda, notebook, phones, chat, whiteboard).
// Each is (p, t, s) => paints the whole frame; p = 0..1 progress across the run of scenes that share it.
import * as M from './motion.js';

const INK = '#3A2214';
export const COLORS = { merah: '#D9302A', hijau: '#2E9E4F', biru: '#2F6FD0', ungu: '#8A4FC9', oranye: '#F07A1A', hitam: '#2A2420' };
const col = (c) => COLORS[c] || c;

export function makeIllus(ctx, W, H) {
  const u = Math.min(W, H) / 1080, cx = W / 2, cy = H / 2;
  const { E, prog, clamp, hash01 } = M;
  const bgDesk = () => {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7A5232'); g.addColorStop(1, '#4E3320'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(30,15,5,0.25)'; ctx.lineWidth = 3; for (let i = 0; i < 40; i++) { const y = (i / 40) * H; ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= W; x += 60) ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 6); ctx.stroke(); }
  };
  const text = (s, x, y, size, color, align = 'center', weight = 800) => { ctx.font = `${weight} ${size}px Display`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(s, x, y); };
  const rr = (x, y, w, h, r, fill, stroke = INK, lw = 8 * u) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); } };
  const marker = (x0, y0, x1, y1, c, w, k = 1, seed = 1) => {      // hand-drawn marker stroke, k = drawn fraction
    if (k <= 0) return; ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = c; ctx.globalAlpha = 0.85; ctx.lineWidth = w;
    ctx.beginPath(); const n = 24; for (let i = 0; i <= n * k; i++) { const f = i / n; const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f + Math.sin(f * 9 + seed) * w * 0.12; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
  };
  const phone = (x, y, w, h, screen) => {      // phone body; screen(x, y, w, h) paints the display
    rr(x - 14 * u, y - 14 * u, w + 28 * u, h + 28 * u, 46 * u, '#1E1E24');
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 32 * u); ctx.clip(); screen(x, y, w, h); ctx.restore();
  };
  return {
    // agenda page: colours appear in order, some get crossed out. s.colors, s.strike, s.label
    agenda(p, t, s) {
      bgDesk();
      const w = 820 * u, h = 1180 * u, x = cx - w / 2, y = cy - h / 2 + 120 * u;
      rr(x, y, w, h, 24 * u, '#FBF7EC');
      for (let i = 0; i < 9; i++) { ctx.fillStyle = '#9A9A9A'; ctx.beginPath(); ctx.arc(x + 70 * u + i * 85 * u, y + 10 * u, 16 * u, 0, 7); ctx.fill(); }
      text(s.label || 'AGENDA', x + w / 2, y + 90 * u, 64 * u, '#2A2420');
      const days = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'];
      ctx.strokeStyle = '#D8D0BE'; ctx.lineWidth = 3 * u;
      days.forEach((d, i) => { const yy = y + 190 * u + i * 135 * u; ctx.beginPath(); ctx.moveTo(x + 40 * u, yy + 60 * u); ctx.lineTo(x + w - 40 * u, yy + 60 * u); ctx.stroke(); text(d, x + 90 * u, yy, 38 * u, '#7A6A55'); });
      const cs = s.colors || ['merah'], strike = new Set(s.strike || []);
      cs.forEach((c, i) => {
        const appear = cs.length === 1 ? 0.05 : 0.05 + (i / cs.length) * 0.8;
        const k = E.outCubic(prog(p, appear, appear + 0.12));
        const rows = s.rows?.[c] || [[0, 1, 2, 3, 4, 5, 6], [1, 3, 5], [3], [0, 2, 4], [2, 5, 6], [1, 4]][i % 6];
        rows.forEach((r, j) => { const yy = y + 190 * u + r * 135 * u + (i - (cs.length - 1) / 2) * 22 * u; marker(x + 190 * u, yy, x + w - 70 * u - (j % 2) * 120 * u, yy, col(c), 22 * u, k, i * 3 + j); });
        if (strike.has(c)) { const sk = prog(p, 0.7, 0.85); rows.forEach((r) => { const yy = y + 190 * u + r * 135 * u + (i - (cs.length - 1) / 2) * 22 * u; marker(x + 170 * u, yy - 20 * u, x + w - 60 * u, yy + 20 * u, '#2A2420', 9 * u, sk, r); }); }
      });
      if (s.messy) for (let i = 0; i < 18; i++) marker(x + (100 + hash01(i, 3) * 600) * u, y + (200 + hash01(i, 4) * 900) * u, x + (150 + hash01(i, 5) * 600) * u, y + (230 + hash01(i, 6) * 900) * u, col(['merah', 'ungu', 'oranye'][i % 3]), 16 * u, prog(p, i / 20, i / 20 + 0.1), i);
    },
    // notebook page; lines appear one by one, the last one underlined
    buku_catatan(p, t, s) {
      bgDesk();
      const w = 860 * u, h = 1000 * u, x = cx - w / 2, y = cy - h / 2 + 80 * u;
      rr(x, y, w, h, 18 * u, '#FFFDF4');
      ctx.strokeStyle = '#B9D3E8'; ctx.lineWidth = 3 * u; for (let i = 1; i < 12; i++) { ctx.beginPath(); ctx.moveTo(x, y + i * 80 * u); ctx.lineTo(x + w, y + i * 80 * u); ctx.stroke(); }
      ctx.strokeStyle = '#E8A0A0'; ctx.beginPath(); ctx.moveTo(x + 110 * u, y); ctx.lineTo(x + 110 * u, y + h); ctx.stroke();
      const lines = s.lines || ['Bilang otw jam 7.', 'Datang jam 9.'];
      lines.forEach((l, i) => {
        const k = prog(p, 0.08 + i * 0.18, 0.2 + i * 0.18); if (k <= 0) return;
        const n = Math.ceil(l.length * k); ctx.font = `700 ${60 * u}px Display`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#2B3A6B';
        ctx.fillText(l.slice(0, n), x + 140 * u, y + (150 + i * 160) * u);
        if (i === lines.length - 1 && k >= 1) marker(x + 140 * u, y + (170 + i * 160) * u, x + 140 * u + ctx.measureText(l).width, y + (170 + i * 160) * u, '#D9302A', 10 * u, prog(p, 0.85, 0.95));
      });
      // pen
      ctx.save(); ctx.translate(x + w - 120 * u, y + h + 30 * u); ctx.rotate(-0.6); rr(-20 * u, -260 * u, 40 * u, 260 * u, 18 * u, '#C8352E'); ctx.restore();
    },
    // two phones with disguised contacts; the left one rings "Grosir Telur" in the second half
    dua_hp(p, t, s) {
      bgDesk();
      const pw = 380 * u, ph = 760 * u, gap = 90 * u;
      const lists = s.lists || [['Bengkel Jaya', 'Grosir Telur', 'Laras ❤'], ['Grosir Telur', 'Bengkel Jaya', 'Servis']];
      [0, 1].forEach((k) => {
        const x = cx + (k ? gap / 2 : -gap / 2 - pw), y = cy - ph / 2 - 40 * u;
        const ring = k === 0 && p > (s.ring ?? 0.55);
        phone(x, y, pw, ph, (sx, sy, sw, sh) => {
          ctx.fillStyle = ring ? '#1F7A4C' : '#F4F4F6'; ctx.fillRect(sx, sy, sw, sh);
          if (ring) {
            const pulse = 1 + 0.08 * Math.sin(t * 12);
            ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(sx + sw / 2, sy + sh * 0.38, 110 * u * pulse, 0, 7); ctx.fill();
            ctx.fillStyle = '#F2C14E'; ctx.beginPath(); ctx.arc(sx + sw / 2, sy + sh * 0.38, 80 * u, 0, 7); ctx.fill();
            text('🥚', sx + sw / 2, sy + sh * 0.38, 70 * u, '#000');
            text(s.caller || 'Grosir Telur', sx + sw / 2, sy + sh * 0.62, 46 * u, '#FFFFFF');
            text('memanggil…', sx + sw / 2, sy + sh * 0.7, 32 * u, '#D8F5E4', 'center', 700);
            text(s.time || '22:00', sx + sw / 2, sy + 60 * u, 40 * u, '#FFFFFF');
          } else {
            ctx.fillStyle = '#2F6FD0'; ctx.fillRect(sx, sy, sw, 110 * u); text('Kontak', sx + sw / 2, sy + 62 * u, 40 * u, '#FFFFFF');
            lists[k].forEach((name, i) => { const yy = sy + 170 * u + i * 110 * u; const hl = p > 0.15 + i * 0.08 && /Telur|Jaya/.test(name);
              ctx.fillStyle = hl ? '#FFF2B8' : '#FFFFFF'; ctx.fillRect(sx + 16 * u, yy - 44 * u, sw - 32 * u, 88 * u);
              ctx.fillStyle = ['#E85D75', '#2E9E4F', '#2F6FD0'][i % 3]; ctx.beginPath(); ctx.arc(sx + 70 * u, yy, 30 * u, 0, 7); ctx.fill();
              text(name, sx + 120 * u, yy, 34 * u, '#1E1B19', 'left', 700); });
          }
        });
        text(k ? 'HP 2' : 'HP 1', x + pw / 2, y + ph + 70 * u, 44 * u, '#F4E6C8');
      });
    },
    // empty wallet + phone "Kuota Anda habis"
    kuota(p, t, s) {
      bgDesk();
      const k1 = E.outBack(prog(p, 0, 0.2), 1.4), k2 = E.outBack(prog(p, 0.35, 0.55), 1.6);
      ctx.save(); ctx.translate(cx - 230 * u, cy + 120 * u); ctx.scale(k1, k1); ctx.rotate(-0.12);
      rr(-230 * u, -150 * u, 460 * u, 300 * u, 30 * u, '#5A3B24'); rr(-210 * u, -170 * u, 420 * u, 120 * u, 26 * u, '#6E4A2E');
      text('Rp 0', 0, 40 * u, 70 * u, '#F4E6C8');
      for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2; ctx.fillStyle = '#2A2420'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 120 * u, -230 * u + Math.sin(a * 1.3) * 40 * u, 10 * u, 6 * u, 0, 0, 7); ctx.fill(); }
      ctx.restore();
      if (k2 > 0) {
        const pw = 380 * u, ph = 720 * u;
        ctx.save(); ctx.translate(cx + 200 * u, cy - 260 * u); ctx.scale(k2, k2); ctx.rotate(0.08);
        phone(-pw / 2, -ph / 2, pw, ph, (sx, sy, sw, sh) => { ctx.fillStyle = '#E9ECF2'; ctx.fillRect(sx, sy, sw, sh);
          rr(sx + 30 * u, sy + sh * 0.3, sw - 60 * u, 260 * u, 24 * u, '#FFFFFF', '#C8352E', 6 * u);
          text('⚠', sx + sw / 2, sy + sh * 0.3 + 70 * u, 64 * u, '#C8352E'); text(s.msg1 || 'Kuota Anda', sx + sw / 2, sy + sh * 0.3 + 150 * u, 40 * u, '#1E1B19'); text(s.msg2 || 'HABIS', sx + sw / 2, sy + sh * 0.3 + 205 * u, 50 * u, '#C8352E'); });
        ctx.restore();
      }
    },
    // dating app card swiped right -> "COCOK!"
    app_kencan(p, t, s) {
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#6B3FA0'); g.addColorStop(1, '#E85D75'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const pw = 620 * u, ph = 1160 * u;
      phone(cx - pw / 2, cy - ph / 2 - 30 * u, pw, ph, (sx, sy, sw, sh) => {
        ctx.fillStyle = '#FAF7FF'; ctx.fillRect(sx, sy, sw, sh); text(s.app || 'Jodohku', sx + sw / 2, sy + 70 * u, 46 * u, '#8A4FC9');
        const sw2 = E.inCubic(prog(p, 0.45, 0.65));
        ctx.save(); ctx.translate(sx + sw / 2 + sw2 * sw, sy + sh * 0.48); ctx.rotate(sw2 * 0.4);
        rr(-sw * 0.42, -sh * 0.33, sw * 0.84, sh * 0.62, 30 * u, '#D9C8F0');
        // avatar: purple bucket hat girl
        ctx.fillStyle = '#E2A06A'; ctx.beginPath(); ctx.arc(0, -40 * u, 120 * u, 0, 7); ctx.fill(); ctx.lineWidth = 8 * u; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = '#8A4FC9'; ctx.beginPath(); ctx.moveTo(-170 * u, -90 * u); ctx.quadraticCurveTo(0, -120 * u, 170 * u, -90 * u); ctx.lineTo(110 * u, -200 * u); ctx.quadraticCurveTo(0, -230 * u, -110 * u, -200 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; [-40, 40].forEach((d) => { ctx.beginPath(); ctx.arc(d * u, -40 * u, 12 * u, 0, 7); ctx.fill(); });
        ctx.lineWidth = 7 * u; ctx.beginPath(); ctx.arc(0, -10 * u, 34 * u, 0.2, Math.PI - 0.2); ctx.stroke();
        text(s.name || 'Rara, 24', 0, 160 * u, 54 * u, '#2A2420'); text(s.bio || 'Suka foto polaroid 📷', 0, 225 * u, 32 * u, '#5A4A6A', 'center', 700);
        ctx.restore();
        if (p > 0.62) { const k = E.outBack(prog(p, 0.62, 0.75), 2); ctx.save(); ctx.translate(sx + sw / 2, sy + sh * 0.45); ctx.scale(k, k); text('COCOK!', 0, 0, 110 * u, '#E85D75'); ctx.restore(); }
        [['✕', '#9A9A9A', -1], ['❤', '#E85D75', 1]].forEach(([g2, c2, d]) => { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(sx + sw / 2 + d * 130 * u, sy + sh - 120 * u, 64 * u, 0, 7); ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = c2; ctx.stroke(); text(g2, sx + sw / 2 + d * 130 * u, sy + sh - 116 * u, 60 * u, c2); });
      });
    },
    // group chat: messages pop in one by one
    grup_chat(p, t, s) {
      ctx.fillStyle = '#1C1A22'; ctx.fillRect(0, 0, W, H);
      const pw = 680 * u, ph = 1280 * u;
      phone(cx - pw / 2, cy - ph / 2 - 20 * u, pw, ph, (sx, sy, sw, sh) => {
        ctx.fillStyle = '#ECE5DA'; ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = '#2F7A5A'; ctx.fillRect(sx, sy, sw, 150 * u);
        text(s.group || 'Ibu-Ibu Pengajian & Info Terkini', sx + 40 * u, sy + 70 * u, 34 * u, '#FFFFFF', 'left');
        text(s.members || '58 anggota', sx + 40 * u, sy + 115 * u, 26 * u, '#CDEBDA', 'left', 700);
        const msgs = s.msgs || [{ from: 'Bu Darmi', text: 'Ada yang kenal Nad?' }, { from: 'Bu Darmi', text: 'Pacarnya Mas Bayu, katanya.' }, { from: 'Bu Sri', text: 'HAH?!' }, { from: 'Bu Tini', text: 'Nad siapa??' }, { from: 'Bu Yati', text: 'Bayu yang servis HP?' }];
        let y = sy + 210 * u;
        msgs.forEach((m, i) => {
          const k = E.outBack(prog(p, 0.05 + i * 0.15, 0.13 + i * 0.15), 1.6); if (k <= 0) return;
          const mine = m.from === (s.me || 'Bu Darmi');
          ctx.font = `700 ${36 * u}px Display`; const tw = Math.min(sw - 160 * u, ctx.measureText(m.text).width + 60 * u), bh = 120 * u;
          const bx = mine ? sx + sw - tw - 30 * u : sx + 30 * u;
          ctx.save(); ctx.translate(bx + tw / 2, y + bh / 2); ctx.scale(k, k); ctx.translate(-(bx + tw / 2), -(y + bh / 2));
          rr(bx, y, tw, bh, 22 * u, mine ? '#D6F5C4' : '#FFFFFF', null);
          text(m.from, bx + 28 * u, y + 34 * u, 24 * u, mine ? '#2F7A5A' : ['#C8352E', '#2F6FD0', '#8A4FC9'][i % 3], 'left');
          text(m.text, bx + 28 * u, y + 80 * u, 36 * u, '#1E1B19', 'left', 700);
          ctx.restore(); y += bh + 26 * u;
        });
        // typing bar
        rr(sx + 24 * u, sy + sh - 110 * u, sw - 48 * u, 80 * u, 40 * u, '#FFFFFF', null);
        if (Math.floor(t * 2) % 2) text('mengetik…', sx + 60 * u, sy + sh - 70 * u, 30 * u, '#8A8A8A', 'left', 700);
      });
    },
    // whiteboard timeline: long red line, then other colours stacked above it
    papan_tulis(p, t, s) {
      ctx.fillStyle = '#3A3F44'; ctx.fillRect(0, 0, W, H);
      const w = 960 * u, h = 1300 * u, x = cx - w / 2, y = cy - h / 2 - 40 * u;
      rr(x - 30 * u, y - 30 * u, w + 60 * u, h + 60 * u, 16 * u, '#8A6A4A', null);
      rr(x, y, w, h, 8 * u, '#F7F8F6', null);
      ctx.fillStyle = 'rgba(0,0,0,0.04)'; for (let i = 0; i < 12; i++) ctx.fillRect(x + hash01(i, 2) * w, y + hash01(i, 3) * h, 200 * u, 40 * u);
      const L = s.lines || [['merah', 'LARAS', 0, 1], ['hijau', 'SINTA', 0.05, 0.3], ['biru', 'WULAN', 0.12, 0.35], ['ungu', 'RARA', 0.62, 0.95], ['oranye', 'NADIA', 0.7, 0.98]];
      const left = x + 180 * u, right = x + w - 60 * u, base = y + h - 260 * u;
      text('5 TAHUN', (left + right) / 2, base + 120 * u, 46 * u, '#5A5A5A');
      marker(left, base + 60 * u, right, base + 60 * u, '#5A5A5A', 6 * u, prog(p, 0, 0.1));
      for (let k = 1; k <= 5; k++) text(`th ${k}`, left + (right - left) * (k - 0.5) / 5, base + 90 * u, 26 * u, '#7A7A7A', 'center', 700);
      L.forEach(([c, name, a, b], i) => {
        const yy = base - i * 150 * u, kk = E.inOutSine(prog(p, 0.1 + i * 0.13, 0.22 + i * 0.13));
        marker(left + (right - left) * a, yy, left + (right - left) * b, yy, col(c), 30 * u, kk, i);
        if (kk > 0) { ctx.globalAlpha = Math.min(1, kk * 3); text(name, x + 95 * u, yy, 40 * u, col(c)); ctx.globalAlpha = 1; }
      });
      if (p > 0.85) { const k = E.outBack(prog(p, 0.85, 0.95), 2); ctx.save(); ctx.translate(cx, y + 160 * u); ctx.scale(k, k); ctx.rotate(-0.05); text(s.headline || 'MAS BAYU', 0, 0, 96 * u, '#2A2420'); marker(-260 * u, 60 * u, 260 * u, 60 * u, '#D9302A', 14 * u, 1, 9); ctx.restore(); }
    },
  };
}
