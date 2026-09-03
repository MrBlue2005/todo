# Codex Limit Monitor

Overlay desktop pentru Windows care afiseaza simultan limitele Codex pentru doua sau mai multe workspace-uri ChatGPT.

## Pornire

```powershell
npm install
npm start
```

## Executabil

Pentru build local:

```powershell
npm run dist
```

Build-ul genereaza fisiere `.exe` in `dist`, inclusiv:

- `Codex Limit Monitor Setup <versiune>.exe` - installer Windows
- `Codex Limit Monitor <versiune>.exe` - varianta portable

Primul profil foloseste autentificarea Codex existenta de pe calculator. Profilurile izolate pot fi conectate separat cu butonul `Conecteaza`, astfel incat fiecare sa citeasca datele din alt workspace ChatGPT.

## Utilizare

- Overlay-ul ramane deasupra celorlalte ferestre si poate fi mutat din bara de titlu.
- Datele sunt citite prin `codex app-server` si se actualizeaza la 60 de secunde.
- Aplicatia trimite notificari native Windows cand se reseteaza fiecare fereastra de limita pentru fiecare workspace. Setarea poate fi oprita din meniul din system tray.
- Procentul mare din fiecare rand este limita ramasa. Textul mic arata procentul folosit raportat de Codex prin `usedPercent`.
- Randurile `Tokeni ...` vin din `account/usage/read`; acestea sunt rezumate de activitate, separate de ferestrele de rate limit.
- Click pe iconita din system tray pentru a ascunde sau afisa overlay-ul.
- Meniul `...` permite redenumirea, conectarea si adaugarea workspace-urilor.

Datele de autentificare ale profilurilor izolate sunt pastrate de Codex in directorul de date al aplicatiei Electron, nu in proiect.
