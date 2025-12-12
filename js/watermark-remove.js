(function(){
  const src=document.getElementById('wmrSrc');
  const x=document.getElementById('wmrX');
  const y=document.getElementById('wmrY');
  const w=document.getElementById('wmrW');
  const h=document.getElementById('wmrH');
  const btn=document.getElementById('wmrBtn');
  const clr=document.getElementById('wmrClear');
  const preview=document.getElementById('wmrPreview');
  src?.addEventListener('change',()=>preview.textContent=src.files?.[0]?.name||'Ready');
  clr?.addEventListener('click',()=>{ src.value=''; preview.textContent='Ready'; });
  btn?.addEventListener('click',async()=>{
    const file=src.files?.[0]; if(!file) return;
    const pdfDoc=await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const pages=pdfDoc.getPages();
    const rect={x:Number(x.value||0),y:Number(y.value||0),width:Number(w.value||100),height:Number(h.value||50)};
    pages.forEach(p=>{
      p.drawRectangle({x:rect.x,y:rect.y,width:rect.width,height:rect.height,color:PDFLib.rgb(1,1,1)});
    });
    const bytes=await pdfDoc.save();
    const blob=new Blob([bytes],{type:'application/pdf'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='covered.pdf';
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},3000);
  });
})(); 
