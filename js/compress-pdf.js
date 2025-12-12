(function(){
  const src=document.getElementById('compressSrc');
  const btn=document.getElementById('compressBtn');
  const clr=document.getElementById('compressClear');
  const preview=document.getElementById('compressPreview');
  const quality=document.getElementById('compressQuality');
  const dpi=document.getElementById('compressDpi');
  src?.addEventListener('change',()=>preview.textContent=src.files?.[0]?.name||'Ready');
  clr?.addEventListener('click',()=>{ src.value=''; preview.textContent='Ready'; });
  btn?.addEventListener('click',async()=>{
    const file=src.files?.[0]; if(!file) return;
    const buf=await file.arrayBuffer();
    const loadingTask=pdfjsLib.getDocument({data:buf});
    const pdf=await loadingTask.promise;
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'p',unit:'pt',format:'a4'});
    const q=Number(quality.value||0.75);
    const targetDpi=Math.max(72,Math.min(200,Number(dpi.value||120)));
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const viewport=page.getViewport({scale:1});
      const scale=targetDpi/72;
      const vp=page.getViewport({scale});
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d');
      canvas.width=vp.width; canvas.height=vp.height;
      await page.render({canvasContext:ctx,viewport:vp}).promise;
      const dataUrl=canvas.toDataURL('image/jpeg',q);
      if(i>1) doc.addPage();
      const pageW=doc.internal.pageSize.getWidth();
      const pageH=doc.internal.pageSize.getHeight();
      const ratio=Math.min(pageW/canvas.width,pageH/canvas.height);
      const drawW=canvas.width*ratio, drawH=canvas.height*ratio;
      const x=(pageW-drawW)/2, y=(pageH-drawH)/2;
      doc.addImage(dataUrl,'JPEG',x,y,drawW,drawH);
    }
    doc.save('compressed.pdf');
  });
})(); 
