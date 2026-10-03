# KIA Tumbuh (growth-page-app)

Offline-first web app for the Buku KIA growth page (children 0-24 months).
A person enters the measurements, the app calculates WHO z-scores and Permenkes 2/2020 categories,
the person confirms, the record is saved on the phone, and a CSV can be exported for the puskesmas.
No server, no cloud, no AI call in this version. Photo reading (OCR) is the next step.

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

## What is where
- `src/core/zscore.js`   calculator (tested against 52 known-answer cases)
- `src/core/childcode.js` 6-digit child code with check digit
- `src/csv.js`           CSV builder (comma, dot decimals, ISO dates, DOB only if ticked)
- `src/storage.js`       records in the phone's own database (IndexedDB)
- `src/main.js`          screen logic
- `vite.config.js`       PWA settings: what is saved for offline use is listed in `workbox.globPatterns`
- `tests/`               known-answer cases and tests

## Safeguards built in
- A person confirms every record. Flagged values need an extra "I checked" tick.
- Implausible values are flagged with the reason ("Weight 84 kg is outside 1-25 kg...").
- Output wording: screening aid, not a diagnosis.
- Data stays on the phone. "Delete all" button. Synthetic data only for the demo.

## Known limits
- iPhone may clear a website's saved data after about a week without use. Export often.
- No PIN yet. No photo reading yet. Only the 0-24 month growth page.
- Placeholder limits in `zscore.js` (LIMITS) need a clinician's confirmation.
