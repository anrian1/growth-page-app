# Printable case sheet for FORM V4 (Bahasa Indonesia, for the person writing the test pages) from docs/case-sheet.json.
# Run: python3 scripts/make_case_pdf_v4.py [output.pdf]
import json, sys
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

out = sys.argv[1] if len(sys.argv) > 1 else 'lembar-kasus-malaria-v4.pdf'
data = json.load(open('docs/case-sheet.json', encoding='utf-8'))['cases']
st = getSampleStyleSheet()
base = ParagraphStyle('b', parent=st['Normal'], fontName='Helvetica', fontSize=7.4, leading=9.2)
title = ParagraphStyle('t', parent=st['Title'], fontName='Helvetica-Bold', fontSize=15, leading=18, alignment=0)
h2 = ParagraphStyle('h2', parent=st['Heading2'], fontName='Helvetica-Bold', fontSize=11, leading=13)
def num(v):
    f = float(v); return str(int(f)) if f.is_integer() else str(v).replace('.', ',')
d = lambda s: ' / '.join(reversed(s.split('-')))
mrn = lambda m: f'{m[:2]} {m[2:6]} {m[6:]}'
tabs = lambda v: '-' if v in (None, '') else {'0': 'tidak diberikan', '3/2': '1 1/2'}.get(v, v)

doc = SimpleDocTemplate(out, pagesize=landscape(A4), leftMargin=22, rightMargin=22, topMargin=22, bottomMargin=22, title='Lembar kasus malaria, formulir v4 (anak karangan)')
els = [Paragraph('Lembar kasus untuk formulir v4: 21 anak karangan dengan malaria (0\u201359 bulan)', title), Spacer(1, 4),
       Paragraph('<b>Semua anak ini karangan, termasuk nomor rekam medisnya.</b> Jangan memakai data pasien sungguhan. Salin satu anak ke satu halaman formulir v4. Kunci jawaban ada di berkas terpisah; jangan dibuka dulu.', base), Spacer(1, 4),
       Paragraph('<b>Cara menulis:</b> (1) satu anak per halaman; (2) angka kecil, jelas, di dalam kotak, tinta hitam, goresan sedang; (3) <b>nomor rekam medis</b>: 8 angka berurutan di kotak lebar, tanpa spasi; (4) tanggal lahir dan TGL: isi kotak tgl, bln, tahun; (5) TD: sistolik dan diastolik di dua kotak; (6) desimal boleh titik atau koma; (7) tanda silang atau centang di satu kotak LK atau PR; (8) <b>resep: per baris, tulis nama obat di kotak nama, lalu di tiga kotak di bawahnya: tablet per dosis, kali per hari, lama (hari)</b>. Pecahan ditulis 1/2, 1/4, 1 1/2. Urutan baris bebas. Obat lain (parasetamol, amoksisilin) ditulis juga: aplikasi mengabaikannya. Kosongkan baris yang tidak dipakai; (9) <b>Asessemen</b>: tulis jenis malaria seperti kebiasaan (falsiparum, vivaks, tropika, tersiana, mix) dan hasil RDT bila ada; di teks bebas Planning hanya tulis kolom \"Planning (teks bebas)\" di bawah (artesunat); (10) nama, alamat, telepon, nomor BPJS: <b>kosongkan atau isi nama karangan</b>; aplikasi membuang tulisan di area itu; (11) pakai 2\u20133 gaya goresan atau minta rekan menulis sebagian halaman; catat siapa menulis tiap halaman.', base), Spacer(1, 4),
       Paragraph('<b>Istilah:</b> tablet per hari = tablet per dosis \u00d7 kali per hari. Contoh: 1/2 tablet, 1\u00d7 per hari = 1/2 tablet per hari. DHP seharusnya sekali sehari: dua kasus sengaja ditulis dua kali per hari.', base), Spacer(1, 6),
       Paragraph('A. Yang ditulis di formulir', h2)]
head = ['Kasus', 'No. RM', 'LK/PR', 'Tgl lahir', 'TGL kunj.', 'TD', 'HR', 'RR', 'T', 'TB', 'BB', 'Keluhan', 'Asessemen', 'Resep: baris 1 sampai 5 (nama | tab/dosis | x/hari | hari)', 'Planning teks bebas']
rows = [[Paragraph(f'<b>{h}</b>', base) for h in head]]
for c in data:
    v = c['vitals']
    rx = '<br/>'.join(f"{i + 1}. {r['name']} | {r['amount']} | {r['perDay']}x | {r['days']} hari" for i, r in enumerate(c['rxRows'])) or '- (tidak ada baris)'
    rows.append([Paragraph(f"<b>{c['id']}</b>", base), mrn(c['mrn']), 'LK' if c['sex'] == 'L' else 'PR', d(c['dob']), d(c['visit']), f"{v['sys']}/{v['dia']}", str(v['hr']), str(v['rr']), num(v['temp']), num(v['height']), num(v['weight']),
                 Paragraph(c['complaint'], base), Paragraph(c['diagnosisText'], base), Paragraph(rx, base), Paragraph((c['planningText'] if c['app']['treatment'] == 'severe' else '-').replace('\u2153', '1/3'), base)])
sty = [('FONT', (0, 0), (-1, -1), 'Helvetica', 7.4), ('GRID', (0, 0), (-1, -1), 0.4, colors.grey), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3eee8')), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f6f9f7')])]
tbl = Table(rows, colWidths=[26, 48, 22, 58, 56, 30, 20, 20, 24, 26, 24, 58, 66, 214, 62], repeatRows=1); tbl.setStyle(TableStyle(sty))
els += [tbl, PageBreak(), Paragraph('B. Yang seharusnya terbaca aplikasi di kartu dosis', h2),
        Paragraph('Aplikasi mengisi kartu ini sendiri dari baris resep dan tulisan Asessemen. Periksa isiannya, perbaiki jika salah, lalu ketuk "Sesuai tulisan".', base), Spacer(1, 6)]
head2 = ['Kasus', 'Hasil tes darah', 'Jenis pengobatan', 'Plasmodium', 'Sediaan DHP', 'DHP tab/hari', 'DHP hari', 'Primakuin tab/hari', 'Primakuin hari', 'Artesunat (mg)', 'G6PD', 'Peringatan yang diharapkan (v4)']
SP = {'falciparum': 'P. falciparum', 'vivax': 'P. vivax', 'mixed': 'Campuran', 'malariae': 'P. malariae', 'knowlesi': 'P. knowlesi'}
rows2 = [[Paragraph(f'<b>{h}</b>', base) for h in head2]]
for c in data:
    a = c['app']; sev = a['treatment'] == 'severe'
    rows2.append([Paragraph(f"<b>{c['id']}</b>", base), {'positive': 'positif', 'negative': 'negatif', 'none': 'belum ada'}[a['testResult']], 'malaria berat' if sev else 'tanpa komplikasi', SP[a['species']],
                  '-' if sev else ('dispersibel' if a['formulation'] == 'dispersible' else 'tablet biasa'), '-' if sev else tabs(a.get('dhpTablets')), '-' if sev else str(a.get('dhpDays', '-')),
                  '-' if sev else tabs(a.get('pqTablets')), '-' if sev or not a.get('pqDays') else str(a['pqDays']), num(a['artesunateMg']) if sev and a.get('artesunateMg') is not None else '-', 'defisiensi' if a.get('g6pd') == 'deficient' else 'tidak diketahui',
                  Paragraph(', '.join(c['expected']['doseChecks'] + c['expected'].get('v4Extra', [])) or '-', base)])
tbl2 = Table(rows2, colWidths=[34, 56, 70, 64, 62, 52, 40, 64, 54, 56, 60, 152], repeatRows=1); tbl2.setStyle(TableStyle(sty))
els += [tbl2, Spacer(1, 8), Paragraph('Setelah semua halaman difoto: catat waktu per halaman, berapa isian yang harus diperbaiki di layar konfirmasi (nomor RM yang diketik dihitung satu), dan berapa kartu dosis yang terisi benar tanpa diubah.', base)]
doc.build(els)
print('written', out)
