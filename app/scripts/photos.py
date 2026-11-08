"""photos.py — the landing's photographs, kept on our own host.

The landing used to load every photo from images.unsplash.com, so when that
host was slow or unreachable the page lost its pictures (and its load event).
Now each photo in src/landing/photos.ts is downloaded once from Unsplash
(free Unsplash License, which allows this) and written to public/photos at
the widths in PHOTO_WIDTHS, as WebP.

Run after adding a photo to photos.ts:  python3 scripts/photos.py
Needs Pillow. Writes only the files that are missing.
"""
import io, os, re, sys, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'src', 'landing', 'photos.ts')
OUT = os.path.join(HERE, '..', 'public', 'photos')
WIDTHS = [240, 480, 960, 1600]  # PHOTO_WIDTHS in photos.ts

text = open(SRC).read()
photos = re.findall(r"(\w+): \{ id: '([0-9a-f-]+)'", text)
widths = re.search(r'PHOTO_WIDTHS = \[([\d, ]+)\]', text)
assert widths and [int(w) for w in widths.group(1).split(',')] == WIDTHS, 'PHOTO_WIDTHS in photos.ts and WIDTHS here differ'
os.makedirs(OUT, exist_ok=True)
masters = sys.argv[1] if len(sys.argv) > 1 else None

for key, pid in photos:
    want = [w for w in WIDTHS if not os.path.exists(os.path.join(OUT, f'{key}-{w}.webp'))]
    if not want:
        continue
    local = masters and os.path.join(masters, f'{key}.jpg')
    if local and os.path.exists(local):
        data = open(local, 'rb').read()
    else:
        req = urllib.request.Request(f'https://images.unsplash.com/photo-{pid}?fm=jpg&q=86&w=2000', headers={'User-Agent': 'alamut-build'})
        data = urllib.request.urlopen(req, timeout=60).read()
    master = Image.open(io.BytesIO(data)).convert('RGB')
    for w in want:
        h = round(master.height * w / master.width)
        master.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, f'{key}-{w}.webp'), 'WEBP', quality=74, method=6)
    print(key, 'written at', want)
