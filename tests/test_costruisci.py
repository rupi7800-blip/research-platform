import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
SCRIPT = RADICE / "scripts" / "costruisci.py"

BASE = {
    "id": "prova-uno", "argomento": "Prova", "categoria": "Salute", "sottocategoria": "Sonno",
    "data": "2026-11-27", "sommario": "x",
    "sezioni": [{"titolo": "Stato", "voci": [
        {"testo": "a", "livello": "ipotesi", "fonte": {"tipo": "URL", "id": "", "verificata": False}, "prova": "p"}]}],
}


def esegui(ricerche):
    d = Path(tempfile.mkdtemp())
    (d / "data" / "ricerche").mkdir(parents=True)
    for r in ricerche:
        (d / "data" / "ricerche" / f"{r['id']}.json").write_text(json.dumps(r), encoding="utf-8")
    p = subprocess.run([sys.executable, str(SCRIPT), "--radice", str(d)], capture_output=True, text=True)
    return d, p


class Test(unittest.TestCase):
    def test_aggiunge_categorie_e_archivio(self):
        d, p = esegui([BASE])
        self.assertEqual(p.returncode, 0, p.stderr)
        ind = json.loads((d / "data" / "indice.json").read_text())
        self.assertEqual(ind["categorie"][0]["nome"], "Salute")
        self.assertEqual(ind["categorie"][0]["sottocategorie"], ["Sonno"])
        arch = json.loads((d / "data" / "archivio.json").read_text())
        self.assertEqual(len(arch["ricerche"]), 1)

    def test_nuova_sottocategoria_e_nessun_duplicato(self):
        b = copy.deepcopy(BASE); b["id"] = "prova-due"; b["categoria"] = "salute "; b["sottocategoria"] = "Alimentazione"
        c = copy.deepcopy(BASE); c["id"] = "prova-tre"; c["categoria"] = "SALUTE"; c["sottocategoria"] = "sonno"
        d, p = esegui([BASE, b, c])
        self.assertEqual(p.returncode, 0, p.stderr)
        ind = json.loads((d / "data" / "indice.json").read_text())
        self.assertEqual(len(ind["categorie"]), 1)
        # la grafia è quella della prima ricerca letta: si confronta senza maiuscole
        self.assertEqual([s.lower() for s in ind["categorie"][0]["sottocategorie"]], ["alimentazione", "sonno"])

    def test_fonte_verificata_senza_id_rifiutata(self):
        b = copy.deepcopy(BASE)
        b["sezioni"][0]["voci"][0]["fonte"]["verificata"] = True
        _, p = esegui([b])
        self.assertEqual(p.returncode, 1)
        self.assertIn("senza id", p.stderr)

    def test_campo_mancante_e_id_diverso_dal_file(self):
        b = copy.deepcopy(BASE); del b["sommario"]
        _, p = esegui([b])
        self.assertEqual(p.returncode, 1)
        self.assertIn("sommario", p.stderr)

    def test_verdetto_non_valido(self):
        b = copy.deepcopy(BASE)
        b["buchi"] = [{"domanda": "q", "verdetto": "BOH", "verifica": "v", "disegno": "d", "falsificazione": "f"}]
        _, p = esegui([b])
        self.assertEqual(p.returncode, 1)
        self.assertIn("verdetto", p.stderr)

    def test_livello_ed_esiti_non_validi(self):
        b = copy.deepcopy(BASE); b["sezioni"][0]["voci"][0]["livello"] = "boh"
        _, p = esegui([b]); self.assertEqual(p.returncode, 1); self.assertIn("livello", p.stderr)
        c = copy.deepcopy(BASE); c["tentativi"] = [{"cosa": "x", "esito": "boh", "fonte": {"id": "", "verificata": False}}]
        _, p = esegui([c]); self.assertEqual(p.returncode, 1); self.assertIn("esito", p.stderr)
        d = copy.deepcopy(BASE); d["affermazione_iniziale"] = {"testo": "t", "esito": "boh"}
        _, p = esegui([d]); self.assertEqual(p.returncode, 1); self.assertIn("affermazione_iniziale", p.stderr)

    def test_forme_sbagliate_e_file_non_utf8(self):
        b = copy.deepcopy(BASE); b["sezioni"] = "no"
        _, p = esegui([b]); self.assertEqual(p.returncode, 1); self.assertNotIn("Traceback", p.stderr)
        d = Path(tempfile.mkdtemp()); (d / "data" / "ricerche").mkdir(parents=True)
        (d / "data" / "ricerche" / "a.json").write_bytes(b"\xff\xfe\x00")
        (d / "data" / "ricerche" / "b.json").write_text("[1]")
        p = subprocess.run([sys.executable, str(SCRIPT), "--radice", str(d)], capture_output=True, text=True)
        self.assertEqual(p.returncode, 1); self.assertNotIn("Traceback", p.stderr)


if __name__ == "__main__":
    unittest.main()
