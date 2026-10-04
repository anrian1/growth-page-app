import json, time, sys, os
import numpy as np, cv2
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
meta = json.load(open('synth/meta.json'))
A, B = int(sys.argv[1]), int(sys.argv[2])
meta = meta[A:B]
HEIGHTS = [96, 128, 160]
NUM = ['sys', 'dia', 'hr', 'rr', 'temp', 'height', 'weight', 'dobD', 'dobM', 'dobY', 'tglD', 'tglM', 'tglY'] + ['mrn', 'rxDhpTabs', 'rxDhpDays', 'rxPqTabs', 'rxPqDays']
TEXT_HEIGHTS = [480, 640]

def stretch(gray):
    s = np.sort(gray.ravel()); lo = s[int(0.02 * (len(s) - 1))]; hi = s[int(0.85 * (len(s) - 1))]
    if hi - lo < 25: return gray
    return np.clip((gray.astype(np.float32) - lo) * 255.0 / (hi - lo), 0, 255).astype(np.uint8)

def read_text(img):
    res, _ = ocr(img, use_cls=False)
    if not res: return ''
    pieces = sorted(res, key=lambda r: min(p[0] for p in r[0]))
    return ' '.join(r[1].strip() for r in pieces if r[1].strip())

def read_lines(img):
    res, _ = ocr(img, use_cls=False)
    if not res: return ''
    items = sorted(res, key=lambda r: (round(min(p[1] for p in r[0]) / 14), min(p[0] for p in r[0])))
    return ' '.join(r[1].strip() for r in items if r[1].strip())

def shrunk(poly, frac):
    x0, y0 = poly.min(axis=0); x1, y1 = poly.max(axis=0)
    mx, my = (x1 - x0) * frac, (y1 - y0) * frac
    return int(x0 + mx), int(y0 + my), int(x1 - mx), int(y1 - my)

def ink_ratio(raw, stride, inner, margin=0.1, drop=60):           # same algorithm as inkRatio() in src/readcell.js
    x, y, w, h = inner; mx, my = round(w * margin), round(h * margin)
    vals = raw[y + my:y + h - my, x + mx:x + w - mx].ravel()
    if vals.size == 0: return 0.0
    paper = np.sort(vals)[min(vals.size - 1, int(0.7 * (vals.size - 1)))]
    if paper < 100: return 0.0
    return float((vals < paper - drop).sum() / vals.size)

import glob
done = {}
for f in glob.glob('synth/ocr_part_*.json'):
    for item in json.load(open(f)): done[item['name']] = item
out = [done[m['name']] for m in meta if m['name'] in done]
meta = [m for m in meta if m['name'] not in done]
print('already done:', len(out), '| to do:', len(meta), flush=True)
t0 = time.time()
for m in meta:
    full = cv2.imread(f"synth/{m['name']}.jpg"); H, W = full.shape[:2]; k = min(1.0, 1600 / max(W, H))
    page = cv2.resize(full, None, fx=k, fy=k, interpolation=cv2.INTER_AREA) if k < 1 else full
    res, _ = ocr(page, use_cls=False)
    tokens = []
    for box, text, conf in (res or []):
        xs = [p[0] for p in box]; ys = [p[1] for p in box]
        tokens.append({'text': text, 'conf': round(float(conf), 3), 'x': round(min(xs), 1), 'y': round(min(ys), 1), 'w': round(max(xs) - min(xs), 1), 'h': round(max(ys) - min(ys), 1)})
    fields = {}
    for key in NUM:
        poly = np.array(m['polys'][key], dtype=np.float32)
        pp = (poly * k).astype(np.float32)
        inside = [t for t in tokens if cv2.pointPolygonTest(pp, (t['x'] + t['w'] / 2, t['y'] + t['h'] / 2), False) >= 0]
        page_text = ' '.join(t['text'].strip() for t in sorted(inside, key=lambda t: t['x']))
        x0, y0, x1, y1 = shrunk(poly, 0.08)
        crop = cv2.cvtColor(full[max(0, y0):y1, max(0, x0):x1], cv2.COLOR_BGR2GRAY)
        crops = {}
        for h in HEIGHTS:
            kk = h / crop.shape[0]
            c = cv2.resize(crop, (max(16, int(crop.shape[1] * kk)), h), interpolation=cv2.INTER_AREA if kk < 1 else cv2.INTER_CUBIC)
            c = cv2.copyMakeBorder(stretch(c), 24, 24, 24, 24, cv2.BORDER_CONSTANT, value=255)
            crops[str(h)] = read_text(cv2.cvtColor(c, cv2.COLOR_GRAY2BGR))
        fields[key] = {'truth': m['truth'][key], 'page': page_text, 'crops': crops, 'poly1600': (poly * k).round(1).tolist()}
    texts = {}
    for name in ('asessmen', 'planning'):
        poly = np.array(m['polys']['free_' + name], dtype=np.float32)
        pp = (poly * k).astype(np.float32)
        inside = [t for t in tokens if cv2.pointPolygonTest(pp, (t['x'] + t['w'] / 2, t['y'] + t['h'] / 2), False) >= 0]
        page_text = ' '.join(t['text'].strip() for t in sorted(inside, key=lambda t: (round(t['y'] / 14), t['x'])))
        x0, y0, x1, y1 = shrunk(poly, 0.02)
        crop = cv2.cvtColor(full[max(0, y0):y1, max(0, x0):x1], cv2.COLOR_BGR2GRAY)
        crops = {}
        for h in TEXT_HEIGHTS:
            kk = h / crop.shape[0]
            c = cv2.resize(crop, (max(16, int(crop.shape[1] * kk)), h), interpolation=cv2.INTER_AREA if kk < 1 else cv2.INTER_CUBIC)
            c = cv2.copyMakeBorder(stretch(c), 24, 24, 24, 24, cv2.BORDER_CONSTANT, value=255)
            crops[str(h)] = read_lines(cv2.cvtColor(c, cv2.COLOR_GRAY2BGR))
        texts[name] = {'truth': m['texts'][name], 'page': page_text, 'crops': crops, 'poly1600': (poly * k).round(1).tolist()}
    ticks = {}
    for key in ('sexL', 'sexP'):
        poly = np.array(m['polys'][key], dtype=np.float32)
        x0, y0, x1, y1 = shrunk(poly, 0.22)
        g = cv2.cvtColor(full[max(0, y0):y1, max(0, x0):x1], cv2.COLOR_BGR2GRAY)
        kk = 96 / g.shape[0]
        g = cv2.resize(g, (max(16, int(g.shape[1] * kk)), 96), interpolation=cv2.INTER_AREA if kk < 1 else cv2.INTER_CUBIC)
        raw = cv2.copyMakeBorder(g, 24, 24, 24, 24, cv2.BORDER_CONSTANT, value=255)
        ticks[key] = {'ratio': round(ink_ratio(raw, raw.shape[1], (24, 24, g.shape[1], 96)), 4), 'poly1600': (poly * k).round(1).tolist()}
    out.append({'name': m['name'], 'level': m['level'], 'writer': m['writer'], 'sex': m['sex'], 'mrn': m['mrn'], 'tokens': tokens, 'fields': fields, 'texts': texts, 'ticks': ticks})
    print(m['name'], m['level'], 'tokens', len(tokens), ' %.0fs' % (time.time() - t0), flush=True)
    json.dump(out, open('synth/ocr_part_resume.json', 'w'), ensure_ascii=False)
print('DONE', flush=True)
