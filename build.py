import json, os, shutil, subprocess, sys

VERSION = open('VERSION', encoding='utf-8').read().strip()
MINIFY = '--no-min' not in sys.argv   # التصغير يخص نسخة الملف الواحد (dist) فقط
TERSER = os.environ.get('TERSER') or shutil.which('terser')

files = json.load(open('files.json'))
rd = lambda p: open(p, encoding='utf-8').read()
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
          "Store.init().then(()=>{FILES.forEach(f=>{const s=document.createElement('script');s.src=f;s.async=false;"
          "s.onerror=()=>{document.getElementById('msg').textContent='تعذّر تحميل '+f};document.body.appendChild(s);});});\n"
          "</script>\n</body></html>\n") % json.dumps(files)
open('index.html', 'w', encoding='utf-8').write(body + loader)

# 2) نسخة ملف واحد
css = rd('css/styles.css')
single = body.replace('<link rel="stylesheet" href="css/styles.css">', '<style>' + css + '</style>')
code = json.dumps([minify_js(rd(f)) if not f.startswith('assets/') else rd(f) for f in files],
                  ensure_ascii=False).replace('</', '<\\/')
boot = ("<script>" + minify_js(rd('js/storage.js')) + "</script>\n<script>\nconst CODE=%s;\n"
        "Store.init().then(()=>{CODE.forEach(c=>{const s=document.createElement('script');s.text=c;"
        "document.body.appendChild(s);s.remove();});});\n</script>\n</body></html>\n") % code
out = 'dist/cartoon_movie_%s.html' % VERSION
os.makedirs('dist', exist_ok=True)
open(out, 'w', encoding='utf-8').write(single + boot)
print('ok', out, os.path.getsize(out), 'bytes', '(minified)' if MINIFY and TERSER else '(not minified)')
