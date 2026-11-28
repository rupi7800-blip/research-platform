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


## App installabile

Il sito è un'app web installabile (PWA): si apre anche senza rete e ha una propria icona.
Su Android e computer (Chrome, Edge) compare il pulsante «Installa l'app» in alto; su iPhone e iPad
si usa «Condividi» → «Aggiungi alla schermata Home». Non serve alcun file APK.
Dopo aver modificato `index.html`, `style.css` o `app.js`, aumentare `VERSIONE` in `sw.js` per aggiornare la cache.
Le icone sono in `icone/` (origine: `icona.svg`).
