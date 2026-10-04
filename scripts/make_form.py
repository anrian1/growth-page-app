# Draws the revised synthetic medical record AND writes its template (the "blank page" the reader learns) from ONE description.
# Coordinates are PDF points, origin at the TOP-LEFT of an A4 page. Based on the layout of the user's paper record
# (SOAP columns), with: Agama and Pekerjaan removed, LK/PR as tick boxes, date of birth boxes, a wider TGL column with date boxes,
# and six labelled boxes in the Objektif column.
import json
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth

W, H = A4
FONT, BOLD = 'Helvetica', 'Helvetica-Bold'
labels, boxes = [], {}
mm = 72 / 25.4

def txt(c, s, x, y, size=9, font=FONT, align='left', anchor=True, grey=0.0):
    w = stringWidth(s, font, size); x0 = {'left': x, 'center': x - w / 2, 'right': x - w}[align]
    c.setFont(font, size); c.setFillGray(grey); c.drawString(x0, H - y, s)
    if anchor and len(''.join(ch for ch in s if ch.isalnum())) >= 4:
        labels.append({'text': s, 'x': round(x0, 2), 'y': round(y - size * 0.78, 2), 'w': round(w, 2), 'h': round(size * 0.95, 2)})

def rect(c, x, y, w, h, lw=0.8, name=None):
    c.setLineWidth(lw); c.setStrokeGray(0); c.rect(x, H - y - h, w, h)
    if name: boxes[name] = {'x': round(x, 2), 'y': round(y, 2), 'w': round(w, 2), 'h': round(h, 2)}

def line(c, x1, y1, x2, y2, lw=0.8, dash=None):
    c.setLineWidth(lw); c.setStrokeGray(0)
    if dash: c.setDash(*dash)
    c.line(x1, H - y1, x2, H - y2)
    c.setDash()

c = canvas.Canvas('rekam-medis-contoh.pdf', pagesize=A4)
c.setTitle('Rekam Medis (contoh sintetis, revisi)')
L, R = 28.35, W - 28.35

# ---- header
txt(c, 'PEMERINTAH KABUPATEN ABCD', W / 2, 30, 11, BOLD, 'center')
txt(c, 'PUSKESMAS ABCD', W / 2, 44, 11, BOLD, 'center')
line(c, L, 52, R, 52, 1.8)
txt(c, 'NOMOR REKAM MEDIS', 255, 84, 11, BOLD, 'center')
x = 345
for group in (2, 4, 2):
    for _ in range(group):
        rect(c, x, 70, 16, 18, 0.8); x += 16
    x += 8

# ---- identity block (left): NAMA, NAMA KK, JENIS KELAMIN, TGL LAHIR, ALAMAT, TELP./HP
y = 108
for label in ('NAMA', 'NAMA KK'):
    txt(c, label, L + 2, y, 9); line(c, 118, y + 1, 330, y + 1, 0.6, (1, 2)); y += 22
txt(c, 'JENIS KELAMIN', L + 2, y, 9); txt(c, ':', 112, y, 9, anchor=False)
rect(c, 120, y - 11, 14, 14, 0.9, 'sexL'); txt(c, 'LK', 138, y, 9, anchor=False)
rect(c, 172, y - 11, 14, 14, 0.9, 'sexP'); txt(c, 'PR', 190, y, 9, anchor=False)
y += 24
txt(c, 'TGL LAHIR', L + 2, y + 6, 9); txt(c, ':', 112, y + 6, 9, anchor=False)
rect(c, 120, y - 10, 30, 22, 0.9, 'dobD'); txt(c, '/', 156, y + 7, 12, BOLD, anchor=False)
rect(c, 164, y - 10, 30, 22, 0.9, 'dobM'); txt(c, '/', 200, y + 7, 12, BOLD, anchor=False)
rect(c, 208, y - 10, 56, 22, 0.9, 'dobY')
for lbl, cx in (('tgl', 135), ('bln', 179), ('tahun', 236)): txt(c, lbl, cx, y + 21, 6.5, FONT, 'center', anchor=False, grey=0.35)
y += 38
for label in ('ALAMAT', 'TELP./HP'):
    txt(c, label, L + 2, y, 9); line(c, 118, y + 1, 330, y + 1, 0.6, (1, 2)); y += 19

# ---- BPJS block (right)
by = 104
for label in ('BPJS PBI', 'BPJS NON PBI', 'UMUM', 'LAINNYA'):
    rect(c, 345, by - 11, 26, 18, 0.8); rect(c, 371, by - 11, 90, 18, 0.8); txt(c, label, 376, by + 2, 8.5); by += 18
rect(c, 345, by + 6, 222, 18, 0.8); txt(c, 'NO. KARTU BPJS :', 350, by + 19, 8.5, BOLD)
cx = 345
for _ in range(13): rect(c, cx, by + 24, 222 / 13, 16, 0.6); cx += 222 / 13

# ---- history row
t0 = 254
xs3 = [L, L + 120, L + 320, R]
for i, label in enumerate(('Riwayat Alergi', 'Riwayat Penyakit Dahulu', 'Riwayat Penyakit Keluarga')):
    rect(c, xs3[i], t0, xs3[i + 1] - xs3[i], 22, 0.8); txt(c, label, (xs3[i] + xs3[i + 1]) / 2, t0 + 14.5, 9, BOLD, 'center')
    rect(c, xs3[i], t0 + 22, xs3[i + 1] - xs3[i], 22, 0.8)

# ---- main table
cols = [24, 36, 52, 31, 37, 10]            # millimetres: TGL, SUBJEKTIF, OBJEKTIF, ASESSEMEN, PLANNING, TT
xb = [L]
for w in cols: xb.append(xb[-1] + w * mm)
top, h1, h2, bottom = 314, 18, 30, 800
c.setLineWidth(0.9); c.setStrokeGray(0)
for xx in xb: line(c, xx, top, xx, bottom, 0.9)
line(c, L, top, R, top, 0.9); line(c, xb[1], top + h1, xb[5], top + h1, 0.9); line(c, L, top + h1 + h2, R, top + h1 + h2, 0.9); line(c, L, bottom, R, bottom, 0.9)
mid = lambda i: (xb[i] + xb[i + 1]) / 2
txt(c, 'TGL', mid(0), top + h1 + 6, 9.5, BOLD, 'center')
for i, head in enumerate(('SUBJEKTIF', 'OBJEKTIF', 'ASESSEMEN', 'PLANNING', 'TT'), start=1): txt(c, head, mid(i), top + 13, 9.5, BOLD, 'center')
txt(c, 'Anamnesis', mid(1), top + h1 + 17, 9, BOLD, 'center')
txt(c, 'Pemeriksaan fisik dan', mid(2), top + h1 + 13, 9, BOLD, 'center'); txt(c, 'penunjang', mid(2), top + h1 + 25, 9, BOLD, 'center')
txt(c, 'Diagnosis', mid(3), top + h1 + 13, 9, BOLD, 'center'); txt(c, '(Keputusan Klinis)', mid(3), top + h1 + 25, 9, BOLD, 'center')
txt(c, 'Rencana Layanan Klinis', mid(4), top + h1 + 17, 8.2, BOLD, 'center')

body = top + h1 + h2
# TGL column: three stacked date boxes
for i, (name, cap, bw) in enumerate((('tglD', 'tgl', 34), ('tglM', 'bln', 34), ('tglY', 'thn', 52))):
    by_ = body + 14 + i * 36
    txt(c, cap, xb[0] + 3, by_ + 15, 6.5, FONT, anchor=False, grey=0.35)
    rect(c, xb[0] + 13, by_, bw if name != 'tglY' else 52, 24, 0.9, name)
# SUBJEKTIF labels
txt(c, 'Keluhan Utama :', xb[1] + 4, body + 20, 9)
txt(c, 'Keluhan Tambahan :', xb[1] + 4, body + 40, 9)
# OBJEKTIF: six labelled boxes
rows = [('TD', 'mmHg'), ('HR', 'x/mnt'), ('RR', 'x/mnt'), ('T', '\u00b0C'), ('TB', 'cm'), ('BB', 'kg')]
for i, (lab, unit) in enumerate(rows):
    ry = body + 12 + i * 40
    txt(c, lab, xb[2] + 5, ry + 14, 10, BOLD, anchor=False); txt(c, unit, xb[2] + 5, ry + 25, 6.5, FONT, anchor=False, grey=0.35)
    if lab == 'TD':
        rect(c, xb[2] + 34, ry, 44, 28, 0.9, 'sys'); txt(c, '/', xb[2] + 81, ry + 20, 14, BOLD, anchor=False); rect(c, xb[2] + 90, ry, 44, 28, 0.9, 'dia')
    else:
        key = {'HR': 'hr', 'RR': 'rr', 'T': 'temp', 'TB': 'height', 'BB': 'weight'}[lab]
        rect(c, xb[2] + 34, ry, 70, 28, 0.9, key)
# free-text areas shown as pictures (not read)
free = {'keluhan': {'x': xb[1] + 3, 'y': body + 48, 'w': cols[1] * mm - 6, 'h': 150},
        'asessmen': {'x': xb[3] + 3, 'y': body + 6, 'w': cols[3] * mm - 6, 'h': 160},
        'planning': {'x': xb[4] + 3, 'y': body + 6, 'w': cols[4] * mm - 6, 'h': 160}}
txt(c, 'Contoh sintetis untuk uji coba - bukan formulir resmi. Jangan menulis data pasien sungguhan.', W / 2, 820, 7, FONT, 'center', grey=0.35)
c.showPage(); c.save()

RANGES = {  # UPDATE ME: a clinician should confirm these (children 0-18 years)
    'sys': ('Tekanan darah sistolik', 'mmHg', 50, 200, 0), 'dia': ('Tekanan darah diastolik', 'mmHg', 20, 140, 0),
    'hr': ('HR (nadi)', 'x/menit', 40, 220, 0), 'rr': ('RR (napas)', 'x/menit', 8, 80, 0), 'temp': ('Suhu (T)', 'C', 34, 43, 1),
    'height': ('Panjang/tinggi badan (TB)', 'cm', 30, 200, 1), 'weight': ('Berat badan (BB)', 'kg', 1.5, 120, 1),
    'dobD': ('Tanggal lahir: tanggal', '', 1, 31, 0), 'dobM': ('Tanggal lahir: bulan', '', 1, 12, 0), 'dobY': ('Tanggal lahir: tahun', '', 1990, 2100, 0),
    'tglD': ('TGL: tanggal', '', 1, 31, 0), 'tglM': ('TGL: bulan', '', 1, 12, 0), 'tglY': ('TGL: tahun', '', 2000, 2100, 0),
}
fields = {k: {'label': v[0], 'unit': v[1], 'range': [v[2], v[3]], 'decimals': v[4], 'box': boxes[k]} for k, v in RANGES.items()}
ticks = {k: {'label': 'Laki-laki' if k == 'sexL' else 'Perempuan', 'box': boxes[k]} for k in ('sexL', 'sexP')}
tpl = {'id': 'rekam-medis-contoh-v2', 'title': 'REKAM MEDIS (contoh sintetis, revisi)', 'synthetic': True, 'page': {'w': round(W, 2), 'h': round(H, 2)},
       'labels': labels, 'fields': fields, 'ticks': ticks, 'freeText': {k: {kk: round(vv, 2) for kk, vv in v.items()} for k, v in free.items()}}
json.dump(tpl, open('medical-record-template.json', 'w'), indent=1, ensure_ascii=False)
print(len(labels), 'anchor labels,', len(fields), 'numeric fields,', len(ticks), 'tick boxes')
