try{(function(){
const boxes=[...document.querySelectorAll('.panel>.box')],names=['الخلفيات','الشخصية','دورة المشي','الفم','البطاقات','التشغيل','الطاقم','المحرر','المشروع','البدء السريع'],nav=document.getElementById('tabs');
boxes.forEach((b,i)=>{const h=b.querySelector('h3');if(h)h.textContent=h.textContent.replace(/^\S+\)\s*/,'');
 const t=document.createElement('button');t.type='button';t.textContent=names[i]||('قسم '+(i+1));t.onclick=()=>show(i);nav.appendChild(t);});
function show(i){boxes.forEach((b,j)=>b.classList.toggle('act',j===i));[...nav.children].forEach((t,j)=>t.classList.toggle('sel',j===i));try{Store.setItem('cmTab',i)}catch(_){}}
let k=0;try{k=+Store.getItem('cmTab')||0}catch(_){}show(Math.min(k,boxes.length-1));
})()}catch(e){document.querySelectorAll('.panel>.box').forEach(b=>b.style.display='block')}
