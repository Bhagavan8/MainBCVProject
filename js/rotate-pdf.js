(function(){
  const src=document.getElementById('rotateSrc');
  const btn=document.getElementById('rotateBtn');
  const clr=document.getElementById('rotateClear');
  const deg=document.getElementById('rotateDeg');
  const preview=document.getElementById('rotatePreview');
  src?.addEventListener('change',()=>preview.textContent=src.files?.[0]?.name||'Ready');
  clr?.addEventListener('click',()=>{ src.value=''; preview.textContent='Ready'; });
  btn?.addEventListener('click',async()=>{
    const file=src.files?.[0]; if(!file) return;
    const pdfDoc=await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const angle=PDFLib.degrees(Number(deg.value||90));
    pdfDoc.getPages().forEach(p=>p.setRotation(angle));
    const bytes=await pdfDoc.save();
    const blob=new Blob([bytes],{type:'application/pdf'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='rotated.pdf';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},3000);
  });
})(); 
