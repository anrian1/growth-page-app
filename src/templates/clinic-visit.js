// The "blank page" for the synthetic clinic visit sheet (public/forms/mock-clinic-visit-sheet.pdf), written down as data.
// GENERATED from the same description that draws the sheet, so the picture and this template cannot disagree.
// Coordinates are PDF points, origin at the top-left of the A4 page.
// SYNTHETIC: a form designed for testing, not an official clinic form. Real clinic forms need their own template.
// Ranges are placeholders for a clinician to confirm (UPDATE ME).
export default {
 "id": "mock-clinic-visit-v1",
 "title": "CATATAN KUNJUNGAN KLINIK",
 "synthetic": true,
 "page": {
  "w": 595.28,
  "h": 841.89
 },
 "labels": [
  {
   "text": "CATATAN KUNJUNGAN KLINIK",
   "x": 161.66,
   "y": 51.96,
   "w": 271.96,
   "h": 17.1
  },
  {
   "text": "CONTOH SINTETIS UNTUK UJI COBA - bukan formulir resmi",
   "x": 173.12,
   "y": 76.98,
   "w": 249.03,
   "h": 8.55
  },
  {
   "text": "Tanggal",
   "x": 40,
   "y": 110.98,
   "w": 32.52,
   "h": 8.55
  },
  {
   "text": "Kode pasien",
   "x": 165,
   "y": 110.98,
   "w": 50.03,
   "h": 8.55
  },
  {
   "text": "Jenis kelamin (L/P)",
   "x": 310,
   "y": 110.98,
   "w": 76.52,
   "h": 8.55
  },
  {
   "text": "Umur (tahun)",
   "x": 415,
   "y": 110.98,
   "w": 53.01,
   "h": 8.55
  },
  {
   "text": "TANDA VITAL",
   "x": 40,
   "y": 177.42,
   "w": 73.33,
   "h": 10.45
  },
  {
   "text": "Tekanan darah (mmHg)",
   "x": 40,
   "y": 204.2,
   "w": 106.14,
   "h": 9.5
  },
  {
   "text": "Sistolik",
   "x": 40,
   "y": 221.76,
   "w": 25.34,
   "h": 7.6
  },
  {
   "text": "Diastolik",
   "x": 150,
   "y": 221.76,
   "w": 30.22,
   "h": 7.6
  },
  {
   "text": "Nadi (x/menit)",
   "x": 300,
   "y": 204.2,
   "w": 62.23,
   "h": 9.5
  },
  {
   "text": "Suhu (C)",
   "x": 420,
   "y": 204.2,
   "w": 40.01,
   "h": 9.5
  },
  {
   "text": "Berat badan (kg)",
   "x": 40,
   "y": 294.2,
   "w": 74.48,
   "h": 9.5
  },
  {
   "text": "Tinggi badan (cm)",
   "x": 150,
   "y": 294.2,
   "w": 80.58,
   "h": 9.5
  },
  {
   "text": "KELUHAN UTAMA",
   "x": 40,
   "y": 369.42,
   "w": 96.54,
   "h": 10.45
  },
  {
   "text": "DIAGNOSIS",
   "x": 40,
   "y": 453.42,
   "w": 61.73,
   "h": 10.45
  },
  {
   "text": "TERAPI / OBAT",
   "x": 40,
   "y": 537.42,
   "w": 80.67,
   "h": 10.45
  },
  {
   "text": "Nama obat",
   "x": 44,
   "y": 559.76,
   "w": 39.13,
   "h": 7.6
  },
  {
   "text": "Dosis",
   "x": 304,
   "y": 559.76,
   "w": 20.0,
   "h": 7.6
  },
  {
   "text": "Aturan pakai",
   "x": 404,
   "y": 559.76,
   "w": 44.91,
   "h": 7.6
  },
  {
   "text": "RENCANA / EDUKASI",
   "x": 40,
   "y": 677.42,
   "w": 113.66,
   "h": 10.45
  },
  {
   "text": "Contoh sintetis. Jangan menulis data pasien sungguhan.",
   "x": 197.14,
   "y": 793.76,
   "w": 201.0,
   "h": 7.6
  }
 ],
 "fields": {
  "sys": {
   "label": "Tekanan darah sistolik",
   "unit": "mmHg",
   "range": [
    60,
    260
   ],
   "decimals": 0,
   "box": {
    "x": 40,
    "y": 234,
    "w": 90,
    "h": 38
   }
  },
  "dia": {
   "label": "Tekanan darah diastolik",
   "unit": "mmHg",
   "range": [
    30,
    160
   ],
   "decimals": 0,
   "box": {
    "x": 150,
    "y": 234,
    "w": 90,
    "h": 38
   }
  },
  "pulse": {
   "label": "Nadi",
   "unit": "x/menit",
   "range": [
    30,
    220
   ],
   "decimals": 0,
   "box": {
    "x": 300,
    "y": 234,
    "w": 90,
    "h": 38
   }
  },
  "temp": {
   "label": "Suhu",
   "unit": "C",
   "range": [
    32,
    43
   ],
   "decimals": 1,
   "box": {
    "x": 420,
    "y": 234,
    "w": 90,
    "h": 38
   }
  },
  "weight": {
   "label": "Berat badan",
   "unit": "kg",
   "range": [
    20,
    250
   ],
   "decimals": 1,
   "box": {
    "x": 40,
    "y": 310,
    "w": 90,
    "h": 38
   }
  },
  "height": {
   "label": "Tinggi badan",
   "unit": "cm",
   "range": [
    100,
    220
   ],
   "decimals": 0,
   "box": {
    "x": 150,
    "y": 310,
    "w": 90,
    "h": 38
   }
  }
 },
 "freeText": {
  "keluhan": {
   "x": 40,
   "y": 386,
   "w": 515,
   "h": 52
  },
  "diagnosis": {
   "x": 40,
   "y": 470,
   "w": 515,
   "h": 52
  },
  "rencana": {
   "x": 40,
   "y": 694,
   "w": 515,
   "h": 60
  }
 }
};
