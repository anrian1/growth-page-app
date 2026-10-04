# HONAI video script (target 4:15, limit 5:00)

The brief requires five parts: **problem statement, AI capabilities and guardrails, tool demo, the gap and where it sits in the user's day (with tech stack), your take.** This script has all five, in order, with timings.

**Narration language:** English (judges). **Screens:** record the demo in **English mode** (open the app with `?lang=en`), so the screens match your voice. Show the **ID | EN** button once, early in the demo, to prove the default is Indonesian for clinic staff. **Voice:** short, concrete, no hype. Read it aloud once and cut anything you stumble on.

**Message to land:** HONAI is a tool for any clinic and, by design, any disease. It is **piloted on two things, child nutrition and malaria dosing, using Indonesian data and guidelines.** Say "pilot" and "Indonesia", never imply it already covers every disease.

Text in `[UPDATE: ...]` must be replaced with your final numbers before recording.

---

## 0:00 to 0:25: Problem statement (part 1)

**Visual:** a handwritten paper record on a desk, then the phone.

**Narration:**
"In 2023, malaria caused an estimated 597,000 deaths, most of them children under five. A child's dose depends on weight. And in many clinics that weight, and the child's nutritional status, are written by hand on paper. In Indonesia, there were more than 700,000 malaria cases in 2025.

Because of HONAI, a primary-care nurse or doctor will turn that handwritten record into a checked nutritional status and a guideline dose check, in seconds, at the bedside, with no signal, that they would otherwise leave on paper or re-type late. We know because on `[UPDATE: N]` test pages the app read `[UPDATE: x of y]` values correctly and flagged the one it could not be sure of."

**Caption:** "Sources: WHO World malaria report 2024; Kemenkes via Metro TV, 2026. Test pages are invented children."

---

## 0:25 to 1:05: Why AI, and why not a spreadsheet (part 2)

**Visual:** split screen. Left: someone typing a paper record into a spreadsheet. Right: the phone photographing the page.

**Narration:**
"A spreadsheet can store numbers. It cannot read them off a paper page. That is the AI step, and it is the only one: a small pretrained OCR model, about 50 megabytes, running in the phone's browser. No server. No cloud. It works in airplane mode.

Everything after reading is plain, checkable rules. The nutrition scores use the WHO tables. The dose check compares what was written with the national malaria pocketbook, and every finding quotes the page and the sentence. There is no generated text, so nothing is made up.

The guardrails: the app never fills in a number it is not sure of. Each box is read four times and the readings are voted. If they disagree, it shows the candidates and asks a person. A person confirms every value, with the handwriting right beside the reading. And when the data is not enough, the dose check says: not sure, ask a person."

**Captions:** "AI = reading only" / "Rules = WHO tables + national pocketbook, quoted" / "Not sure → ask a person".

---

## 1:05 to 2:50: Tool demo, end to end (part 3)

**Visual:** screen recording of the phone. Turn on airplane mode first and show the icon. Use page C06 (clean) and then C09 (the warning). Keep the cursor slow.

**Narration, step by step:**
1. "Airplane mode is on. I open HONAI. For clinic staff it starts in Bahasa Indonesia. One tap, and it is English. The banner says it is ready offline." *(show the ID | EN button, tap EN, show the banner)*
2. "I photograph the record. About `[UPDATE: seconds]` seconds later the confirmation screen opens." *(photo, popup)*
3. "Every box sits next to a picture of the handwriting. Green means four readings agree. Yellow means check it. The record number is the key to other systems, so I confirm it digit by digit." *(MRN, dates, vitals)*
4. "The prescription is five rows. The app suggests which drug each row is. I confirm, or choose. A row it cannot recognise is never guessed." *(row dropdowns)*
5. "I tick that I compared everything with the paper. Now the result." *(Konfirmasi)*
6. "Nutritional status from the WHO standards. And the dose check: this dose is double the table for 9.3 kilograms, and DHP was written twice a day. The page, the section, the exact sentence." *(C06 result, quote)*
7. "Here is a different page where the weight was misread. The app notices that 6.4 kilograms does not fit a 2-year-old and will not let me confirm until I check the paper." *(C09 warning)*
8. "I save. Two export files. The link file has the record number and birth date, and stays in the clinic. The analysis file has neither, and can be shared. The patient's name never leaves the paper." *(export, show headers)*

**Captions:** "Offline", "Human confirms", "Quote: pocketbook p.11", "Name stays on paper".

---

## 2:50 to 3:30: The gap, the user's day, and the tech stack (part 4)

**Visual:** a simple timeline: consultation, write on paper, photograph, confirm, save.

**Narration:**
"It sits in the consultation. The nurse already writes the record. After the visit, one photo replaces the retyping. At the end of the day she exports the file, and the data reaches the programme without a second data entry.

Nutrition and malaria are the pilot. The same pipeline, the same confirm step and the same not-sure rule are built so another disease guideline can be added as a reviewed pack. Today, two are implemented.

Under the hood: a web app that installs on any phone. PaddleOCR models run with ONNX Runtime Web, with a 49.6 megabyte one-time download. WHO growth tables, and a JSON guideline pack built from the pocketbook with the quotes copied exactly. Records stay in the phone's own storage."

**Caption:** "PWA · PaddleOCR + ONNX Runtime Web · WHO LMS tables · JSON guideline pack · IndexedDB".

---

## 3:30 to 3:55: Evidence and limits, honestly

**Visual:** one slide with the numbers.

**Narration:**
"What we know. On `[UPDATE: N]` pages written by hand on a tablet and photographed with a phone: `[UPDATE: x of y]` values were right, and every wrong or doubtful one was flagged. The dose check never said 'matches' when it should not.

What we do not know. These are invented children, written by `[UPDATE: number of writers]` writer. Not real patients, not real paper, not many handwritings. Only one country's guidelines, and only two diseases. The malaria tables are a draft until a second doctor checks them. We say that on the screen."

**Caption:** "Synthetic data. Draft guideline pack. Pilot with consent comes next."

---

## 3:55 to 4:15: Your take on localizing AI development (part 5)

**Draft in your voice. Replace it with your own sentence if you prefer.**

"Localizing AI is not translating an app. It is fitting the tool to the **paper** that already exists. To the **phone** in the pocket. To the **signal** that is not there. To the **guideline** the country already approved. And leaving the **decision** with the person who knows the child.

A small model that works offline and says 'not sure' beats a big model that is always sure."

---

## Recording checklist

- [ ] Phone in airplane mode, battery above 50%, notifications off
- [ ] Use only invented children. No real name, address or phone anywhere on screen
- [ ] Nothing on screen that names a region you do not want to mention (browser tabs, bookmarks, file names, the map or notifications)
- [ ] Start the recording in Indonesian, tap EN once on camera (the page reloads), then continue in English
- [ ] Screen recording at the phone's normal resolution, with sound off. Record the voice-over separately and lay it on top
- [ ] Show the page photo only of the invented page (the tablet showing the form)
- [ ] Say "pilot" and "Indonesian guidelines". Do not say it covers all diseases today
- [ ] Total length between 3:45 and 4:45. The brief allows 2 to 5 minutes
- [ ] English captions only for the callouts (the screens are already English)
- [ ] Export as MP4, upload as unlisted, and test the link in a private window
- [ ] Put the link, the repository link and the demo link in the submission form with the referral code
