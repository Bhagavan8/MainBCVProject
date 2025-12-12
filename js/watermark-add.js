(function(){
  const src=document.getElementById('wmSrc');
  const text=document.getElementById('wmText');
  const opacity=document.getElementById('wmOpacity');
  const btn=document.getElementById('wmAddBtn');
  const clr=document.getElementById('wmClear');
  const preview=document.getElementById('wmPreview');
  src?.addEventListener('change',()=>preview.textContent=src.files?.[0]?.name||'Ready');
  clr?.addEventListener('click',()=>{ src.value=''; preview.textContent='Ready'; text.value=''; });
  btn?.addEventListener('click',async()=>{
    const file=src.files?.[0]; if(!file) return;
    const pdfDoc=await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const pages=pdfDoc.getPages();
    const font=await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const op=Math.max(0.1,Math.min(1,Number(opacity.value||0.2)));
    const label=(text.value?.trim())||'CONFIDENTIAL';
    pages.forEach(p=>{
      const pageW=p.getWidth(), pageH=p.getHeight();
      p.drawText(label,{
        x:pageW/2- (label.length*12)/2,
        y:pageH/2,
        size:48,
        font,
        color:PDFLib.rgb(0.9,0.1,0.1),
        rotate:PDFLib.degrees(-30),
        opacity:op
      });
    });
    const bytes=await pdfDoc.save();
    const blob=new Blob([bytes],{type:'application/pdf'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='watermarked.pdf';
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},3000);
  });
})(); 
