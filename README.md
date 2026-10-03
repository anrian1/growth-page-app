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
After reading, it maps every piece to a column and month (`src/mapping.js`), using the printed "Ideal"/"Aktual" words and month numbers as position markers, and straightens tilted photos. It can then read one row (one sex, one month) the way the app will, with a picture of each cell next to the reading so a person can check by eye.
Before the first build, run once:

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
- `src/mapping.js`       pieces of text + positions -> cells (column, month); `readRow` reads one row and flags anything odd
- `src/ocr-view.js`      builds the tables shown on the test page
- `src/ocr-spike.js`     the OCR test page logic (`ocr-spike.html`)
- `tests/fixtures/`      real OCR output from the mock page, used to test the mapping
- `scripts/setup-ocr.mjs` prepares the OCR files for offline use
- `vite.config.js`       PWA settings: what is saved for offline use is listed in `workbox.globPatterns`
- `tests/`               known-answer cases and tests

## Safeguards built in
- A person confirms every record. Flagged values need an extra "I checked" tick.
- Implausible values are flagged with the reason ("Weight 84 kg is outside 1-25 kg...").
- Output wording: screening aid, not a diagnosis.
- Data stays on the phone. "Delete all" button. Synthetic data only for the demo.

## Reading the page twice
The test page reads the photo at two sizes and compares them (`mergeReadings` in `src/mapping.js`). A cell is accepted only when both readings agree. If they differ, the cell is marked "check" with no value, so a wrong number cannot pass just because one reading was right.
Tested on two real runs of the same page (PC and phone): single readings had 1 and 3 wrong-but-unflagged values; merged, 1 remains (a 5.0 that both runs read as 5.6). Comparing readings cannot catch a mistake that every reading makes, so a person still checks the two numbers for the chosen row.

## Tilted photos
The mapping straightens the page tilt using the printed header line, and follows each printed Ideal column down the page, because a photo taken at an angle makes columns lean outwards towards the bottom (seen on the real phone photo; before this fix, two printed numbers in the last rows were mistaken for handwriting). It corrects for people writing a little low in each cell, and refuses pages tilted more than about 10 degrees.

## Mapping results on the real mock page (26 handwritten values, two pens, both sexes filled)
- PC run: 20 read exactly right. 3 wrong but flagged for a person. 2 not read, reported as "ink found, could not read". 1 wrong and NOT flagged (a 5.0 read as 5.6).
- Phone run (different image size): 16 exactly right, 6 flagged, 1 not read, 3 wrong and NOT flagged (4.9 read as 9.9, 57.5 as 59.5, 5.0 as 5.6). Reading quality changes with image size and the pen, which is why two readings are compared.
- No printed Ideal number was ever mistaken for handwriting.
- A person must always look at the two values for the chosen row. The silent error above is why.

## Known limits
- iPhone may clear a website's saved data after about a week without use. Export often.
- No PIN yet. Photo reading is only a test page so far (not tested on a phone yet). Only the 0-24 month growth page.
- OCR model files come from third-party hosting (Hugging Face, GitHub mirror) of PaddleOCR models. Check their licences before redistributing.
- Placeholder limits in `zscore.js` (LIMITS) need a clinician's confirmation.
