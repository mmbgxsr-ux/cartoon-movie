try{(function(){
const boxes=[...document.querySelectorAll('.panel>.box')],names=['الخلفيات','الشخصية','دورة المشي','الفم','البطاقات','التشغيل','الطاقم','المحرر','المشروع','البدء السريع'],nav=document.getElementById('tabs');
nav.setAttribute('role','tablist');nav.setAttribute('aria-label','أقسام الاستوديو');
boxes.forEach((b,i)=>{const h=b.querySelector('h3');if(h)h.textContent=h.textContent.replace(/^\S+\)\s*/,'');
 const t=document.createElement('button');t.type='button';t.textContent=names[i]||('قسم '+(i+1));t.onclick=()=>show(i);
 t.id='tab'+i;t.setAttribute('role','tab');
 if(!b.id)b.id='panel'+i;t.setAttribute('aria-controls',b.id);b.setAttribute('role','tabpanel');b.setAttribute('aria-labelledby',t.id);
 nav.appendChild(t);});
function show(i){boxes.forEach((b,j)=>b.classList.toggle('act',j===i));[...nav.children].forEach((t,j)=>{t.classList.toggle('sel',j===i);t.setAttribute('aria-selected',j===i?'true':'false');t.tabIndex=j===i?0:-1;});try{Store.setItem('cmTab',i)}catch(_){}try{nav.children[i].scrollIntoView({inline:'center',block:'nearest'})}catch(_){}}
// لوحة المفاتيح: الأسهم (تراعي اتجاه RTL) و Home و End
nav.addEventListener('keydown',e=>{
 const tabs=[...nav.children],cur=tabs.indexOf(document.activeElement);if(cur<0)return;
 const rtl=getComputedStyle(nav).direction==='rtl';let j=null;
 if(e.key==='ArrowRight')j=cur+(rtl?-1:1);else if(e.key==='ArrowLeft')j=cur+(rtl?1:-1);else if(e.key==='Home')j=0;else if(e.key==='End')j=tabs.length-1;
 if(j===null)return;e.preventDefault();j=(j+tabs.length)%tabs.length;show(j);tabs[j].focus();
});
let k=0;try{const sv=Store.getItem('cmTab');k=sv==null?Math.max(0,names.indexOf('البدء السريع')):(+sv||0)}catch(_){}show(Math.min(k,boxes.length-1));
})()}catch(e){document.querySelectorAll('.panel>.box').forEach(b=>b.style.display='block')}
