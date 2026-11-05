import json, os, shutil, subprocess, sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))   # يعمل من أي مجلد

VERSION = open('VERSION', encoding='utf-8').read().strip()
MINIFY = '--no-min' not in sys.argv   # التصغير يخص نسخة الملف الواحد (dist) فقط
TERSER = os.environ.get('TERSER') or shutil.which('terser')
if MINIFY and not TERSER: print('تنبيه: terser غير مثبّت، ستُبنى نسخة الملف الواحد بلا تصغير')

def rd(p):
    with open(p, encoding='utf-8') as f: return f.read()


files = json.loads(rd('files.json'))
body = rd('index_body.html').replace('صانع الأفلام الكرتونية', 'صانع الأفلام الكرتونية ' + VERSION, 1)


def minify_js(code):
    """يصغّر الكود بلا تغيير أسماء المتغيرات العامة (الملفات تتشارك متغيرات عامة)."""
    if not (MINIFY and TERSER):
        return code
    r = subprocess.run([TERSER, '--compress', '--format', 'ascii_only=false'],
                       input=code, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0 or not r.stdout.strip():
        print('تحذير: فشل التصغير، استُخدم الكود الأصلي'); return code
    return r.stdout


# 1) نسخة المجلد (تعمل بفتح index.html مباشرة)
loader = ("<script src=\"js/storage.js\"></script>\n<script>\nconst FILES=%s;\n"
          "Store.init().catch(e=>console.error(e)).then(()=>{FILES.forEach(f=>{const s=document.createElement('script');s.src=f;s.async=false;"
          "s.onerror=()=>{document.getElementById('msg').textContent='تعذّر تحميل '+f;const b=document.getElementById('boot');if(b)b.remove();};document.body.appendChild(s);});});\n"
          "</script>\n</body></html>\n") % json.dumps(files)
GEN = '<!-- ملف مولَّد من build.py (index_body.html + files.json). لا تعدّله يدويًا، عدّل المصدر ثم شغّل: python build.py -->\n'
open('index.html', 'w', encoding='utf-8').write(body.replace('<!doctype html>\n', '<!doctype html>\n' + GEN, 1) + loader)

# 2) نسخة ملف واحد
css = rd('css/styles.css')
single = body.replace('<link rel="stylesheet" href="css/styles.css">', '<style>' + css + '</style>')
code = json.dumps([minify_js(rd(f)) if not f.startswith('assets/') else rd(f) for f in files],
                  ensure_ascii=False).replace('</', '<\\/')
boot = ("<script>" + minify_js(rd('js/storage.js')) + "</script>\n<script>\nconst CODE=%s;\n"
        "Store.init().catch(e=>console.error(e)).then(()=>{CODE.forEach(c=>{const s=document.createElement('script');s.text=c;"
        "document.body.appendChild(s);s.remove();});});\n</script>\n</body></html>\n") % code
out = 'dist/cartoon_movie_%s.html' % VERSION
os.makedirs('dist', exist_ok=True)
open(out, 'w', encoding='utf-8').write(single + boot)
print('ok', out, os.path.getsize(out), 'bytes', '(minified)' if MINIFY and TERSER else '(not minified)')

# 3) حزمة للفحص الساكن فقط (ESLint no-undef عبر الملفات): تُضمّ بنفس ترتيب التحميل ولا تُنشر
with open('dist/_lint_bundle.js', 'w', encoding='utf-8') as f: f.write('\n'.join(rd(p) for p in ['js/storage.js'] + files))
