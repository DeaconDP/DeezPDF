# DeezPDF Reader

A cyberpunk-styled PDF reader with a local library. Read PDFs page-by-page like a Kindle, with swipe navigation and automatic progress saving. All your PDFs stay on your device — nothing is uploaded anywhere.

**Created by [deac.online](https://deac.online) @ [worldbuild.io](https://worldbuild.io)**

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
- **Lookup** — search online for PDFs by book title, author, or topic; preview results or add them to your library.
- **Download URL** — add a PDF from a direct link.
- **Search** — type in the search box to filter your library by filename.
- **Open** — click a PDF in the list to start reading.
- **Remove** — click the × button to remove a PDF from your library.

### Lookup

- **Search** — enter a book title, author name, or topic and tap Search.
- **Filter** — narrow results to Internet Archive, Project Gutenberg, or web sources.
- **Preview** — read a result before saving it; your reading position is not saved until you add it to the library.
- **Add** — download the PDF and store it in your local library.
- Only download PDFs you have the right to use.

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
- **Lookup** sends search terms to Internet Archive, Project Gutenberg (Gutendex), and optionally a web search service to find PDF links. When you preview or add a result, the PDF is downloaded from that link’s host (same as **Download URL**).
- No accounts, tracking, or upload of your library contents.

---

## Troubleshooting

### Error codes

| Code | Meaning |
|------|---------|
| ERR-LCH-001 | Node.js is not installed — download from [nodejs.org](https://nodejs.org) |
| ERR-LCH-002 | Could not start the local server — try closing other apps using port 5173 |
| ERR-LIB-001 | Failed to read a PDF file |
| ERR-LIB-002 | Folder picker not supported — use "Add PDF" instead, or switch to Chrome/Edge |
| ERR-LIB-003 | Failed to download PDF from URL |
| ERR-LIB-004 | Save location picker is not supported in this browser |
| ERR-LKP-001 | PDF lookup search failed |
| ERR-LKP-002 | No PDFs found for that search |
| ERR-LKP-003 | Failed to load PDF preview |
| ERR-PDF-001 | Failed to load or parse a PDF |
| ERR-PDF-002 | Failed to render a page |
| ERR-DB-001 | Failed to save data locally |

### Log file

Server logs are written to **`logs/app.log`** in the project folder.

### Debug panel

In the app, triple-click the footer credit, or press **Ctrl+Shift+D**, to open the debug log panel.

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
npm run ios:archive  # Sync + Release archive (build/DeezPDF.xcarchive)
npm run ios:export   # Export App Store IPA from archive (build/export/)
npm run preview:lan  # LAN preview for mobile testing
npm start            # Run via launcher
```

### PDF Lookup (developers)

**Archival search** (Internet Archive + Project Gutenberg) works in dev, PWA, and iOS without extra setup.

**Web search** uses a Vite dev proxy at `/api/pdf-search` backed by the [Brave Search API](https://brave.com/search/api/). Set `BRAVE_SEARCH_API_KEY` in your environment when running `npm run dev` or `npm run preview`.

For production builds (PWA or Capacitor), deploy the same search endpoint and set `VITE_PDF_SEARCH_URL` to its URL at build time. If unset, the app tries `https://deac.online/api/pdf-search` and falls back to archival sources when web search is unavailable.

```bash
export BRAVE_SEARCH_API_KEY=your_key_here
npm run dev
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

This builds the app, syncs assets into `ios/`, and opens **`ios/App/DeezPDF.xcodeproj`** in Xcode.

> **After editing web/TypeScript code**, run `npm run cap:sync` before rebuilding in Xcode. Use `npm run build:ios` (not plain `npm run build`) so assets use relative paths Capacitor needs. `App.xcodeproj` is a symlink to `DeezPDF.xcodeproj` for Capacitor CLI compatibility.

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

1. Sync the latest web build: `npm run ios:archive` (or `npm run cap:sync` before archiving in Xcode).
2. In Xcode, set **Version** (`1.0`) and **Build** (`1`) under the App target (General tab) — bump **Build** for each upload.
3. Choose **Any iOS Device** as the run destination.
4. **Product → Archive**, then **Distribute App** → **App Store Connect** → **Upload**.
5. In [App Store Connect](https://appstoreconnect.apple.com), add metadata, screenshots, and submit for review.

CLI alternative after archiving:

```bash
npm run ios:archive   # creates build/DeezPDF.xcarchive
npm run ios:export    # creates build/export/*.ipa — upload via Transporter or Organizer
```

> If `xcodebuild` fails with “requires Xcode”, point the active developer directory at the full app:  
> `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`  
> The archive scripts also set `DEVELOPER_DIR` automatically when Xcode is installed.

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
| PDF Lookup | Yes | Yes | Yes | Yes |
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

MIT — Created by [deac.online](https://deac.online) @ [worldbuild.io](https://worldbuild.io)
