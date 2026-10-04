# HONAI data card

**Status:** draft for submission, October 2026. Text in `[UPDATE: ...]` brackets is a figure or fact still to be filled in or confirmed by the author.

**Scope.** HONAI is designed for primary-care clinics in any country and, in principle, any disease: a handwritten record is read on the phone and checked against a reviewed guideline. The **pilot covers two things**: child nutritional status (WHO growth standards, Indonesian categories) and malaria dosing (the Indonesian national pocketbook). Indonesian data and guidelines are the context. Only these two are implemented.

**All patient data in this project is synthetic.** No real patient, no real medical record and no real photo of a patient record was used to build or test HONAI. The "children" are invented, and the test pages were written by the developer on a tablet and photographed from its screen.

---

## 1. Data that shows the problem and the gap

| Figure | Source | Year | Country | Note |
|---|---|---|---|---|
| An estimated 263 million malaria cases and 597,000 deaths worldwide, in 83 countries. About 95% of deaths were in the WHO African Region. WHO lists children under 5 among the groups at highest risk. | WHO, World malaria report 2024: https://www.who.int/teams/Global-Malaria-Programme/Reports/World-Malaria-Report-2024 | 2023 | Global | WHO estimate. |
| An estimated 22.3% of children under 5 worldwide were stunted. | UNICEF/WHO/World Bank Joint Child Malnutrition Estimates (2023 edition), as quoted in the Indonesian Ministry of Health's SKI 2023 nutrition factsheet: https://repository.badankebijakan.kemkes.go.id/5535/1/06%20factsheet%20Gizi%20SKI_bahasa.pdf | `[UPDATE: reference year of the 2023 edition]` | Global | Secondary quotation. |
| Malaria cases in Indonesia: 706,297 in 2025, up 30% from 543,965 in 2024. The ministry says part of the rise comes from more active case finding and better digital reporting (SISMAL). | Ministry of Health (Kemenkes), as reported by Metro TV: https://www.metrotvnews.com/read/KdZCAQ8r-indonesia-kejar-eliminasi-malaria-pada-2030 | 2025 | Indonesia | Press report of ministry data, not the primary table. |
| Stunting prevalence among children under 5 in Indonesia: 21.5% in 2023 (21.6% in 2022), about 1 in 5 children, against a national target of 14%. | Survei Kesehatan Indonesia (SKI) 2023, Kemenkes factsheet: https://repository.badankebijakan.kemkes.go.id/5535/1/06%20factsheet%20Gizi%20SKI_bahasa.pdf . Also Kompas: https://lestari.kompas.com/read/2024/05/09/170000786/10-provinsi-dengan-prevalensi-stunting-tertinggi-2023 | 2023 | Indonesia | National survey figure. |
| Health facilities in Indonesia were required to run electronic medical records by 31 December 2023 (Permenkes 24/2022). Small studies of puskesmas (community health centres) still describe double recording on paper and on screen, manual records kept because the local system fails, and network, training and infrastructure gaps. | Banjarsengon KIA clinic: https://sipora.polije.ac.id/46522/ . Ngadirojo: https://ojs.udb.ac.id/sikenas/article/view/3899 . Padang (72 respondents, 2024): https://www.doaj.org/article/aabe791e5a9a41a08d2c8689176748d5 | 2023 to 2025 | Indonesia | **Closest available evidence.** Small local studies, some unpublished student work. They show the pattern, not its size nationally. |
| `[UPDATE: any figure you hold on paper-only records or double data entry in Indonesian primary care, with source and year]` | | | | |

**The gap in one sentence:** the numbers that decide a child's weight-based dose and nutritional status are written by hand in a paper record, and in many clinics they are re-typed later, late, or never. HONAI reads the numbers where the paper is and checks them at the point of care.

---

## 2. Data we build with

| # | Dataset | What it is | Source | Licence | Size | Used for |
|---|---|---|---|---|---|---|
| 1 | WHO Child Growth Standards 2006 (LMS tables) | Reference tables for weight-for-age (0 to 60 months), length/height-for-age (0 to 60 months), weight-for-length (45 to 110 cm) and weight-for-height (65 to 120 cm), boys and girls | WHO Child Growth Standards, taken from the open-source Python package `pygrowup` 0.8.2 and converted once to `src/core/who_lms.js` | WHO tables are public reference data. `[UPDATE: confirm WHO's terms of use for redistribution, and the licence of pygrowup on its PyPI page. Neither was verified when this card was written.]` | 22 KB | Z-scores and nutritional categories for children 0 to 59 months |
| 2 | Indonesian anthropometric categories (Permenkes 2/2020) | Names and cut-offs (below -3, -2, +1, +2, +3 SD) for BB/U, PB/U or TB/U, BB/PB or BB/TB | Regulation of the Indonesian Minister of Health no. 2/2020 | Government regulation. `[UPDATE: confirm terms]` | A few lines of code in `src/core/zscore.js` | Category labels shown to the user. **Typed from secondary sources: check against the regulation attachment.** |
| 3 | Buku Saku Tata Laksana Kasus Malaria (Indonesian national malaria pocketbook) | Dose tables for DHP and primaquine by weight, primaquine days by species, artesunate mg per kg, the rules on primaquine in infants, pregnancy and G6PD deficiency | Kemenkes RI, Direktorat P2PM, with IDI, 2nd printing. PDF converted to markdown (`docs/source/Malaria_clean.md`) | Government publication. `[UPDATE: confirm reuse terms]` | Source text 49 KB. Built pack `public/guidelines/malaria-dose.json` 12 KB: 9 weight bands for tablets, 5 for dispersible tablets, 6 species, 12 quoted statements | The dose check. Every finding quotes the page, section and exact sentence or table row. **DRAFT until a clinician has checked all 44 lines of `docs/malaria-dose-verification.csv` against the PDF** (`reviewedBy` in the pack is empty until then). Page numbers were inferred from page markers in the converted file. The publication year (2023) is a guess from the text. |
| 4 | PaddleOCR PP-OCR text detection and recognition models (ONNX), run with ONNX Runtime Web through the `ppu-paddle-ocr` package | General-purpose pretrained OCR | PaddlePaddle / PaddleOCR project | PaddleOCR is Apache-2.0 (https://github.com/PaddlePaddle/PaddleOCR). ONNX Runtime is MIT. `[UPDATE: confirm the licence of the ppu-paddle-ocr npm package and of the exact model files shipped]` | Models plus runtime about 49.6 MB, downloaded once (measured on the build output) | Reading handwriting boxes on the phone, offline. **Not fine-tuned.** No clinic handwriting was used for training. |
| 5 | Synthetic forms and children | Four generations of a medical-record form (`scripts/make_form.py`), 21 invented children with invented 8-digit record numbers (`docs/case-sheet.json`) | Generated by scripts in this repository | Ours. `[UPDATE: add a LICENSE file to the repository]` | 31 KB (case sheet) | Test cases with a known answer key |
| 6 | Synthetic "photos of a tablet screen" | 21 images of the form v3 filled with handwriting-style fonts, with tilt, glare, screen-pattern banding, blur and JPEG noise, read by a **different** OCR engine (RapidOCR, Python) for evidence | Generated by `scripts/evidence/` | Fonts (Caveat, Kalam, Patrick Hand, Reenie Beanie, Nanum Pen Script, Homemade Apple) are open Google Fonts `[UPDATE: confirm each font's licence (SIL OFL expected)]`. Images themselves are ours. | About 6 MB, not committed | Regression evidence for form v3 only. **Synthetic, tidier than real handwriting.** |
| 8 | English interface dictionary (`src/i18n-en.js`) | 359 Indonesian-to-English entries for every screen text, warning and finding | Written by the developer | Ours | About 40 KB | English screens. **Nutrition categories keep the Indonesian term in brackets so they stay traceable to Permenkes 2/2020. Not a translation of the guideline quotes.** |
| 7 | Test pages written on a tablet | Invented children copied from the case sheet onto the form with a stylus, photographed from the tablet screen with a phone, read by the app in the browser | The developer `[UPDATE: number of pages, number of distinct writers, dates]` | Ours. Contains no real patient data | `[UPDATE: pages]` pages, `[UPDATE: values]` values | The only evidence from the real browser model on a real phone camera. |

**Reproduce:** `npm test` (more than 1,000 automated checks), `npm run build-malaria-pack`, `npm run case-sheet`. The WHO tables are checked against an independent reference library (356 cases for 24 to 59 months, 52 hand-built cases, all category boundaries).

---

## 3. What the data does NOT cover (this is scored)

- **Only two disease areas.** Child nutritional status and malaria dosing are implemented. No other disease is covered. A hypertension guideline text was prepared as a possible next pack but is not built, and no data for it was collected.
- **One country's guidelines.** The malaria dose tables and nutritional categories are Indonesia's. Other countries' national guidelines differ (regimens, categories, tablet strengths) and would need their own reviewed pack.
- **No real patient data and no real clinic paper.** All children are invented. All handwriting is the developer's own on a tablet, plus synthetic fonts. Paper texture, ink bleed, curled pages, shadows, stamps and pen colours are untested.
- **Few writers.** `[UPDATE: number of writers]`. Handwriting varies by person, age, training and country. A "1" that looks like a slash, a "7" that looks like a "1" and a "0" with a closing stroke were all seen and are not rare.
- **Only one form layout.** The reader works on a form it has a template for. A different real form needs its own template and its own check.
- **Children 0 to 59 months only for nutrition.** Ages 5 to 18 years get the dose check but no nutritional status. The WHO 2007 reference tables for 5 to 19 years are not installed. BMI-for-age, mid-upper-arm circumference, head circumference and preterm growth are not covered.
- **Only the national first-line malaria regimen is checked:** DHP (tablets and dispersible) and primaquine, plus the artesunate dose. Not covered: artemether-lumefantrine, artesunate-pyronaridine, quinine, relapse dosing (primaquine 0.5 mg/kg), the special G6PD dose (it is quoted but not calculated), dosing in pregnancy, other drugs, diagnosis and follow-up.
- **No malnutrition adjustment.** The pocketbook says nothing about dosing in severe malnutrition. The app only notes the guideline's rule for obese children (use ideal weight).
- **The dose check compares what was written with a table. A match is not proof that the dose is right for that child.** Illness severity, other drugs, allergies and G6PD status are outside the table.
- **Two interface languages, no speech.** The screens are in Bahasa Indonesia (default) and English. The English wording was written by the developer and `[UPDATE: reviewed by a doctor, name and date]` (`docs/EN_MEDICAL_REVIEW.md`). Guideline quotes are shown only in the original Indonesian. No other language and no speech. The reader handles digits and Latin-script drug names, which do not depend on the spoken language. Records in non-Latin scripts are untested.
- **Not tuned on any clinic's handwriting.** The OCR model is a general pretrained model. The app records how every value was obtained (read and confirmed, chosen, edited, typed), which is the data needed to improve it later.
- **Timing was measured on one phone and one network.** `[UPDATE: phone model, Android or iOS version, browser]`.

---

## 4. Privacy, consent and bias

- **Nothing leaves the phone** unless the user exports a CSV. There is no server and no cloud.
- **Name, family-head name, address, phone and BPJS number stay on paper.** The page reader sees the whole page for a moment on the phone. Right after the page is aligned, every piece of text inside those areas is discarded. A test plants fake names there and fails if they appear on any screen, in any saved record or in either export file.
- **Two export files with fixed column lists** (a test fails if a column is added without changing the list). The **link file** has the medical record number, date of birth and exact visit date, for the clinic's own system. It is personal health data and stays inside the clinic. The **analysis file** has no record number and no date of birth, shows the visit month only and age in months, and is the one to share with evaluators.
- **Record number plus date of birth is pseudonymous, not anonymous.** Indonesia's Personal Data Protection law (UU 27/2022) treats health data as specific personal data, and other countries have their own rules. `[UPDATE: legal or IT confirmation of what applies to a deployment]`.
- **Known privacy gap:** the photograph itself stays in the phone's gallery unless deleted. An in-app camera or a fold-over flap that hides the name block would fix this and is on the roadmap.
- **Consent:** no real patients took part, so no consent was needed for this prototype. A pilot with real records needs consent, a data-protection review and the health authority's approval first.
- **Bias:** read accuracy will differ by handwriting style. The app never shows a value as reliable unless several independent readings agree, and it asks a person whenever they do not.

---

## 5. Where each number in the evidence comes from

| Claim | Where it comes from |
|---|---|
| Z-scores and categories | 52 hand-built cases, 356 cross-checks against an independent library, 33 boundary cases (`tests/run_tests.mjs`) |
| Dose check logic | 75 tests on the real pack, including every weight-band boundary and a sweep of every band by species by formulation (`tests/malaria_tests.mjs`) |
| Reading on real photos | Exported CSV files from the phone, compared with the answer key `docs/case-sheet-answer-key-v4.csv` |
| Reading on synthetic photos (form v3 only) | `npm run evidence` was archived; numbers are in the README under "Evidence so far" |
