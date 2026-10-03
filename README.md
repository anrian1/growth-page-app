# KIA Tumbuh (growth-page-app)

Offline-first web app for the Buku KIA growth page (children 0-24 months).
A person enters the measurements, the app calculates WHO z-scores and Permenkes 2/2020 categories,
the person confirms, the record is saved on the phone, and a CSV can be exported for the puskesmas.
No server, no cloud. Typed entry works now. Photo reading (OCR) is being tested on a separate page (`/ocr-spike.html`).

## Run on your computer
    npm install
    npm run dev          # opens a local link (not offline yet)
    npm test             # calculator tests, app tests, screen tests

## Build and publish
    npm run build        # makes the dist/ folder
Connect the GitHub repo to Vercel (framework: Vite). Vercel builds and gives you an HTTPS link.

## Test offline on a phone (Gate 0)
1. Open the Vercel link on the phone (internet on). Wait for the green banner "Siap offline".
2. iPhone: Share > Add to Home Screen. Android: Install app.
3. Switch on airplane mode. Open the icon. The app must open and calculate.
4. Save a record, close the app, open it again: the record must still be there.

## OCR test page (engine check)
`/ocr-spike.html` loads a small open OCR model inside the browser, reads one photo, and shows what it found and how long it took.
It does not map values to columns yet. Before the first build, run once:

    npm install
    npm run setup-ocr    # copies the WebAssembly files and downloads the model files into public/ (about 14 MB + models)

`npm run build` runs this step automatically, so Vercel fetches the model files while building (the build needs internet).
The files in `public/ort` and `public/models` are not committed to GitHub; they are rebuilt each time.
If a download fails, the script says which file and where to get it by hand.

`vercel.json` sets two headers (Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy) so the OCR can use several processor threads.
If the site ever fails to load anything from another address, delete `vercel.json` and redeploy.

## What is where
- `src/core/zscore.js`   calculator (tested against 52 known-answer cases)
- `src/core/childcode.js` 6-digit child code with check digit
- `src/csv.js`           CSV builder (comma, dot decimals, ISO dates, DOB only if ticked)
- `src/storage.js`       records in the phone's own database (IndexedDB)
- `src/main.js`          screen logic
- `src/ocr-helpers.js`   turns OCR text into numbers (look-alike letters such as S->5), checks expected values
- `src/ocr-spike.js`     the OCR test page logic (`ocr-spike.html`)
- `scripts/setup-ocr.mjs` prepares the OCR files for offline use
- `vite.config.js`       PWA settings: what is saved for offline use is listed in `workbox.globPatterns`
- `tests/`               known-answer cases and tests

## Safeguards built in
- A person confirms every record. Flagged values need an extra "I checked" tick.
- Implausible values are flagged with the reason ("Weight 84 kg is outside 1-25 kg...").
- Output wording: screening aid, not a diagnosis.
- Data stays on the phone. "Delete all" button. Synthetic data only for the demo.

## Known limits
- iPhone may clear a website's saved data after about a week without use. Export often.
- No PIN yet. Photo reading is only a test page so far (not tested on a phone yet). Only the 0-24 month growth page.
- OCR model files come from third-party hosting (Hugging Face, GitHub mirror) of PaddleOCR models. Check their licences before redistributing.
- Placeholder limits in `zscore.js` (LIMITS) need a clinician's confirmation.
