# DeezPDF Reader

A cyberpunk-styled PDF reader with a local library. Read PDFs page-by-page like a Kindle, with swipe navigation and automatic progress saving. All your PDFs stay on your device — nothing is uploaded anywhere.

**Created by [deac.online](https://deac.online)**

---

## Quick Start

No terminal knowledge required.

### Windows

1. Make sure [Node.js](https://nodejs.org) is installed (the launcher will tell you if it is missing).
2. Double-click **`run.bat`**
3. Wait for dependencies to install on first run (this only happens once).
4. The app opens automatically in your browser.
5. Close the browser window when you're done — the app shuts down automatically.

**Optional:** Run `npm run build:exe` to create a standalone `DeezPDFReader.exe` (requires Node.js).

### Mac

1. Make sure [Node.js](https://nodejs.org) is installed.
2. Double-click **`run.command`**
   - First time only: right-click → **Open** to bypass Gatekeeper.
3. Wait for dependencies to install on first run.
4. The app opens automatically in your browser.
5. Close the browser window when you're done.

---

## Using the App

### Library

- **Add PDF** — pick one or more PDF files from your computer.
- **Add Folder** — import all PDFs from a folder (works best in Chrome or Edge).
- **Search** — type in the search box to filter your library by filename.
- **Open** — click a PDF in the list to start reading.
- **Remove** — click the × button to remove a PDF from your library.

### Reader

- **Next page** — swipe right (mobile) or press → / ↓ (keyboard) or click →
- **Previous page** — swipe left (mobile) or press ← / ↑ (keyboard) or click ←
- **Back to library** — click "← Library" or press Escape
- Your reading position is saved automatically and restored when you reopen a PDF.

### Install as App (PWA)

In Chrome or Edge, click the install icon in the address bar to add DeezPDF Reader to your desktop or home screen for an app-like experience.

---

## Privacy

- All PDFs are stored locally in your browser (IndexedDB).
- No data is sent to any server.
- No accounts, API keys, or tracking.

---

## Troubleshooting

### Error codes

| Code | Meaning |
|------|---------|
| ERR-LCH-001 | Node.js is not installed — download from [nodejs.org](https://nodejs.org) |
| ERR-LCH-002 | Could not start the local server — try closing other apps using port 5173 |
| ERR-LIB-001 | Failed to read a PDF file |
| ERR-LIB-002 | Folder picker not supported — use "Add PDF" instead, or switch to Chrome/Edge |
| ERR-PDF-001 | Failed to load or parse a PDF |
| ERR-PDF-002 | Failed to render a page |
| ERR-DB-001 | Failed to save data locally |

### Log file

Server logs are written to **`logs/app.log`** in the project folder.

### Debug panel

In the app, triple-click **"Created by deac.online"** in the footer, or press **Ctrl+Shift+D**, to open the debug log panel.

### Folder import not working

The folder picker requires Chrome or Edge. On Safari or Firefox, use **Add PDF** to select files individually.

---

## For Developers

```bash
npm install
npm run dev      # Development server
npm run build    # Production build
npm start        # Run via launcher
```

---

## Platform Support

| Feature | Chrome/Edge | Safari | Firefox |
|---------|-------------|--------|---------|
| Add PDF | Yes | Yes | Yes |
| Add Folder | Yes | No | No |
| Swipe navigation | Yes | Yes | Yes |
| Offline reading | Yes | Yes | Yes |
| One-click launcher | Windows/Mac | Mac | — |

---

## License

MIT — Created by [deac.online](https://deac.online)
