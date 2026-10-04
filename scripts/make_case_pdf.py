# Makes the printable case sheet (Bahasa Indonesia, for the person writing the test pages) from docs/case-sheet.json.
# Run: python3 scripts/make_case_pdf.py [output.pdf]
import json, sys
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

out = sys.argv[1] if len(sys.argv) > 1 else 'lembar-kasus-malaria.pdf'
data = json.load(open('docs/case-sheet.json', encoding='utf-8'))['cases']
st = getSampleStyleSheet()
base = ParagraphStyle('b', parent=st['Normal'], fontName='Helvetica', fontSize=7.6, leading=9.4)
title = ParagraphStyle('t', parent=st['Title'], fontName='Helvetica-Bold', fontSize=15, leading=18, alignment=0)
h2 = ParagraphStyle('h2', parent=st['Heading2'], fontName='Helvetica-Bold', fontSize=11, leading=13)
frac = lambda s: str(s).replace('\u2153', '1/3')
def num(v):
    f = float(v); return str(int(f)) if f.is_integer() else str(v).replace('.', ',')
d = lambda s: ' / '.join(reversed(s.split('-')))
tabs = lambda v: '-' if v in (None, '') else {'0': 'tidak diberikan', '3/2': '1 1/2'}.get(v, v)
mrn = lambda m: f'{m[:2]} {m[2:6]} {m[6:]}'

doc = SimpleDocTemplate(out, pagesize=landscape(A4), leftMargin=24, rightMargin=24, topMargin=24, bottomMargin=24, title='Lembar kasus malaria (anak karangan)')
els = [Paragraph('Lembar kasus: 21 anak karangan dengan malaria (0\u201359 bulan)', title), Spacer(1, 4),
       Paragraph('<b>Semua anak ini karangan, termasuk nomor rekam medisnya.</b> Jangan memakai data pasien sungguhan. Salin satu anak ke satu halaman formulir (<i>rekam-medis-contoh.pdf</i>). Kunci jawaban ada di berkas terpisah dan jangan dibuka dulu.', base), Spacer(1, 4),
       Paragraph('<b>Cara menulis (agar bacaan adil):</b> (1) satu anak per halaman; (2) tulis angka kecil, jelas dan di dalam kotak masing-masing, tinta hitam, goresan sedang; (3) <b>nomor rekam medis</b>: 8 angka berurutan di kotak lebar (tanpa spasi atau garis); (4) tanggal lahir dan TGL: isi kotak tgl, bln, tahun dengan angka; (5) TD: sistolik dan diastolik di dua kotak terpisah; (6) desimal boleh titik atau koma; (7) beri tanda silang atau centang di satu kotak LK atau PR; (8) <b>resep</b>: tulis <b>jumlah</b> di empat kotak Planning (DHP tablet/hari, DHP hari, Primakuin tablet/hari, Primakuin hari). Pecahan ditulis 1/2, 1/4, 1 1/2. Kosongkan kotak primakuin jika tidak diberikan. <b>Asessemen</b>: tulis jenis malaria seperti kebiasaan (mis. falsiparum, vivaks, tropika, tersiana, mix) dan hasil RDT bila ada. Di teks bebas Planning hanya tulis yang tertera di kolom "Planning (teks bebas)" (dispersibel atau artesunat); (9) nama, alamat, telepon dan nomor BPJS: <b>kosongkan atau isi nama karangan</b>; aplikasi membuang tulisan di area itu dan tidak menyimpannya; (10) gunakan 2\u20133 gaya goresan atau minta rekan menulis sebagian halaman. Catat siapa yang menulis tiap halaman.', base), Spacer(1, 8),
       Paragraph('A. Yang ditulis di formulir', h2)]
head = ['Kasus', 'No. RM', 'LK/PR', 'Tgl lahir', 'TGL kunj.', 'TD', 'HR', 'RR', 'T', 'TB', 'BB', 'Keluhan', 'Asessemen', 'DHP tab/hr', 'DHP hr', 'PQ tab/hr', 'PQ hr', 'Planning (teks bebas)']
rows = [[Paragraph(f'<b>{h}</b>', base) for h in head]]
for c in data:
    v = c['vitals']
    rows.append([Paragraph(f"<b>{c['id']}</b>", base), mrn(c['mrn']), 'LK' if c['sex'] == 'L' else 'PR', d(c['dob']), d(c['visit']), f"{v['sys']}/{v['dia']}", str(v['hr']), str(v['rr']), num(v['temp']), num(v['height']), num(v['weight']),
                 Paragraph(c['complaint'], base), Paragraph(c['diagnosisText'], base), c['rxBoxes']['dhpTablets'] or '-', c['rxBoxes']['dhpDays'] or '-', c['rxBoxes']['pqTablets'] or '-', c['rxBoxes']['pqDays'] or '-', Paragraph(frac(c['planningText']) or '-', base)])
sty = [('FONT', (0, 0), (-1, -1), 'Helvetica', 7.6), ('GRID', (0, 0), (-1, -1), 0.4, colors.grey), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3eee8')), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f6f9f7')])]
tbl = Table(rows, colWidths=[26, 50, 24, 62, 60, 32, 22, 22, 26, 28, 26, 66, 78, 34, 28, 34, 28, 96], repeatRows=1); tbl.setStyle(TableStyle(sty))
els += [tbl, PageBreak(), Paragraph('B. Yang dipilih di aplikasi (kartu dosis antimalaria)', h2),
        Paragraph('Aplikasi mengisi kartu ini sendiri dari kotak resep dan tulisan Asessemen. Periksa isiannya, perbaiki jika salah, lalu ketuk "Sesuai tulisan". Tabel ini adalah isian yang <b>seharusnya</b> terbaca.', base), Spacer(1, 6)]
head2 = ['Kasus', 'Hasil tes darah', 'Jenis pengobatan', 'Plasmodium', 'Sediaan DHP', 'DHP tab/hari', 'DHP hari', 'Primakuin tab/hari', 'Primakuin hari', 'Artesunat (mg)', 'G6PD']
SP = {'falciparum': 'P. falciparum', 'vivax': 'P. vivax', 'mixed': 'Campuran', 'malariae': 'P. malariae', 'knowlesi': 'P. knowlesi'}
rows2 = [[Paragraph(f'<b>{h}</b>', base) for h in head2]]
for c in data:
    a = c['app']; sev = a['treatment'] == 'severe'
    rows2.append([Paragraph(f"<b>{c['id']}</b>", base), {'positive': 'positif', 'negative': 'negatif', 'none': 'belum ada'}[a['testResult']], 'malaria berat' if sev else 'tanpa komplikasi', SP[a['species']],
                  '-' if sev else ('dispersibel' if a['formulation'] == 'dispersible' else 'tablet biasa'), '-' if sev else tabs(a.get('dhpTablets')), '-' if sev else str(a.get('dhpDays', '-')),
                  '-' if sev else tabs(a.get('pqTablets')), '-' if sev or not a.get('pqDays') else str(a['pqDays']), num(a['artesunateMg']) if sev and a.get('artesunateMg') is not None else '-', 'defisiensi' if a.get('g6pd') == 'deficient' else 'tidak diketahui'])
tbl2 = Table(rows2, colWidths=[34, 62, 78, 70, 70, 64, 44, 76, 60, 62, 70], repeatRows=1); tbl2.setStyle(TableStyle(sty))
els += [tbl2, Spacer(1, 8), Paragraph('Setelah semua halaman difoto: hitung berapa nilai yang harus diperbaiki di layar konfirmasi dan catat waktu per halaman, untuk dibandingkan dengan mengetik semua nilai. Hitung juga berapa kartu dosis yang terisi benar tanpa diubah.', base)]
doc.build(els)
print('written', out)
