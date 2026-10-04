# HONAI: questions judges are likely to ask

Short, honest answers. Where something is not proven, the answer says so.

**Text in `[UPDATE: ...]` brackets is to be filled in before submission.**

---

### 1. Is this only for malaria and nutrition?
**No by design, yes today.** HONAI is built as a reader plus a checker: it reads a handwritten record on the phone, a person confirms it, and it checks the values against a **reviewed guideline pack** that quotes its source. **Two packs are implemented and piloted:** child nutritional status (WHO growth standards, Indonesian categories) and malaria dosing (the Indonesian national pocketbook). Adding another disease needs a reviewed pack. For threshold-style rules (for example blood pressure categories) the repository has a small rule language that cannot run code, though it is not wired into the screen yet. For table-based dosing like malaria, a small checker module is also needed. Nothing here claims to cover other diseases today.

### 2. Which local language does it use?
**Bahasa Indonesia** is the default: the national language and the working language of Indonesian clinics, for every screen, warning and button. There is also an **English switch** (ID | EN button, or `?lang=en`) for reviewers and other countries. In English mode the guideline quotes stay in the original Indonesian text from the national pocketbook, labelled "original Indonesian text", the nutrition categories show the Indonesian term in brackets, and the CSV exports are identical in both languages.

### 3. How would it fare in a less-supported language?
**The reading does not depend on the spoken language.** The reader looks at boxes that hold digits and at Latin-script drug names, so a record written by a nurse who speaks any language is read the same way, provided it uses Latin script and digits. What does depend on language is the interface text. English was added as one dictionary of about 359 entries, applied when each screen is drawn, with tests that list any string left untranslated, so another language is writing, not engineering (and needs a translator's review). Voice prompts for low-literacy users are the next step, not built. What would fail: free-text diagnosis words in another language, or records in a non-Latin script (untested). The app does not guess them. It shows them as a picture and asks a person to choose.

### 4. Why not just a spreadsheet, an SMS form or a search?
A spreadsheet needs the record **typed in again**. That re-typing is the burden, and it is why paper records stay on paper. The AI step is exactly one thing: reading handwriting off the page on the phone. Everything after that (WHO tables, guideline comparison) is plain rules that a spreadsheet could hold, which is deliberate: reading is where AI adds value, and checking is where it must not be creative.

### 5. What if the AI reads a number wrong?
Each box is read four times (the page reading plus three crops) and the readings are voted. A value is shown as reliable only when at least three of four agree. When they split, no value is filled in. The candidates are shown and a person chooses. A person confirms every value with the handwriting beside it. Two further nets: weight and height are checked against age while the person confirms (6.4 kg at 24 months is blocked until they check the paper), and the dose check refuses to run on a weight it has flagged. In our tests `[UPDATE: x]` of `[UPDATE: y]` values were correct, no value read as reliable was wrong, and the one wrong value was flagged by the app.

### 6. Why not use a large language model or a vision-language model?
Three reasons. **Hallucination:** a model that writes text can write a wrong dose with confidence, and the brief itself asks us to avoid it. **Size and signal:** it must run on a phone, offline, from a download of about 50 MB, and large models do not. **Traceability:** every finding here quotes the page and sentence it rests on, and a person can check it in ten seconds.

### 7. Does it run on a device the user already has, offline, with small files?
Yes on all three, as tested. It is a web app (PWA) that installs on an ordinary phone browser. The one-time download (models plus runtime) is **49.6 MB**. On our test phone it became ready offline in **19 seconds** on a good connection, and ran in airplane mode. The photo-to-confirmation time was **7 seconds** on the second photo (measured on the form-v3 build). `[UPDATE: v4 timing, phone model, median and range over all pages]`.

### 8. How is patient privacy handled?
The name, family-head name, address, phone and BPJS number **stay on paper**. The reader sees them for a moment on the phone and discards that text right after the page is aligned, and a test fails if a planted fake name reaches the screen, storage or an export. Nothing is sent anywhere. Exports are two files with fixed column lists: a **link file** (record number and date of birth, for the clinic's own system, to stay in the clinic) and an **analysis file** (no record number, no birth date, visit month only). Honest gap: the photo itself stays in the phone's gallery until deleted. All data in this project is synthetic.

### 9. Is the guideline content correct?
Every table value and sentence was taken from the national pocketbook by script and quoted exactly. It is labelled **DRAFT** on screen until a clinician has checked all 44 lines of `docs/malaria-dose-verification.csv` against the PDF. `[UPDATE: reviewer name and date, if done]`. Page numbers were inferred from page markers and the publication year is a guess, both listed on that sheet.

### 10. Is this medical advice?
No. It compares what was written with the national table and says "matches", "differs", or "cannot check, ask a doctor". It never suggests a drug or a dose. A match is not proof that the dose is right for that child.

### 11. What is the evidence that it works?
Three levels, labelled. (a) **Logic:** more than 1,000 automated checks, including the WHO tables against an independent library. (b) **Synthetic photos (form v3):** 21 invented pages with handwriting-style fonts read by a different OCR engine, kept as regression evidence. (c) **Real phone, real browser model:** `[UPDATE: N]` invented-child pages written on a tablet and photographed from its screen, `[UPDATE: x of y]` values correct. None of it is real patients or real paper, and we say so. Time saved against typing has not been measured yet.

### 12. What about bias and handwriting variety?
Only `[UPDATE: number of writers]` writers so far, so accuracy for other handwriting is unknown. The model is a general pretrained one, not tuned on clinic handwriting. The app records how every value was obtained (read, chosen, edited, typed), which gives the correction data needed to improve it, and which shows where it fails for whom.

### 13. Why did you change the form so many times?
Because we measured. Version 1 had eight tiny boxes for the record number: on synthetic photos the digits were reliable only 45% of the time. Free-text prescriptions read worse than boxes. Version 4 uses boxes for numbers and a name box for each drug row, with a person choosing the drug. The real record number read reliably on 3 of 5 real pages, better than the synthetic test predicted, which is why we report both.

### 14. Could another setting reuse it?
Yes, in three layers. **Form template generator:** one description draws the PDF and writes the template the reader uses, so another country's form needs a description, not new reading code. **Guideline pack builder:** a source document becomes a JSON pack with exact quotes, and a pack without a citation for every line refuses to load. **Rule language:** for threshold rules, built and tested but not yet wired to the screen. The honest limit: a new disease with table-based dosing also needs a small checker module, and every pack needs clinician review in its own country.

### 15. What happens next?
1. A consented pilot with real clinic records, with a data-protection review.
2. A multi-writer test with measured typing time against photo time.
3. A barcode or QR sticker for the record number, which reads far better than handwriting.
4. WHO 2007 tables for nutritional status at ages 5 to 18.
5. A second guideline pack (a threshold-based one such as hypertension) to prove the "any disease" design, then other languages and voice.
6. Mapping the export to national health information systems.

### 16. Who is the user, and where does it sit in their day?
A nurse, doctor or community health worker who already writes the paper record. After the consultation, one photo and one confirmation replace re-typing. The nutritional status and dose check appear while the child is still there.
