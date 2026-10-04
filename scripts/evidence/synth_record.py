# Synthetic "photos of a tablet screen" showing stylus handwriting on the revised medical record, one per case in docs/case-sheet.json.
# Handwriting-style fonts (three simulated writers), tick marks, then screen-photo effects: tilt and perspective, glare, moire-like banding,
# uneven brightness, blur, noise, JPEG. Keeps the true positions of every box. SYNTHETIC: tidier than real handwriting.
import json, math, random, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

random.seed(11); np.random.seed(11)
tpl = json.load(open('medical-record-template.json'))
cases = json.load(open('/home/claude/growth-page-app/docs/case-sheet.json'))['cases']
S = 200 / 72
base = Image.open('base-1.png').convert('RGB')
FONTS = ['/home/claude/clinic-sheet/fonts/Caveat.ttf', '/home/claude/clinic-sheet/fonts/Kalam-Regular.ttf', '/home/claude/clinic-sheet/fonts/PatrickHand-Regular.ttf', '/home/claude/clinic-sheet/fonts/ReenieBeanie.ttf', '/home/claude/clinic-sheet/fonts/NanumPenScript-Regular.ttf']
WRITERS = [  # (font index, ink colour, size multiplier, thick)
    (0, (20, 20, 24), 1.0, True), (2, (25, 45, 140), 0.92, True), (1, (35, 35, 40), 1.08, False), (4, (20, 20, 24), 1.0, False), (3, (30, 50, 150), 1.1, True)]
BOX = {k: v['box'] for k, v in tpl['fields'].items()}
BOX.update({k: v['box'] for k, v in tpl['ticks'].items()})
FREE = tpl['freeText']

def write(img, text, box, font_path, color, size_frac, rot, dx, dy, bold):
    w, h = int(box['w'] * S), int(box['h'] * S)
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    font = ImageFont.truetype(font_path, max(10, int(h * size_frac)))
    for ox, oy in ([(0, 0), (1, 0), (0, 1)] if bold else [(0, 0)]):
        d.text((int(w * 0.07) + dx + ox, int(h * 0.80) + dy + oy), text, font=font, fill=color + (255,), anchor='ls')
    layer = layer.rotate(rot, resample=Image.BICUBIC, center=(w / 2, h / 2))
    img.paste(layer, (int(box['x'] * S), int(box['y'] * S)), layer)

def tick(img, box, color, rnd, style):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    x, y, w, h = box['x'] * S, box['y'] * S, box['w'] * S, box['h'] * S
    j = lambda a: a + rnd.uniform(-0.06, 0.06) * w
    wd = rnd.choice([3, 4, 5])
    if style == 'tick': pts = [(j(x + 0.18 * w), j(y + 0.55 * h)), (j(x + 0.42 * w), j(y + 0.85 * h)), (j(x + 0.9 * w), j(y + 0.1 * h))]; d.line(pts, fill=color + (255,), width=wd, joint='curve')
    else:
        d.line([(j(x + 0.2 * w), j(y + 0.2 * h)), (j(x + 0.8 * w), j(y + 0.8 * h))], fill=color + (255,), width=wd)
        d.line([(j(x + 0.8 * w), j(y + 0.2 * h)), (j(x + 0.2 * w), j(y + 0.8 * h))], fill=color + (255,), width=wd)
    img.paste(layer, (0, 0), layer)

def wrap(text, n):
    words, lines, cur = text.split(), [], ''
    for wd in words:
        if len(cur) + len(wd) + 1 > n and cur: lines.append(cur); cur = wd
        else: cur = (cur + ' ' + wd).strip()
    if cur: lines.append(cur)
    return lines
plain = lambda s: s.replace('\u00bd', '1/2').replace('\u00bc', '1/4').replace('\u00be', '3/4').replace('\u2153', '1/3').replace('1\u00bd', '1 1/2')

def num_text(v, comma):
    s = f'{v:g}' if isinstance(v, float) else str(v)
    return s.replace('.', ',') if comma else s

def make(case, level, seed):
    rnd = random.Random(seed)
    wi, (fi, color, mult, bold) = rnd.randrange(len(WRITERS)), None
    return None

def render(case, idx, level):
    rnd = random.Random(500 + idx)
    writer = idx % len(WRITERS)
    fi, color, mult, bold = WRITERS[writer]
    font = FONTS[fi]
    img = base.copy()
    v = case['vitals']
    vals = {'sys': v['sys'], 'dia': v['dia'], 'hr': v['hr'], 'rr': v['rr'], 'temp': v['temp'], 'height': v['height'], 'weight': v['weight']}
    d1, m1, y1 = [int(x) for x in case['dob'].split('-')[::-1]]
    d2, m2, y2 = [int(x) for x in case['visit'].split('-')[::-1]]
    vals.update(dobD=d1, dobM=m1, dobY=y1, tglD=d2, tglM=m2, tglY=y2)
    truth = {}
    for k, val in vals.items():
        comma = isinstance(val, float) and rnd.random() < 0.35
        text = num_text(val, comma)
        if k in ('dobD', 'dobM', 'tglD', 'tglM') and rnd.random() < 0.4: text = f'{val:02d}'     # some people write 04, some write 4
        truth[k] = val
        b = BOX[k]
        write(img, text, b, font, color, rnd.uniform(0.52, 0.68) * mult, rnd.uniform(-4, 4), rnd.randint(-3, 8), rnd.randint(-5, 3), bold)
    tickbox = 'sexL' if case['sex'] == 'L' else 'sexP'
    tick(img, BOX[tickbox], color, rnd, rnd.choice(['tick', 'x']))
    # free text areas (not read by the app, but they are on the page and the OCR sees them)
    def para(area, text, size, n):
        b = FREE[area]; y = 4
        for line in wrap(plain(text), n)[:7]:
            write(img, line, {'x': b['x'], 'y': b['y'] + y / S * 0 + y / S, 'w': b['w'], 'h': 18}, font, color, 0.55 * mult, rnd.uniform(-2, 2), 0, rnd.randint(-2, 2), False); y += 20
    para('keluhan', case['complaint'], 0.5, 16); para('asessmen', case['diagnosisText'], 0.5, 15); para('planning', case['planningText'], 0.5, 18)

    page = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR); H, W = page.shape[:2]
    rot = {'easy': 0.8, 'mid': 3.0, 'hard': 5.5}[level] * rnd.choice([-1, 1]) * rnd.uniform(0.6, 1.0)
    persp = {'easy': 0.0, 'mid': 0.03, 'hard': 0.06}[level]
    pad = 0.09; Wc, Hc = int(W * (1 + 2 * pad)), int(H * (1 + 2 * pad))
    src = np.float32([[0, 0], [W, 0], [W, H], [0, H]])
    dst = np.float32([[W * pad, H * pad], [W * (1 + pad), H * pad], [W * (1 + pad), H * (1 + pad)], [W * pad, H * (1 + pad)]])
    dst += np.float32([[rnd.uniform(-persp, persp) * W, rnd.uniform(-persp, persp) * H] for _ in range(4)])
    c = np.array([Wc / 2, Hc / 2]); a = math.radians(rot); R = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
    dst = ((dst - c) @ R.T + c).astype(np.float32)
    sc = 2400 / max(Wc, Hc); M = cv2.getPerspectiveTransform(src, dst); Mf = np.diag([sc, sc, 1.0]) @ M
    outW, outH = int(Wc * sc), int(Hc * sc)
    bg = rnd.choice([(18, 18, 20), (35, 32, 30), (60, 58, 58)])                       # the dark frame of a tablet, or a dim table
    out = cv2.warpPerspective(page, Mf, (outW, outH), flags=cv2.INTER_AREA if sc < 1 else cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=bg).astype(np.float32)
    yy, xx = np.mgrid[0:outH, 0:outW].astype(np.float32)
    bright = {'easy': 0.9, 'mid': 0.82, 'hard': 0.7}[level]                           # screen brightness
    out *= bright * (1 + 0.06 * np.linspace(-1, 1, outW))[None, :, None]
    # glare: a soft bright patch somewhere on the glass
    gx, gy = rnd.uniform(0.15, 0.85) * outW, rnd.uniform(0.15, 0.85) * outH
    gr = {'easy': 0.0, 'mid': 0.35, 'hard': 0.6}[level] * 255
    out += (gr * np.exp(-(((xx - gx) / (0.22 * outW)) ** 2 + ((yy - gy) / (0.16 * outH)) ** 2)))[:, :, None]
    # moire-like banding from two crossed fine patterns
    amp = {'easy': 0.0, 'mid': 0.025, 'hard': 0.055}[level]
    f1, f2 = rnd.uniform(0.09, 0.2), rnd.uniform(0.1, 0.22); ang = rnd.uniform(0.2, 1.2)
    band = np.sin(2 * math.pi * (f1 * (xx * math.cos(ang) + yy * math.sin(ang)))) * np.sin(2 * math.pi * f2 * yy)
    out *= (1 + amp * band)[:, :, None]
    out += np.random.normal(0, {'easy': 1.5, 'mid': 3.0, 'hard': 5.0}[level], out.shape)
    out = cv2.GaussianBlur(np.clip(out, 0, 255).astype(np.uint8), (0, 0), {'easy': 0.6, 'mid': 0.9, 'hard': 1.3}[level])
    ok, buf = cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, {'easy': 90, 'mid': 82, 'hard': 70}[level]]); out = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    def poly(b):
        pts = np.float32([[b['x'] * S, b['y'] * S], [(b['x'] + b['w']) * S, b['y'] * S], [(b['x'] + b['w']) * S, (b['y'] + b['h']) * S], [b['x'] * S, (b['y'] + b['h']) * S]])
        return cv2.perspectiveTransform(pts[None], Mf.astype(np.float64))[0].tolist()
    return out, {'truth': truth, 'sex': case['sex'], 'polys': {k: poly(b) for k, b in BOX.items()}, 'writer': writer, 'level': level}

if __name__ == '__main__':
    import os; os.makedirs('synth', exist_ok=True)
    meta = []
    for i, case in enumerate(cases):
        level = 'easy' if i < 7 else 'mid' if i < 14 else 'hard'
        img, info = render(case, i, level)
        cv2.imwrite(f"synth/{case['id']}.jpg", img)
        meta.append({'name': case['id'], **info, 'size': [img.shape[1], img.shape[0]]})
    json.dump(meta, open('synth/meta.json', 'w'))
    print(len(meta), 'sheets;', [m['level'] for m in meta][:3], '...')
