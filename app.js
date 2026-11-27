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

// Evidenzia le occorrenze di q dentro un testo, senza mai usare HTML.
function hl(testo, q) {
  const t = String(testo == null ? '' : testo), f = document.createDocumentFragment();
  const low = t.toLowerCase();
  if (!q || low.length !== t.length || !low.includes(q)) { f.append(t); return f; }
  let i = 0, k;
  while ((k = low.indexOf(q, i)) !== -1) {
    if (k > i) f.append(t.slice(i, k));
    f.append(el('mark', null, t.slice(k, k + q.length)));
    i = k + q.length;
  }
  if (i < t.length) f.append(t.slice(i));
  return f;
}

const ASSENTE = /^fonte non reperita$/i;
// Stato della fonte: 'ass' (identificativo assente), 'ok' (riletta), 'no' (non riletta).
function statoFonte(f) {
  if (!f || !String(f.id || '').trim() || ASSENTE.test(String(f.id).trim())) return 'ass';
  return f.verificata === true ? 'ok' : 'no';
}

// Solo link web http(s): qualunque altro schema non diventa mai un collegamento.
function linkSicuro(u) { return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null; }

function fonte(f) {
  const st = statoFonte(f), u = st === 'ass' ? null : linkSicuro(f.url);
  const b = el(u ? 'a' : 'span', 'badge ' + st);
  if (st === 'ass') { b.textContent = 'fonte non reperita'; return b; }
  b.textContent = (f.tipo ? f.tipo + ' ' : '') + f.id + ' · ' + (st === 'ok' ? 'verificata' : 'non verificata') + (u ? ' ↗' : '');
  if (u) {
    b.href = u; b.target = '_blank'; b.rel = 'noopener noreferrer';
    b.title = 'Apri la fonte in una nuova scheda: ' + u;
  }
  return b;
}

function voce(v, q) {
  const d = el('div', 'voce');
  d.append(el('span'));
  d.firstChild.append(hl(v.testo, q));
  if (v.livello) d.append(el('span', 'badge liv', v.livello));
  d.append(fonte(v.fonte));
  if (v.prova) { const p = el('p', 'prova', 'Prova: '); p.append(hl(v.prova, q)); d.append(p); }
  return d;
}

// ---- Filtri della scheda ----
const GRUPPI = [
  { id: 'liv', etichetta: 'Livello', valori: (r) => (r.sezioni || []).flatMap((s) => s.voci || []).map((v) => v.livello) },
  { id: 'esi', etichetta: 'Esito dei tentativi', valori: (r) => (r.tentativi || []).map((t) => t.esito) },
  { id: 'ver', etichetta: 'Verdetto dei buchi', valori: (r) => (r.buchi || []).map((b) => b.verdetto) },
  { id: 'fon', etichetta: 'Fonte', valori: (r) => [
    ...(r.sezioni || []).flatMap((s) => s.voci || []).map((v) => v.fonte),
    ...(r.tentativi || []).map((t) => t.fonte),
    ...(r.buchi || []).flatMap((x) => x.fonti || [])].map((f) => STATO_NOME[statoFonte(f)]) },
];
let FILTRI = {};
let SCHEDA = null;
const STATO_NOME = { ok: 'verificata', no: 'non verificata', ass: 'non reperita' };

function passa(gruppo, valore) {
  const sel = FILTRI[gruppo];
  return !sel || !sel.size || sel.has(valore);
}
function passaFonti(fonti) {
  const sel = FILTRI.fon;
  if (!sel || !sel.size) return true;
  return (fonti || []).some((f) => sel.has(STATO_NOME[statoFonte(f)]));
}
function contiene(o, q) { return !q || testi(o, []).join('\n').toLowerCase().includes(q); }

// Ricostruisce solo i risultati: la casella di ricerca e i filtri restano dove sono.
function corpo() {
  const r = SCHEDA, q = $('cerca').value.trim().toLowerCase(), box = $('risultati');
  box.replaceChildren();
  let tot = 0, mostrati = 0;
  for (const s of r.sezioni || []) {
    const els = [];
    for (const v of s.voci || []) {
      tot++;
      if (passa('liv', v.livello) && passaFonti([v.fonte]) && contiene(v, q)) { els.push(voce(v, q)); mostrati++; }
    }
    if (els.length) { box.append(el('h3', null, s.titolo)); els.forEach((e) => box.append(e)); }
  }
  const ten = [];
  for (const t of r.tentativi || []) {
    tot++;
    if (!(passa('esi', t.esito) && passaFonti([t.fonte]) && contiene(t, q))) continue;
    mostrati++;
    const d = el('div', 'voce'), st = el('strong'); st.append(hl(t.cosa + ' ', q));
    d.append(st, el('span', 'badge liv', t.esito || ''), fonte(t.fonte));
    if (t.ragione) { const p = el('p', 'prova'); p.append(hl(t.ragione, q)); d.append(p); }
    ten.push(d);
  }
  if (ten.length) { box.append(el('h3', null, 'Storia dei tentativi')); ten.forEach((e) => box.append(e)); }
  const bu = [];
  for (const b of r.buchi || []) {
    tot++;
    if (!(passa('ver', b.verdetto) && passaFonti(b.fonti) && contiene(b, q))) continue;
    mostrati++;
    const d = el('div', 'buco'), st = el('strong'); st.append(hl(b.domanda + ' ', q));
    d.append(st, el('span', 'badge liv', b.verdetto));
    for (const [et, k] of [['Esiste già: ', 'verifica'], ['Disegno: ', 'disegno'], ['Falsificazione: ', 'falsificazione']]) {
      const p = el('p', 'prova', et); p.append(hl(b[k], q)); d.append(p);
    }
    for (const f of b.fonti || []) d.append(fonte(f));
    bu.push(d);
  }
  if (bu.length) { box.append(el('h3', null, 'Buchi residui')); bu.forEach((e) => box.append(e)); }
  if (r.note && !q && !Object.values(FILTRI).some((x) => x.size)) box.append(el('p', 'meta', r.note));
  if (!mostrati) box.append(el('p', 'vuoto', 'Nessun elemento corrisponde alla ricerca e ai filtri scelti.'));
  $('conta').textContent = mostrati + ' di ' + tot + ' elementi mostrati';
}

function barraFiltri(r) {
  const b = el('div', 'filtri');
  b.append(el('p', 'conta', ''));
  b.lastChild.id = 'conta';
  b.lastChild.setAttribute('aria-live', 'polite');
  for (const g of GRUPPI) {
    const conta = {};
    g.valori(r).forEach((x) => { if (x) conta[x] = (conta[x] || 0) + 1; });
    const nomi = Object.keys(conta);
    if (!nomi.length) continue;
    const riga = el('div', 'gruppo'); riga.append(el('span', 'et', g.etichetta + ':'));
    for (const n of nomi) {
      const c = el('button', 'chip', n + ' (' + conta[n] + ')');
      c.type = 'button'; c.setAttribute('aria-pressed', 'false');
      c.addEventListener('click', () => {
        const sel = FILTRI[g.id] || (FILTRI[g.id] = new Set());
        sel.has(n) ? sel.delete(n) : sel.add(n);
        c.setAttribute('aria-pressed', String(sel.has(n)));
        c.classList.toggle('on', sel.has(n));
        corpo();
      });
      riga.append(c);
    }
    b.append(riga);
  }
  const az = el('button', 'chip azzera', 'Azzera filtri');
  az.type = 'button';
  az.addEventListener('click', () => {
    FILTRI = {}; $('cerca').value = '';
    b.querySelectorAll('.chip.on').forEach((c) => { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
    corpo();
  });
  b.append(az);
  return b;
}

function scheda(r) {
  SCHEDA = r; FILTRI = {};
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
  m.append(barraFiltri(r));
  const box = el('div'); box.id = 'risultati'; m.append(box);
  corpo();
}

function elenco(rs, titolo, q) {
  const m = $('main'); m.replaceChildren();
  m.append(el('h2', null, titolo));
  if (!rs.length) { m.append(el('p', 'vuoto', 'Nessuna ricerca trovata.')); return; }
  for (const r of rs) {
    const c = el('div', 'card'), a = el('a', null, r.argomento);
    a.href = '#r/' + encodeURIComponent(r.id);
    c.append(a, el('p', 'meta', r.categoria + ' › ' + r.sottocategoria + ' · ' + r.data));
    const pass = q ? passaggi(r, q) : [];
    if (q) c.append(el('p', 'meta', pass.length ? pass.length + ' passaggi corrispondenti — apri la ricerca per vederli evidenziati' : 'Corrisponde nel riepilogo o nelle note'));
    if (pass.length) {
      const ul = el('ul', 'estratti');
      for (const x of pass.slice(0, 3)) {
        const li = el('li'); li.append(el('span', 'badge liv', x.tipo), ' ');
        li.append(hl(x.testo.length > 180 ? x.testo.slice(0, 180) + '…' : x.testo, q));
        ul.append(li);
      }
      c.append(ul);
    } else c.append(el('p', null, r.sommario));
    m.append(c);
  }
}

// Elementi (voci, tentativi, buchi) di una ricerca che contengono q.
function passaggi(r, q) {
  const out = [];
  for (const s of r.sezioni || []) for (const v of s.voci || []) if (contiene(v, q)) out.push({ tipo: 'voce', testo: v.testo });
  for (const t of r.tentativi || []) if (contiene(t, q)) out.push({ tipo: 'tentativo', testo: t.cosa });
  for (const b of r.buchi || []) if (contiene(b, q)) out.push({ tipo: 'buco', testo: b.domanda });
  return out;
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
  $('cerca').placeholder = parti[0] === 'r' ? 'Cerca dentro questa ricerca…' : 'Cerca negli argomenti e nei testi…';
  if (parti[0] === 'r') {
    const r = DATI.ricerche.find((x) => x.id === parti[1]);
    return r ? scheda(r) : elenco([], 'Ricerca non trovata');
  }
  if (q) {
    const rs = DATI.ricerche.filter((r) => testi(r, []).join('\n').toLowerCase().includes(q))
      .sort((a, b) => passaggi(b, q).length - passaggi(a, q).length);
    return elenco(rs, 'Risultati per «' + q + '»', q);
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
// dentro una scheda la casella filtra la scheda senza ricostruirla; altrove cerca tra gli argomenti
$('cerca').addEventListener('input', () => (SCHEDA && location.hash.startsWith('#r/') ? corpo() : vai()));
