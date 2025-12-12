document.addEventListener('DOMContentLoaded',()=>{
  const src=document.getElementById('resizeSrc');
  const w=document.getElementById('targetW');
  const h=document.getElementById('targetH');
  const keep=document.getElementById('keepAspect');
  const q=document.getElementById('resizeQuality');
  const btn=document.getElementById('resizeBtn');
  const clr=document.getElementById('resizeClear');
  const preview=document.getElementById('resizePreview');
  let file=null,imgMeta=null;

  src.addEventListener('change',async e=>{
    file=(e.target.files||[])[0]||null;
    if(!file){preview.textContent='Preview';return;}
    const img=await loadImage(URL.createObjectURL(file));
    imgMeta={w:img.width,h:img.height};
    render(img);
  });
  clr.addEventListener('click',()=>{src.value='';file=null;imgMeta=null;preview.textContent='Preview';w.value='';h.value='';});

  btn.addEventListener('click',async()=>{
    if(!file) return;
    const img=await loadImage(URL.createObjectURL(file));
    const target=computeTarget(img.width,img.height);
    const canvas=document.createElement('canvas');
    canvas.width=target.w;canvas.height=target.h;
    const ctx=canvas.getContext('2d');
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,0,0,target.w,target.h);
    const mime=guessMime(file.name);
    const dataUrl=canvas.toDataURL(mime,Number(q.value||0.9));
    downloadDataURL(dataUrl,makeName(file.name,mime,target));
  });

  function render(img){
    const cv=document.createElement('canvas');
    const tw=img.width>360?360:img.width;
    const th=Math.round(img.height*(tw/img.width));
    cv.width=tw;cv.height=th;
    const ctx=cv.getContext('2d');ctx.drawImage(img,0,0,tw,th);
    preview.innerHTML='';preview.appendChild(cv);
  }

  function computeTarget(ow,oh){
    const kw=Number(w.value||0);const kh=Number(h.value||0);
    if(keep.value==='true'){
      if(kw&&kh){
        const r=Math.min(kw/ow,kh/oh);return {w:Math.max(1,Math.round(ow*r)),h:Math.max(1,Math.round(oh*r))};
      } else if(kw){const r=kw/ow;return {w:kw,h:Math.round(oh*r)};}
      else if(kh){const r=kh/oh;return {w:Math.round(ow*r),h:kh};}
      else return {w:ow,h:oh};
    } else {
      return {w:kw||ow,h:kh||oh};
    }
  }
  function loadImage(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});}
  function guessMime(name){const ext=(name.split('.').pop()||'').toLowerCase();return ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg';}
  function makeName(name,mime,t){const base=name.replace(/\.[^.]+$/,'');const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';return `${base}_${t.w}x${t.h}.${ext}`;}
  function downloadDataURL(dataUrl,filename){const a=document.createElement('a');a.href=dataUrl;a.download=filename;document.body.appendChild(a);a.click();a.remove();}
});
