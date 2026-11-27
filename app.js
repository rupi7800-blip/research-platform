'use strict';
let DATI = { indice: { categorie: [] }, ricerche: [] };
const $ = (id) => document.getElementById(id);

// Decodifica senza lanciare errori su hash malformati.
function dec(t) { try { return decodeURIComponent(t); } catch (e) { return t; } }

// Raccoglie solo i valori testuali (non i nomi dei campi) per la ricerca.
function testi(o, out) {
  if (typeof o === 'string') out.push(o);
  else if (Array.isArray(o)) o.forEach((x) => testi(x, out));
  else if (o && typeof o === 'object') Object.values(o).forEach((x) => testi(x, out));
  return out;
}

// Costruisce un elemento; i testi passano sempre da textContent (mai HTML).
function el(tag, cls, testo) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (testo !== undefined && testo !== null) e.textContent = testo;
  return e;
}

function fonte(f) {
  const b = el('span', 'badge');
  if (!f || !String(f.id || '').trim()) { b.classList.add('ass'); b.textContent = 'fonte non reperita'; return b; }
  const ok = f.verificata === true;
  b.classList.add(ok ? 'ok' : 'no');
  b.textContent = (f.tipo ? f.tipo + ' ' : '') + f.id + ' · ' + (ok ? 'verificata' : 'non verificata');
  return b;
}

function voce(v) {
  const d = el('div', 'voce');
  d.append(el('span', null, v.testo));
  if (v.livello) d.append(el('span', 'badge liv', v.livello));
  d.append(fonte(v.fonte));
  if (v.prova) d.append(el('p', 'prova', 'Prova: ' + v.prova));
  return d;
}

function scheda(r) {
  const m = $('main'); m.replaceChildren();
  m.append(el('h2', null, r.argomento));
  m.append(el('p', 'meta', r.categoria + ' › ' + r.sottocategoria + ' · ' + r.data));
  m.append(el('p', null, r.sommario));
  if (r.affermazione_iniziale) {
    const a = r.affermazione_iniziale, d = el('div', 'voce');
    d.append(el('strong', null, 'Affermazione di partenza: '), el('span', null, a.testo + ' '));
    d.append(el('span', 'badge liv', a.esito || ''));
    if (a.motivo) d.append(el('p', 'prova', a.motivo));
    m.append(d);
  }
  for (const s of r.sezioni || []) {
    m.append(el('h3', null, s.titolo));
    (s.voci || []).forEach((v) => m.append(voce(v)));
  }
  if ((r.tentativi || []).length) {
    m.append(el('h3', null, 'Storia dei tentativi'));
    for (const t of r.tentativi) {
      const d = el('div', 'voce');
      d.append(el('strong', null, t.cosa + ' '), el('span', 'badge liv', t.esito || ''), fonte(t.fonte));
      if (t.ragione) d.append(el('p', 'prova', t.ragione));
      m.append(d);
    }
  }
  if ((r.buchi || []).length) {
    m.append(el('h3', null, 'Buchi residui'));
    for (const b of r.buchi) {
      const d = el('div', 'buco');
      d.append(el('strong', null, b.domanda + ' '), el('span', 'badge liv', b.verdetto));
      d.append(el('p', 'prova', 'Esiste già: ' + b.verifica));
      d.append(el('p', 'prova', 'Disegno: ' + b.disegno));
      d.append(el('p', 'prova', 'Falsificazione: ' + b.falsificazione));
      for (const f of b.fonti || []) d.append(fonte(f));
      m.append(d);
    }
  }
  if (r.note) m.append(el('p', 'meta', r.note));
}

function elenco(rs, titolo) {
  const m = $('main'); m.replaceChildren();
  m.append(el('h2', null, titolo));
  if (!rs.length) { m.append(el('p', 'vuoto', 'Nessuna ricerca trovata.')); return; }
  for (const r of rs) {
    const c = el('div', 'card'), a = el('a', null, r.argomento);
    a.href = '#r/' + encodeURIComponent(r.id);
    c.append(a, el('p', 'meta', r.categoria + ' › ' + r.sottocategoria + ' · ' + r.data), el('p', null, r.sommario));
    m.append(c);
  }
}

function menu(att) {
  const n = $('nav'); n.replaceChildren();
  const tutte = el('a', null, 'Tutte le ricerche'); tutte.href = '#';
  n.append(tutte);
  for (const c of DATI.indice.categorie) {
    const det = el('details'); det.open = true;
    const nc = DATI.ricerche.filter((r) => r.categoria === c.nome).length;
    const sm = el('summary', null, c.nome + ' (' + nc + ')'); det.append(sm);
    for (const s of c.sottocategorie) {
      const a = el('a', 'sub', s); a.href = '#c/' + encodeURIComponent(c.nome) + '/' + encodeURIComponent(s);
      if (dec(att) === dec(a.getAttribute('href'))) a.classList.add('att');
      det.append(a);
    }
    n.append(det);
  }
}

function vai() {
  // si divide l'hash grezzo e si decodifica ogni pezzo: un '/' nel nome resta nel nome
  const parti = location.hash.slice(1).split('/').map(dec), q = $('cerca').value.trim().toLowerCase();
  menu(location.hash);
  if (q) {
    const rs = DATI.ricerche.filter((r) => testi(r, []).join('\n').toLowerCase().includes(q));
    return elenco(rs, 'Risultati per «' + q + '»');
  }
  if (parti[0] === 'r') {
    const r = DATI.ricerche.find((x) => x.id === parti[1]);
    return r ? scheda(r) : elenco([], 'Ricerca non trovata');
  }
  if (parti[0] === 'c') {
    const [, cat, sub] = parti;
    return elenco(DATI.ricerche.filter((r) => r.categoria === cat && r.sottocategoria === sub), cat + ' › ' + sub);
  }
  elenco(DATI.ricerche, 'Tutte le ricerche');
}

// 'no-cache' obbliga il browser a rivalidare l'archivio a ogni apertura: senza, le nuove schede
// possono comparire con ritardo (GitHub Pages lo fa conservare in cache per circa 10 minuti).
fetch('data/archivio.json', { cache: 'no-cache' })
  .then((r) => r.json())
  .then((d) => { DATI = d; vai(); })
  .catch(() => { $('main').replaceChildren(el('p', 'vuoto', 'Impossibile caricare i dati. Servi la cartella via HTTP.')); });
window.addEventListener('hashchange', vai);
$('cerca').addEventListener('input', vai);
