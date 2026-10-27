import json,re,sys
files=json.load(open('files.json'))
body=open('index_body.html',encoding='utf-8').read().replace('صانع الأفلام الكرتونية','صانع الأفلام الكرتونية v53',1)
rd=lambda p:open(p,encoding='utf-8').read()
# 1) نسخة المجلد (تعمل بفتح index.html مباشرة)
loader="<script src=\"js/storage.js\"></script>\n<script>\nconst FILES=%s;\nStore.init().then(()=>{FILES.forEach(f=>{const s=document.createElement('script');s.src=f;s.async=false;s.onerror=()=>{document.getElementById('msg').textContent='تعذّر تحميل '+f};document.body.appendChild(s);});});\n</script>\n</body></html>\n"%json.dumps(files)
open('index.html','w',encoding='utf-8').write(body+loader)
# 2) نسخة ملف واحد
css=rd('css/styles.css')
single=body.replace('<link rel="stylesheet" href="css/styles.css">','<style>'+css+'</style>')
code=json.dumps([rd(f) for f in files],ensure_ascii=False).replace('</','<\\/')
boot="<script>"+rd('js/storage.js')+"</script>\n<script>\nconst CODE=%s;\nStore.init().then(()=>{CODE.forEach(c=>{const s=document.createElement('script');s.text=c;document.body.appendChild(s);s.remove();});});\n</script>\n</body></html>\n"%code
open('dist/cartoon_movie_v53.html','w',encoding='utf-8').write(single+boot)
print('ok')
