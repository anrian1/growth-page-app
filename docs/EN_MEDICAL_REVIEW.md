# English wording review (for a doctor)

The English screens were written by the developer, not by a clinician. **Nothing here changes a number or a rule**: the checks run on the Indonesian guideline pack either way. Only the wording shown to an English reader changes.

**How to review (about 20 minutes):** open the app with `?lang=en`, walk one page through (photo, popup, result, dose card), then read the tables below. Write "OK" or your correction in the last column and send me the file. Corrections go into `src/i18n-en.js` (one line each).

**Choices already made (change any):**
1. Nutrition categories show the English term with the Indonesian term in brackets, for example "Severely wasted (Gizi buruk)", so a reader can trace them to Permenkes 2/2020. The English terms follow the WHO wording (severely wasted, wasted, stunted, severely stunted, underweight, overweight, obese). *Check them against the annex.*
2. "Gizi buruk" and "Gizi kurang" are shown as **wasted** categories because they are the BB/PB and BB/TB (weight-for-length and weight-for-height) categories. Say so if you would rather show "severe acute malnutrition" and "moderate acute malnutrition".
3. The guideline quotes are **not** translated. They are shown in the original Indonesian and labelled "original Indonesian text".
4. The CSV exports are identical in both languages (category terms stay Indonesian).

## A. Nutrition categories (check against the English wording in the Permenkes 2/2020 annex)

| Indonesian (source) | English (on screen) | OK or correction |
|---|---|---|
| Berat badan sangat kurang | Severely underweight (Berat badan sangat kurang) | |
| Berat badan kurang | Underweight (Berat badan kurang) | |
| Berat badan normal | Normal weight (Berat badan normal) | |
| Risiko berat badan lebih | Possible risk of overweight (Risiko berat badan lebih) | |
| Sangat pendek | Severely stunted (Sangat pendek) | |
| Pendek | Stunted (Pendek) | |
| Tinggi | Tall (Tinggi) | |
| Gizi buruk | Severely wasted (Gizi buruk) | |
| Gizi kurang | Wasted (Gizi kurang) | |
| Gizi baik | Normal (Gizi baik) | |
| Berisiko gizi lebih | Possible risk of overweight (Berisiko gizi lebih) | |
| Gizi lebih | Overweight (Gizi lebih) | |
| Obesitas | Obese (Obesitas) | |

## B. Dose check: statuses and the "not a decision" lines

| Indonesian (source) | English (on screen) | OK or correction |
|---|---|---|
| Sesuai dengan tabel pedoman untuk jumlah yang dibandingkan. | Matches the guideline table for the amounts compared. | |
| Berbeda dari tabel pedoman. Periksa temuan di bawah. | Differs from the guideline table. Check the findings below. | |
| Tidak dapat diperiksa. Tidak yakin: tanyakan ke dokter. | Cannot be checked. Not sure: ask a doctor. | |
| Belum ada jumlah yang ditulis untuk dibandingkan. | No amount has been written to compare yet. | |
| Bukan keputusan klinis. Dokter yang memutuskan. | Not a clinical decision. The doctor decides. | |
| Ini alat bantu skrining, bukan diagnosis. Petugas yang memutuskan. | This is a screening aid, not a diagnosis. The health worker decides. | |
| DRAF: tabel belum ditinjau dokter. | DRAFT: the table has not been reviewed by a doctor. | |

## C. Dose check: findings (these are read by the person who gives the drug)

| Indonesian (source) | English (on screen) | OK or correction |
|---|---|---|
| Primakuin | Primaquine | |
| DHP ditulis {}x sehari; pedoman: DHP sekali sehari | DHP written {}x a day; guideline: DHP once a day | |
| DHP, tablet per hari | DHP, tablets per day | |
| DHP, lama (hari) | DHP, duration (days) | |
| DHP, kali per hari (biasanya 1) | DHP, times per day (usually 1) | |
| Primakuin, tablet per hari | Primaquine, tablets per day | |
| Primakuin, lama (hari) | Primaquine, duration (days) | |
| Defisiensi G6PD | G6PD deficiency | |
| Dosis primakuin khusus defisiensi G6PD (hanya dikutip, tidak dihitung) | Special primaquine dose for G6PD deficiency (quoted only, not calculated) | |
| Dosis obat pada ibu hamil dan ibu menyusui (hanya peringatan primakuin) | Drug doses in pregnant and breastfeeding women (primaquine warning only) | |
| Jenis plasmodium belum dipilih. | The Plasmodium type has not been chosen. | |
| Berat {} kg tidak ada di tabel. | Weight {} kg is not in the table. | |
| Tabel DHP dispersibel hanya mencakup berat 5 sampai kurang dari 36 kg. Berat {} kg di luar tabel. | The dispersible DHP table only covers weights from 5 to less than 36 kg. Weight {} kg is outside the table. | |
| Berat badan belum ada, jadi dosis tidak dapat diperiksa. | Weight is missing, so the dose cannot be checked. | |
| Berat badan masih ditandai tidak pasti. Periksa dulu; dosis tidak dihitung dari angka yang belum pasti. | The weight is still marked uncertain. Check it first; the dose is not calculated from an uncertain number. | |
| Hasil pemeriksaan darah malaria dicatat negatif. Pedoman: ACT hanya diberikan bila hasil positif. | The malaria blood test is recorded as negative. Guideline: ACT is only given when the result is positive. | |
| Hasil pemeriksaan darah malaria belum dicatat. Pedoman: ACT hanya diberikan bila hasil positif. | The malaria blood test result is not recorded. Guideline: ACT is only given when the result is positive. | |
| Malaria berat: artesunat intravena (atau intramuskular bila tidak memungkinkan). | Severe malaria: intravenous artesunate (or intramuscular if not possible). | |
| Pedoman memberi 3 mg/kgBB untuk anak <20 kg dan 2,4 mg/kgBB untuk >20 kg, dan tidak menetapkan berat tepat 20 kg. Tidak dapat dipastikan. Tanyakan ke dokter. | The guideline gives 3 mg/kg for children <20 kg and 2.4 mg/kg for >20 kg, and does not set exactly 20 kg. Cannot be determined. Ask a doctor. | |
| Dosis awal menurut pedoman untuk {} kg: {} mg/kgBB x {} = {} mg. | Starting dose per the guideline for {} kg: {} mg/kg x {} = {} mg. | |
| Dosis artesunat dicatat {} mg; pedoman {} mg (selisih {} mg, {}%). | Artesunate dose recorded {} mg; guideline {} mg (difference {} mg, {}%). | |
| Dosis artesunat belum diisi, jadi belum ada yang dibandingkan. | The artesunate dose is not filled in, so there is nothing to compare yet. | |
| DHP (tablet/hari) | DHP (tablets/day) | |
| DHP: tabel untuk berat {} kg (kolom {}) = {} tablet per hari; dicatat {}. | DHP: table for weight {} kg (column {}) = {} tablets per day; recorded {}. | |
| DHP belum diisi. Pedoman untuk {} kg: {} tablet per hari selama {} hari. | DHP is not filled in. Guideline for {} kg: {} tablets per day for {} days. | |
| DHP (hari) | DHP (days) | |
| Lama DHP dicatat {} hari; pedoman {} hari. | DHP duration recorded {} days; guideline {} days. | |
| DHP ditulis {} kali per hari. Pedoman: DHP diberikan sekali sehari (dosis pada H0, H1 dan H2). | DHP written {} times per day. Guideline: DHP is given once a day (doses on D0, D1 and D2). | |
| DHP dispersibel terbatas untuk bayi usia 6 bulan ke atas atau berat 5 kg atau lebih; anak ini kurang dari keduanya. | Dispersible DHP is limited to infants aged 6 months and above or weighing 5 kg or more; this child is below both. | |
| Primakuin dicatat untuk bayi di bawah 6 bulan. Pedoman: primakuin tidak diberikan pada bayi <6 bulan. | Primaquine recorded for an infant under 6 months. Guideline: primaquine is not given to infants <6 months. | |
| Primakuin dicatat untuk {}. Pedoman: tidak diberikan primakuin untuk jenis ini. | Primaquine recorded for {}. Guideline: primaquine is not given for this type. | |
| Tabel tidak memberi dosis primakuin untuk berat {} kg (kolom {}), tetapi dicatat {} tablet. | The table gives no primaquine dose for weight {} kg (column {}), but {} tablets were recorded. | |
| Primakuin (tablet/hari) | Primaquine (tablets/day) | |
| Primakuin: tabel untuk berat {} kg (kolom {}) = {} tablet per hari; dicatat {}. | Primaquine: table for weight {} kg (column {}) = {} tablets per day; recorded {}. | |
| Primakuin (hari) | Primaquine (days) | |
| Lama primakuin dicatat {} hari; pedoman untuk {}: {} hari. | Primaquine duration recorded {} days; guideline for {}: {} days. | |
| Primakuin tidak dicatat. Pedoman untuk {}: {} tablet per hari selama {} hari, kecuali ada kontraindikasi (mis. G6PD). | Primaquine is not recorded. Guideline for {}: {} tablets per day for {} days, unless there is a contraindication (e.g. G6PD). | |
| Primakuin dicatat untuk pasien hamil. Pedoman: tidak diberikan primakuin pada ibu hamil. | Primaquine recorded for a pregnant patient. Guideline: primaquine is not given to pregnant women. | |
| Primakuin dicatat untuk ibu yang menyusui bayi di bawah 6 bulan. Pedoman: tidak diberikan primakuin pada kelompok ini. | Primaquine recorded for a mother breastfeeding an infant under 6 months. Guideline: primaquine is not given to this group. | |
| Defisiensi G6PD dicatat. Pedoman: tidak diberikan primakuin pada penderita defisiensi G6PD (dosis standar tabel tidak berlaku). | G6PD deficiency recorded. Guideline: primaquine is not given to patients with G6PD deficiency (the standard table dose does not apply). | |
| Untuk defisiensi G6PD pedoman menyebut dosis khusus berikut. Aplikasi ini tidak menghitungnya; tanyakan ke dokter. | For G6PD deficiency the guideline states the special dose below. This app does not calculate it; ask a doctor. | |
| Umur {} bulan tidak sesuai kolom umur tabel ({}) untuk berat {} kg. Pedoman: dosis berdasarkan berat badan. | Age {} months does not match the age column of the table ({}) for weight {} kg. Guideline: dose by body weight. | |
| Status gizi BB/PB: obesitas. Pedoman: untuk anak dengan obesitas gunakan dosis berdasarkan berat badan ideal. Pemeriksaan ini memakai berat badan yang tercatat. | Nutritional status BB/PB: obese. Guideline: for children with obesity use the dose based on ideal body weight. This check uses the recorded weight. | |
| Obat antimalaria tidak boleh diminum dalam keadaan perut kosong. | Antimalarial drugs must not be taken on an empty stomach. | |

## D. Nutrition and vital-sign warnings

| Indonesian (source) | English (on screen) | OK or correction |
|---|---|---|
| Berat {} kg dan tinggi {} cm tidak sesuai untuk umur {}. | Weight {} kg and height {} cm do not fit age {}. | |
| Berat dan tinggi tampak tidak sesuai untuk umur ini. Periksa di kertas dan ubah, atau centang "Nilai ini memang benar". | Weight and height look wrong for this age. Check the paper and change them, or tick "These values are correct". | |
| TD belum lengkap: sistolik dan diastolik keduanya diperlukan. | BP is incomplete: both systolic and diastolic are needed. | |
| Sistolik harus lebih besar dari diastolik. Periksa kedua angka di foto. | Systolic must be higher than diastolic. Check both numbers in the photo. | |
| {} {} di luar rentang yang masuk akal ({}–{}). Periksa angka di foto. | {} {} is outside the plausible range ({}–{}). Check the number in the photo. | |
| Jenis kelamin belum diisi: skor tidak dapat dihitung. | Sex is not filled in: scores cannot be calculated. | |
| Status gizi dihitung untuk umur 0–{} bulan (tahap 1). Umur {} bulan di luar rentang. | Nutritional status is calculated for ages 0–{} months (stage 1). Age {} months is outside the range. | |
| Status gizi dihitung untuk umur 0–{} bulan (tahap 1). Umur ini di luar rentang. | Nutritional status is calculated for ages 0–{} months (stage 1). This age is outside the range. | |
| Berat {} kg di luar rentang {}-{} kg. Periksa salah satuan atau koma. | Weight {} kg is outside the range {}-{} kg. Check the unit or the decimal comma. | |
| Tinggi {} cm di luar rentang {}-{} cm. Periksa salah satuan atau koma. | Height {} cm is outside the range {}-{} cm. Check the unit or the decimal comma. | |
| Panjang {} cm di luar rentang {}-{} cm. Periksa salah satuan atau koma. | Length {} cm is outside the range {}-{} cm. Check the unit or the decimal comma. | |
| Skor {} {} di luar {} sampai {}: kemungkinan salah baca atau salah ketik. | Score {} {} is outside {} to {}: probably misread or mistyped. | |
| Umur 24 bulan ke atas: tabel tinggi badan berdiri. | Age 24 months and above: the standing-height table. | |
| Di bawah 24 bulan: tabel panjang badan berbaring. | Under 24 months: the lying-length table. | |
| Kategori memakai skor 2 desimal yang tampil. | Categories use the 2-decimal score shown. BB/U = weight-for-age, PB/U and TB/U = length- and height-for-age, BB/PB and BB/TB = weight-for-length and weight-for-height. | |
| Untuk umur 5–18 tahun, tabel WHO 2007 belum dipasang (tahap berikutnya). Status gizi tidak dihitung. Pemeriksaan dosis tetap tersedia. | For ages 5–18 years, the WHO 2007 tables are not installed yet (next stage). Nutritional status is not calculated. The dose check is still available. | |

## E. Medical terms on the dose card

| Indonesian (source) | English (on screen) | OK or correction |
|---|---|---|
| Jenis pengobatan | Treatment type | |
| tanpa komplikasi (DHP + primakuin) | uncomplicated (DHP + primaquine) | |
| malaria berat (artesunat injeksi) | severe malaria (artesunate injection) | |
| Sediaan DHP | DHP formulation | |
| tablet dispersibel (anak) | dispersible tablet (children) | |
| Kehamilan dan menyusui | Pregnancy and breastfeeding | |
| tidak hamil, tidak menyusui bayi <6 bulan | not pregnant, not breastfeeding an infant <6 months | |
| menyusui bayi <6 bulan | breastfeeding an infant <6 months | |
| Primakuin | Primaquine | |
| Artesunat | Artesunate | |
| Campuran P. falciparum + P. vivax/ovale | Mixed P. falciparum + P. vivax/ovale | |

**Interface words** (buttons, labels, headings) are in the same dictionary. Skim them in the app; they carry no clinical meaning.

**Reviewed by:** `[UPDATE: name, date]`
