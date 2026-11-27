# Regole di consumo e ruoli

- Sonnet gestisce la sessione principale: scrive codice e corregge bug.
- Ricerche nel repository, grep e test vanno ai sotto-agenti Haiku 5.5 (`search`, `grep`, `audit`),
  anche in parallelo, per mantenere il contesto principale snello.
- `audit` lavora in worktree isolato, così non tocca il branch di lavoro.
- Opus (`advisor`) è in stand-by: lo si invoca solo per decisioni chiave e per la firma finale dei diff.
  Non sprecare il suo contesto su lavoro di routine.
- Scelte rapide e deterministiche (scelta tool, percorso, retry) le decide direttamente Sonnet, senza sotto-agenti.

# Piattaforma di ricerca generale

L'utente indica un argomento qualsiasi; la sessione esegue la ricerca e la pubblica nel sito.
Ogni ricerca è un file `data/ricerche/<id>.json` (schema in `modelli/ricerca.modello.json`).
Categorie e sottocategorie stanno in `data/indice.json` e si aggiungono da sole:
`python3 scripts/costruisci.py` aggiunge all'indice quelle mancanti e rigenera `data/archivio.json`,
che è l'unico file letto dalla pagina. Prima di crearne una nuova, riusa una categoria esistente se calza (lo script avvisa se un nome nuovo somiglia a uno esistente).
Livelli delle voci: `consolidato`, `documentato` (per temi non sperimentali: storia, diritto, economia), `sperimentale`, `ipotesi`.

## Procedura per ogni nuova ricerca

1. Passi 1-5 della scheda (stato delle conoscenze, catena causale o nesso, ridondanze e alternative,
   storia dei tentativi, limiti e condizioni di validità), con sotto-agenti Haiku in parallelo.
   L'affermazione di partenza dell'utente non è un dato da assumere ma da verificare.
2. Passo 6 (buchi residui): per ciascuna domanda residua si verifica sempre, con sotto-agenti Haiku in
   parallelo (uno per domanda o per coppia), se l'indagine è già stata fatta in tutto o in parte
   (verdetto GIÀ FATTO, PARZIALMENTE FATTO o NON TROVATO), che cosa manca davvero, e si riformulano
   disegno e criterio di falsificazione. Una domanda mal posta va corretta e dichiarato il motivo.
   Il campo `verifica` della domanda riporta ciò che esiste già.
3. Tre giri di verifica delle fonti: giro 1 riletture dirette alla fonte primaria (banca dati, registro,
   pubblicazione); giro 2 confronto di ogni identificativo con titolo e contenuto; giro 3 controllo
   indipendente delle affermazioni negative e dei record non ancora riletti.
4. Una fonte è marcata `verificata` solo se riletta; il resto resta 'non verificata'. Nessun
   identificativo inventato; 'fonte non reperita' dove manca.
5. Esegui `python3 scripts/costruisci.py` (deve passare senza errori), poi commit, push e pubblicazione;
   la PR verso main aggiorna il sito (GitHub Pages).
