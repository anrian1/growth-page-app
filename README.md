# HONAI: Health Information Bridge and Clinical Decision Support AI

An offline-first web app (PWA) for puskesmas. A health worker photographs a handwritten paper medical record; the app reads the numbers **on the phone**, shows each
number next to a picture of the handwriting for a person to confirm, then:

1. computes the child's **nutritional status** (WHO 2006 standards, Permenkes 2/2020 categories, 0–59 months),
2. offers an optional **malaria dose check**: the dose that was written is compared with the table in the national malaria pocketbook, and every finding shows its page, section and exact quote,
3. saves the record on the phone and exports a **CSV** that says how every value was obtained (read and confirmed, chosen from a candidate, corrected, or typed).

It does not diagnose, prescribe or generate advice. It works without internet after the first load. No server, no cloud, no patient data leaves the phone unless the user exports a CSV.

Built for the World Bank / Hack-Nation Small AI for Development hackathon 2026 (health track). **All forms and children in this repository are synthetic.**

## The flow
1. **Photo of the page** (camera or gallery; a photo of a tablet screen works too). The whole page must be visible.
2. The app finds the printed words (30 of them) to work out how the page is tilted, then cuts out the boxes: sex tick boxes (LK / PR), date of birth, the TGL date, and six vitals boxes (TD, HR, RR, T, TB, BB).
3. Each numeric box is read **four times** (the whole-page reading plus three crops at different sizes) and the readings are voted. Four agree: shown as reliable. A tie or a lone reading: no value is offered, the candidates are shown and a person chooses.
4. **Popup:** every box next to a picture of the handwriting. Date of birth and TGL give the age live. The sex comes from the tick boxes and is never guessed when both or neither are ticked.
5. **Result:** nutritional status (0–59 months), flags, and the malaria dose card. Children of 5–18 years get the dose card but not nutrition (stage 2, below).
6. **Save and export.** Records stay in IndexedDB on the phone.
Free-text areas (complaint, diagnosis, plan) are shown as pictures only. **The AI does not read them.**

## The medical record form (`public/forms/rekam-medis-contoh.pdf`, SYNTHETIC)
Based on the layout of a paper SOAP record (TGL, SUBJEKTIF, OBJEKTIF, ASESSEMEN, PLANNING, TT). Changes made for reading: Agama and Pekerjaan removed; LK/PR as tick boxes;
date of birth boxes; a wider TGL column with date boxes (tgl, bln, tahun); six labelled boxes in the Objektif column. The template (`src/templates/medical-record.js`) is generated from the
same description that draws the PDF (`scripts/make_form.py`), so the picture and the template cannot disagree. A different real form needs its own template.

## Age and dates (`src/recorddate.js`)
Age is the visit date (TGL) minus the date of birth, in completed months. The app refuses impossible dates (30 February), a visit before the birth, a visit date later than today on the phone,
and ages over 18 years, each with a reason. 0–59 months get nutrition; 5–18 years get the dose card only.

## Nutritional status (`src/core/zscore.js`)
WHO 2006 LMS tables. Under 24 months: length (lying) tables, weight-for-length. From 24 months: height (standing) tables, weight-for-height. Index names switch (PB/U to TB/U, BB/PB to BB/TB).
The category is taken from the score rounded to 2 decimals, the number shown on screen. **Stage 2 (5–18 years)** needs the WHO 2007 reference tables (height-for-age and BMI-for-age 5–19 years, weight-for-age 5–10 years) and the Permenkes 2/2020 category labels for that age; not installed.

## Malaria dose check (`src/malaria.js`, `public/guidelines/malaria-dose.json`)
Under the result, an optional card compares the antimalarial dose that was written with the guideline table for the child's weight (Buku Saku Tata Laksana Kasus Malaria).
- **Input:** test result, treatment type, plasmodium species, DHP formulation (tablet or dispersible), DHP tablets per day and days, primaquine tablets per day and days, or the artesunate dose in mg for severe malaria; for girls from 10 years, pregnancy and breastfeeding; for anyone, known G6PD deficiency. Amounts are picked from a list. No handwriting is read.
- **Output:** "matches the table", "differs from the table", "cannot check, ask a doctor", or "nothing to compare", then findings. Each finding shows the table row or sentence it rests on, with page, section and exact quote.
- **Compares:** DHP amount and days by weight band; primaquine amount, days by species, none for P. malariae and P. knowlesi, none under 6 months, none in pregnancy, none while breastfeeding an infant under 6 months, none with G6PD deficiency; artesunate mg/kg (3 under 20 kg, 2.4 above); a negative test with an ACT recorded; dispersible tablets below 5 kg and 6 months.
- **Fail-safes:** an uncertain weight stops the check; a weight outside the table is "cannot check"; exactly 20 kg is "not sure" because the guideline does not say; matching days alone is never reported as a verified dose; a missing primaquine is a note (it can be deliberate); a pack without a citation for every table and statement is refused whole.
- **Nutrition link:** BB/TB "Obesitas" adds the guideline's note to dose by ideal body weight (Catatan c).
- **Not covered:** artemether-lumefantrine, artesunate-pyronaridine, quinine, relapse dosing, the special G6PD dose (quoted, not calculated), dosing in pregnancy, diagnosis and follow-up, malnutrition, tablet strength in mg (not in the source file).
- **Authoring:** `npm run build-malaria-pack` builds the pack from `docs/source/Malaria_clean.md`: tables are parsed from the markdown, quoted sentences are copied exactly, and the script stops if a quote cannot be found.
  The pack is a **DRAFT** (`reviewedBy: null`) until a clinician has checked every line of `docs/malaria-dose-verification.csv` against the PDF. Page numbers are inferred from the page markers in the .md and need a spot check; the publication year (2023) is a guess.

## Evidence so far (all SYNTHETIC; `npm run evidence`)
21 invented children (`docs/case-sheet.json`; `npm run case-sheet`), written in handwriting-style fonts by three simulated writers on the form, then degraded like a photo of a tablet screen (tilt, perspective, glare, moiré-like banding, blur, noise, JPEG) at three difficulty levels. A real OCR engine (RapidOCR in Python; **not** the browser model) read them.
- **Alignment:** 21 of 21 sheets aligned (at least 29 of 30 labels used); box centres within 1.5% of a box width on average, 4.5% at worst; the true centre of all 273 boxes inside the rectangle that is cut out.
- **Reading, 273 boxes:** 245 right and shown as reliable, 18 right but flagged for a person to check, 9 no value (a person types it), **1 wrong and not flagged** (a lone "1" read as "7" by all three crops). Page reading alone: 214 right, 58 no value, 1 wrong.
- **Weakest boxes:** the small date boxes (day and month, single digits). Expect corrections there.
- **Sex tick boxes:** 21 of 21.
- **What this does not show:** real handwriting, real photos, the browser model, or real clinics. It shows the logic works and where it is weak. The real test is the pages written on a tablet and photographed with the phone (`docs/case-sheet-answer-key.csv` is the key).

## Dose and nutrition logic tests
- Calculator: 52 hand-built cases, 356 cross-checks for 24–59 months against an independent reference library (all 14 category labels covered but one), 33 category boundaries, age switch at 24 months, table limits.
- Dose check: 71 tests; tables checked against amounts typed by hand from the source, every weight-band boundary, a sweep of every band x species x formulation (prescribing exactly the table is never flagged), wrong doses, infants, pregnancy, G6PD, severe malaria, the refusal rules.
- Screen tests: the real page in a simulated browser with a fake camera and a fake OCR engine built on real OCR output (26 scenarios).
- Breaking one table amount, the band-boundary rule, the infant primaquine rule, the visit-before-birth check, the tick threshold, the 24-month switch or the sex boxes makes tests fail.

## Known limits
- **Not tested on a real phone** with the real browser OCR model and real handwriting. Do this before claiming any accuracy: `/ocr-spike.html`, then ten pages of your own (see below).
- Reading depends on the box layout of this form; a real form needs a template and its own check.
- The dose check compares what a person typed or picked. It cannot see a handwritten prescription.
- A dose that matches the table is not proof that the dose is right for that child.
- The malaria tables are a DRAFT until reviewed; the nutrition tables for 5–18 years are not installed.
- Plausible ranges for the vitals boxes (`src/templates/medical-record.js`) are placeholders for a clinician to confirm.
- iPhone Safari may clear stored data after about a week without use: export often.
- Size of the reading model: measure it from the build and put the number in the data card.

## Test with your own pages (the evidence that matters)
1. Print or open `public/forms/rekam-medis-contoh.pdf`; copy children from `docs/case-sheet-answer-key.csv` (or invent your own) into the form, one per page, different writers if possible.
2. Photograph each page with the phone (a tablet screen is fine: medium brightness, avoid glare).
3. For each page note: seconds from photo to popup, how many boxes had to be corrected, and whether a wrong value went through unflagged.
4. Compare with the time to type the same values. That comparison is what shows whether the AI step is worth having.

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
```
src/core/zscore.js            WHO LMS calculator, 0-59 months
src/core/who_lms.js           WHO tables (generated once)
src/templates/medical-record.js  the blank form as data (generated from scripts/make_form.py)
src/clinic.js                 page alignment (printed words -> camera transform) and box rectangles
src/readcell.js               per-box voting, ink detection, tick boxes
src/session.js                readRecordPage / readRecordFields
src/recorddate.js             dates and age checks
src/recordchecks.js           plain consistency checks on the vitals
src/malaria.js                dose pack validation and the comparison
src/views.js                  popup and result HTML (Bahasa Indonesia)
src/main.js                   screen logic
src/csv.js, storage.js        export, IndexedDB
public/guidelines/malaria-dose.json   the reviewed dose pack (DRAFT)
public/forms/rekam-medis-contoh.pdf   the synthetic form
docs/                         case sheet, answer key, verification sheet, source markdown, sample photo
scripts/                      pack builder, verification sheet, case sheet, form, evidence generators
tests/                        all tests; tests/fixtures holds real OCR output of the synthetic photos
```
Older modules (Buku KIA growth page, the clinic sheet, the generic guideline rule engine) stay in the repository with their tests but are no longer on the screen.
