document.addEventListener('DOMContentLoaded',()=>{
  const src=document.getElementById('srcImage');
  const fmt=document.getElementById('outFormat');
  const qual=document.getElementById('outQuality');
  const convert=document.getElementById('convertImage');
  const clear=document.getElementById('clearImage');
  const preview=document.getElementById('imgPreview');
  let file=null;

  src.addEventListener('change',e=>{file=(e.target.files||[])[0]||null;renderPreview();});
  clear.addEventListener('click',()=>{src.value='';file=null;preview.textContent='Preview';});
  convert.addEventListener('click',async()=>{
    if(!file) return;
    const img=await loadImage(URL.createObjectURL(file));
    const canvas=document.createElement('canvas');
    canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    const q=Number(qual.value||0.9);
    const dataUrl=canvas.toDataURL(fmt.value,q);
    downloadDataURL(dataUrl,makeName(file.name,fmt.value));
  });

  function renderPreview(){
    if(!file){preview.textContent='Preview';return;}
    const img=new Image();
    img.src=URL.createObjectURL(file);
    img.onload=()=>{
      const w=Math.min(360,img.width);
      const h=Math.round(img.height*(w/img.width));
      const c=document.createElement('canvas');
      c.width=w;c.height=h;
      const ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);
      preview.innerHTML='';preview.appendChild(c);
    };
  }

  function loadImage(src){
    return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
  }
  function makeName(name,mime){
    const base=name.replace(/\.[^.]+$/,'');
    const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
    return `${base}.${ext}`;
  }
  function downloadDataURL(dataUrl,filename){
    const a=document.createElement('a');a.href=dataUrl;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  }
});
