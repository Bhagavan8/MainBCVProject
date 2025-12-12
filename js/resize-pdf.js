document.addEventListener('DOMContentLoaded',()=>{
  const pdfInput=document.getElementById('pdfInput');
  const scalePct=document.getElementById('scalePct');
  const targetSize=document.getElementById('targetSize');
  const resizeBtn=document.getElementById('resizePdfBtn');
  const clearBtn=document.getElementById('clearPdfBtn');
  const preview=document.getElementById('pdfPreview');

  clearBtn.addEventListener('click',()=>{pdfInput.value='';preview.textContent='Ready';});

  resizeBtn.addEventListener('click',async()=>{
    if(!pdfInput.files||!pdfInput.files[0]) return;
    const data=await pdfInput.files[0].arrayBuffer();
    const srcDoc=await PDFLib.PDFDocument.load(data);
    const outDoc=await PDFLib.PDFDocument.create();
    const scale=Number(scalePct.value||80)/100;

    for(const [i,page] of srcDoc.getPages().entries()){
      const {width,height}=page.getSize();
      let tw=width,th=height;
      const t=targetSize.value;
      if(t==='a4'){ tw=PDFLib.mm(210); th=PDFLib.mm(297); }
      if(t==='letter'){ tw=PDFLib.inches(8.5); th=PDFLib.inches(11); }
      if(t==='auto'){ tw=width*scale; th=height*scale; }

      const newPage=outDoc.addPage([tw,th]);
      const embedded=await outDoc.embedPage(page);
      const x=(tw - width*scale)/2;
      const y=(th - height*scale)/2;
      newPage.drawPage(embedded,{x,y,scale});
    }

    const bytes=await outDoc.save();
    const blob=new Blob([bytes],{type:'application/pdf'});
    saveBlob(blob,'resized.pdf');
    preview.textContent='Resized';
  });

  function saveBlob(blob,name){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),0);
  }
});
