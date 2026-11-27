#!/usr/bin/env python3
"""Valida le ricerche, aggiorna l'indice delle categorie e rigenera l'archivio.

Uso: python3 scripts/costruisci.py [--radice PERCORSO]

- legge data/ricerche/*.json
- controlla lo schema (esce con codice 1 se ci sono errori)
- aggiunge a data/indice.json le categorie e sottocategorie mancanti
  (nomi uguali a meno di maiuscole, accenti e spazi sono considerati lo stesso)
- scrive data/archivio.json, l'unico file letto dalla pagina
"""
import argparse
import difflib
import json
import re
import sys
import unicodedata
from pathlib import Path

CAMPI_OBBLIGATORI = ["id", "argomento", "categoria", "sottocategoria", "data", "sommario", "sezioni"]
LIVELLI = {"consolidato", "documentato", "sperimentale", "ipotesi"}
DATA_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ESITI_TENTATIVO = {"riuscito", "fallito", "inconcludente"}
ESITI_AFFERMAZIONE = {"confermata", "parziale", "smentita", "non verificabile"}
VERDETTI = {"GIÀ FATTO", "PARZIALMENTE FATTO", "NON TROVATO"}


def norma(testo):
    s = unicodedata.normalize("NFD", testo.strip().lower())
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


def controlla_fonte(f, dove, errori):
    if not isinstance(f, dict):
        errori.append(f"{dove}: fonte mancante o non è un oggetto")
        return
    if f.get("verificata") is True and not str(f.get("id", "")).strip():
        errori.append(f"{dove}: fonte 'verificata' senza id")
    if "verificata" in f and not isinstance(f["verificata"], bool):
        errori.append(f"{dove}: 'verificata' deve essere vero o falso")


def controlla(r, nome):
    errori = []
    if not isinstance(r, dict):
        return [f"{nome}: il file deve contenere un oggetto JSON"]
    for c in ("sezioni", "tentativi", "buchi"):
        if c in r and not isinstance(r[c], list):
            return [f"{nome}: '{c}' deve essere una lista"]
    for c in CAMPI_OBBLIGATORI:
        if c not in r or r[c] in ("", None):
            errori.append(f"{nome}: campo obbligatorio mancante: {c}")
    if errori:
        return errori
    if r["id"] != nome:
        errori.append(f"{nome}: l'id '{r['id']}' deve coincidere con il nome del file")
    ea = r.get("affermazione_iniziale")
    if ea is not None and (not isinstance(ea, dict) or ea.get("esito") not in ESITI_AFFERMAZIONE):
        errori.append(f"{nome}: affermazione_iniziale con esito non valido")
    for c in ("categoria", "sottocategoria", "argomento", "sommario"):
        if not isinstance(r[c], str):
            errori.append(f"{nome}: '{c}' deve essere testo")
    if errori:
        return errori
    if not DATA_RE.match(r["data"]) if isinstance(r["data"], str) else True:
        errori.append(f"{nome}: 'data' deve avere formato AAAA-MM-GG")
    if not r["sezioni"]:
        errori.append(f"{nome}: 'sezioni' non può essere vuota")
    for i, s in enumerate(r["sezioni"]):
        if not isinstance(s, dict):
            errori.append(f"{nome}: sezione {i} non è un oggetto")
            continue
        if not s.get("titolo"):
            errori.append(f"{nome}: sezione {i} senza titolo")
        voci = s.get("voci", [])
        if not isinstance(voci, list):
            errori.append(f"{nome}: sezione {i} 'voci' deve essere una lista")
            continue
        for j, v in enumerate(voci):
            dove = f"{nome}: sezione '{s.get('titolo')}' voce {j}"
            if not isinstance(v, dict):
                errori.append(f"{dove}: non è un oggetto")
                continue
            if not v.get("testo"):
                errori.append(f"{dove}: testo mancante")
            if v.get("livello") not in LIVELLI:
                errori.append(f"{dove}: livello non valido ({v.get('livello')!r})")
            controlla_fonte(v.get("fonte"), dove, errori)
    for j, t in enumerate(r.get("tentativi", [])):
        if not isinstance(t, dict):
            errori.append(f"{nome}: tentativo {j} non è un oggetto")
            continue
        if t.get("esito") not in ESITI_TENTATIVO:
            errori.append(f"{nome}: tentativo {j} esito non valido ({t.get('esito')!r})")
        controlla_fonte(t.get("fonte"), f"{nome}: tentativo {j}", errori)
    for j, b in enumerate(r.get("buchi", [])):
        if not isinstance(b, dict):
            errori.append(f"{nome}: buco {j} non è un oggetto")
            continue
        for c in ("domanda", "verdetto", "verifica", "disegno", "falsificazione"):
            if not b.get(c):
                errori.append(f"{nome}: buco {j} senza '{c}'")
        if b.get("verdetto") and b["verdetto"] not in VERDETTI:
            errori.append(f"{nome}: buco {j} verdetto non valido ({b['verdetto']!r})")
        fonti = b.get("fonti", [])
        if not isinstance(fonti, list):
            errori.append(f"{nome}: buco {j} 'fonti' deve essere una lista")
            continue
        for k, f in enumerate(fonti):
            controlla_fonte(f, f"{nome}: buco {j} fonte {k}", errori)
    return errori


def aggiorna_indice(indice, ricerche):
    """Aggiunge le categorie mancanti; restituisce l'elenco delle aggiunte."""
    aggiunte = []
    cats = indice.setdefault("categorie", [])
    for r in ricerche:
        cat = next((c for c in cats if norma(c["nome"]) == norma(r["categoria"])), None)
        if cat is None:
            for c in cats:
                if difflib.SequenceMatcher(None, norma(c["nome"]), norma(r["categoria"])).ratio() >= 0.8:
                    print(f"ATTENZIONE: la categoria '{r['categoria'].strip()}' somiglia a '{c['nome']}': "
                          "se è la stessa, riusa quella esistente", file=sys.stderr)
            cat = {"nome": r["categoria"].strip(), "sottocategorie": []}
            cats.append(cat)
            aggiunte.append(f"categoria: {cat['nome']}")
        sub = next((s for s in cat["sottocategorie"] if norma(s) == norma(r["sottocategoria"])), None)
        if sub is None:
            cat["sottocategorie"].append(r["sottocategoria"].strip())
            aggiunte.append(f"sottocategoria: {cat['nome']} / {r['sottocategoria'].strip()}")
        # allinea i nomi della ricerca a quelli dell'indice
        r["categoria"] = cat["nome"]
        r["sottocategoria"] = sub or r["sottocategoria"].strip()
    cats.sort(key=lambda c: norma(c["nome"]))
    for c in cats:
        c["sottocategorie"].sort(key=norma)
    return aggiunte


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--radice", default=str(Path(__file__).resolve().parent.parent))
    radice = Path(ap.parse_args().radice)
    cartella = radice / "data" / "ricerche"
    ricerche, errori = [], []
    for p in sorted(cartella.glob("*.json")):
        try:
            r = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            errori.append(f"{p.name}: file non valido ({e})")
            continue
        errori += controlla(r, p.stem)
        ricerche.append(r)
    if errori:
        print("\n".join(errori), file=sys.stderr)
        return 1

    pind = radice / "data" / "indice.json"
    indice = json.loads(pind.read_text(encoding="utf-8")) if pind.exists() else {"categorie": []}
    aggiunte = aggiorna_indice(indice, ricerche)
    pind.write_text(json.dumps(indice, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    ricerche.sort(key=lambda r: (r["data"], r["id"]), reverse=True)
    arch = {"indice": indice, "ricerche": ricerche}
    (radice / "data" / "archivio.json").write_text(
        json.dumps(arch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for a in aggiunte:
        print("aggiunta all'indice —", a)
    print(f"ok: {len(ricerche)} ricerche, {len(indice['categorie'])} categorie")
    return 0


if __name__ == "__main__":
    sys.exit(main())
