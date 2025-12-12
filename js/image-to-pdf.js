document.addEventListener('DOMContentLoaded',()=>{
  const imgFiles=document.getElementById('imgFiles');
  const pageSize=document.getElementById('pageSize');
  const orientation=document.getElementById('orientation');
  const margins=document.getElementById('margins');
  const quality=document.getElementById('quality');
  const preview=document.getElementById('preview');
  const convertBtn=document.getElementById('convertBtn');
  const clearBtn=document.getElementById('clearBtn');

  let images=[];

  function renderPreview(){
    if(!images.length){preview.textContent='Preview will appear here after upload';return;}
    const first=images[0];
    const img=new Image();
    img.src=URL.createObjectURL(first.file);
    img.onload=()=>{
      const w=Math.min(320,img.width);
      const h=Math.round(img.height*(w/img.width));
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      preview.innerHTML='';
      preview.appendChild(canvas);
    };
  }

  imgFiles.addEventListener('change',e=>{
    images=Array.from(e.target.files||[]).map((f,i)=>({file:f,idx:i}));
    renderPreview();
  });

  clearBtn.addEventListener('click',()=>{
    imgFiles.value='';images=[];preview.textContent='Preview will appear here after upload';
  });

  convertBtn.addEventListener('click',async()=>{
    if(!images.length) return;
    const {jsPDF}=window.jspdf;
    const ori=orientation.value==='landscape'?'l':'p';
    const size=pageSize.value==='letter'?'letter':'a4';
    const marginMm=Math.max(0,Number(margins.value||10));
    const doc=new jsPDF({orientation:ori,unit:'mm',format:size});
    for(let i=0;i<images.length;i++){
      const f=images[i].file;
      const dataUrl=await readAsDataURL(f);
      const img=await loadImage(dataUrl);
      const pageW=doc.internal.pageSize.getWidth();
      const pageH=doc.internal.pageSize.getHeight();
      const availW=pageW-(marginMm*2);
      const availH=pageH-(marginMm*2);
      const ratio=Math.min(availW/img.width,availH/img.height);
      const drawW=img.width*ratio;
      const drawH=img.height*ratio;
      const x=marginMm+(availW-drawW)/2;
      const y=marginMm+(availH-drawH)/2;
      const format=f.type.includes('png')?'PNG':'JPEG';
      doc.addImage(dataUrl,format,x,y,drawW,drawH,'',quality.value?Number(quality.value):0.9);
      if(i<images.length-1) doc.addPage();
    }
    doc.save('images.pdf');
  });

  function readAsDataURL(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(r.result);
      r.onerror=reject;
      r.readAsDataURL(file);
    });
  }

  function loadImage(src){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=reject;
      img.src=src;
    });
  }
});
