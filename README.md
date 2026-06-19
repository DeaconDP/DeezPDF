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
npm run dev          # Development server
npm run build        # Production web/PWA build
npm run build:ios    # Production build for Capacitor iOS
npm run cap:sync     # Build + copy web assets into ios/
npm run cap:open     # Open the Xcode project
npm run ios          # Sync and open Xcode (one command)
npm start            # Run via launcher
```

---

## iOS / App Store (Xcode)

DeezPDF Reader includes a native iOS wrapper via [Capacitor](https://capacitorjs.com). The web app lives in `dist/`; Capacitor ships it inside a native shell you can open in Xcode.

### Requirements

- macOS with **Xcode** installed (from the Mac App Store)
- An **Apple Developer** account for device testing, TestFlight, or App Store upload
- Node.js (same as the rest of the project)

### Open in Xcode

After `npm install`:

```bash
npm run ios
```

This builds the app, syncs assets into `ios/`, and opens **`ios/App/App.xcodeproj`** in Xcode.

To sync again after web changes without opening Xcode:

```bash
npm run cap:sync
```

### Run on a device or simulator

1. In Xcode, select the **App** scheme and a simulator or connected iPhone.
2. Open **Signing & Capabilities** and choose your **Team**.
3. Confirm the bundle ID (`online.deac.deezpdf`) or change it to one you own.
4. Press **Run** (⌘R).

### Upload to App Store / TestFlight

1. In Xcode, set **Version** and **Build** under the App target (General tab).
2. Choose **Any iOS Device** as the run destination.
3. **Product → Archive**, then **Distribute App**.
4. Follow the prompts for TestFlight or App Store Connect.

Export compliance is preconfigured (`ITSAppUsesNonExemptEncryption = false`) because the app uses only standard HTTPS and local storage.

### iOS notes

- **Add PDF** works via the native file picker.
- **Add Folder** is hidden on iOS (not supported in mobile Safari/WebKit).
- PDFs stay on-device in IndexedDB — same privacy model as the web app.
- Regenerate icons/splash assets anytime with `npm run icons`.

---

## Platform Support

| Feature | Chrome/Edge | Safari | Firefox | iOS App |
|---------|-------------|--------|---------|---------|
| Add PDF | Yes | Yes | Yes | Yes |
| Add Folder | Yes | No | No | No |
| Swipe navigation | Yes | Yes | Yes | Yes |
| Offline reading | Yes | Yes | Yes | Yes |
| One-click launcher | Windows/Mac | Mac | — | — |
| App Store / TestFlight | — | — | — | Yes |

---

## TODO

- [ ] **iPhone PWA install (no App Store)** — Build and host the PWA, then add to Home Screen in Safari:
  1. Run `npm run build` to produce the `dist/` folder.
  2. Deploy `dist/` to static hosting with HTTPS (e.g. [Netlify Drop](https://app.netlify.com/drop), Cloudflare Pages, Vercel, or GitHub Pages).
  3. On iPhone, open the hosted URL in **Safari** (not Chrome).
  4. Tap **Share** → **Add to Home Screen** for a standalone app icon.
- [x] **Native iOS wrapper** — Capacitor project in `ios/` with Xcode workflow (`npm run ios`).
- [x] **iOS PWA icons** — PNG icons (192, 512, 180) plus App Store icon (1024).
- [x] **`preview:lan` script** — `npm run preview:lan` for LAN mobile testing.
- [x] **iPhone docs in README** — See iOS section above.

---

## License

MIT — Created by [deac.online](https://deac.online)
