# Piattaforma di ricerca

Si indica un argomento qualsiasi in una sessione Claude; la ricerca segue la procedura di
`CLAUDE.md` (derivata da OncoPlatform) e il risultato compare nella pagina, ordinato per
categoria e sottocategoria.

- `data/ricerche/<id>.json`: una ricerca (schema in `modelli/ricerca.modello.json`)
- `data/indice.json`: categorie e sottocategorie, aggiornate in automatico
- `data/archivio.json`: generato, è l'unico file letto dalla pagina
- `scripts/costruisci.py`: valida, aggiorna l'indice, rigenera l'archivio
- `tests/`: `python3 -m unittest discover tests`

Anteprima locale: `python3 -m http.server` e aprire `http://localhost:8000`.
Pubblicazione: GitHub Pages dal ramo `main`, cartella radice.
