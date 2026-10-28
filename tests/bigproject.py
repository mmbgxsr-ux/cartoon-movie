"""مولّد مشروع كبير واقعي الحجم لاختبارات الحمل: 15 خلفية 1280×720 و30 مشهدًا و30 ملف صوت وبطاقات ولوحة.

الصور تحتوي ضجيجًا عشوائيًا بثوابت ثابتة (seed) كي تقترب أحجام JPEG من الصور الحقيقية (نحو 300–600 كيلوبايت للخلفية)،
فلا يكون الاختبار أسهل من الواقع.
"""
import io
import math
import random
import struct
import wave
from pathlib import Path

N_BG, N_SCENES = 15, 30
LOREM = ("وصلنا إلى المكان وبدأت الأحداث تتغير أمام أعيننا، والناس حولنا يتحدثون عن الأمر بحماس كبير. "
         "تعالَ نسمع ما جرى بالتفصيل ونفهم لماذا كان القرار مهمًا في ذلك الوقت. ")


def make_scenes():
    scenes = []
    for i in range(N_SCENES):
        s = {"h": "مشهد %d" % (i + 1), "bg": i % N_BG + 1, "text": ("%d. " % (i + 1)) + LOREM * 2,
             "acts": [[0, ["wave", "talk", "point", "think"][i % 4]], [0.6, "talk"]], "props": [], "noWalk": False}
        if i % 5 == 4:   # بعض المشاهد حوار بين شخصيتين
            s["lines"] = [{"spk": "guide", "t": "سؤال المرشد رقم %d؟" % (i + 1)}, {"spk": "amr", "t": "جواب عمرو على السؤال رقم %d." % (i + 1)}]
            s["text"] = " ".join(l["t"] for l in s["lines"])
            s["cast"] = ["guide", "amr"]
            s["noWalk"] = True
        scenes.append(s)
    return scenes


def _jpeg(w, h, seed):
    import numpy as np
    from PIL import Image
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:h, 0:w]
    base = np.stack([(x * 255 // w), (y * 255 // h), ((x + y) * 255 // (w + h))], axis=-1).astype("float32")
    img = np.clip(base + rng.normal(0, 28, base.shape), 0, 255).astype("uint8")
    buf = io.BytesIO()
    Image.fromarray(img).save(buf, "JPEG", quality=88)
    return buf.getvalue()


def _wav(seconds, seed, rate=24000):
    rnd = random.Random(seed)
    f = 150 + rnd.random() * 200
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", int(6000 * math.sin(2 * math.pi * f * i / rate) * (0.6 + 0.4 * math.sin(i / 3000)))) for i in range(int(seconds * rate))))
    return buf.getvalue()


def _sheet_png(w, h, cols, rows):
    import numpy as np
    from PIL import Image
    a = np.full((h, w, 3), 255, "uint8")
    cw, ch = w // cols, h // rows
    for r in range(rows):
        for c in range(cols):
            a[r * ch + int(ch * .15): r * ch + int(ch * .85), c * cw + int(cw * .3): c * cw + int(cw * .7)] = (32, 48, 64)
    buf = io.BytesIO()
    Image.fromarray(a).save(buf, "PNG")
    return buf.getvalue()


def build(dest: Path):
    """ينشئ الملفات داخل dest ويعيد dict بالمسارات والمشاهد."""
    dest.mkdir(parents=True, exist_ok=True)
    bgs = []
    for i in range(N_BG):
        p = dest / ("bg%02d.jpg" % (i + 1))
        p.write_bytes(_jpeg(1280, 720, i))
        bgs.append(p)
    auds = []
    for i in range(N_SCENES):
        p = dest / ("%02d.wav" % (i + 1))
        p.write_bytes(_wav(8 + (i % 5), i))
        auds.append(p)
    sheet = dest / "sheet.png"
    sheet.write_bytes(_sheet_png(800, 400, 4, 2))
    card = dest / "card.png"
    card.write_bytes(_sheet_png(400, 400, 1, 1))
    return {"bgs": bgs, "auds": auds, "sheet": sheet, "card": card, "scenes": make_scenes()}


if __name__ == "__main__":
    import sys
    d = build(Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/bigproject"))
    print(sum(p.stat().st_size for k in ("bgs", "auds") for p in d[k]) / 1048576, "MB")
