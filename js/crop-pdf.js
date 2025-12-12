(function(){
  const src=document.getElementById('cropSrc');
  const btn=document.getElementById('cropBtn');
  const clr=document.getElementById('cropClear');
  const canvas=document.getElementById('cropCanvas');
  const preview=document.getElementById('cropPreview');
  const previewWidth=document.getElementById('cropPreviewWidth');
  const pageInfo=document.getElementById('cropPageInfo');
  const xInp=document.getElementById('cropX');
  const yInp=document.getElementById('cropY');
  const wInp=document.getElementById('cropW');
  const hInp=document.getElementById('cropH');
  const which=document.getElementById('cropPage');
  const ctx=canvas?.getContext('2d');
  let pageW=0,pageH=0,scale=1;
  let dragging=false,startX=0,startY=0,curX=0,curY=0;
  let rectPdf=null;
  let bgCanvas=null;
  function clearOverlay(){ if(!ctx) return; ctx.clearRect(0,0,canvas.width,canvas.height); }
  function drawRect(){ if(!ctx) return; if(bgCanvas){ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(bgCanvas,0,0); } ctx.strokeStyle='#ef4444'; ctx.lineWidth=2; const x=Math.min(startX,curX), y=Math.min(startY,curY); const w=Math.abs(curX-startX), h=Math.abs(curY-startY); ctx.strokeRect(x,y,w,h); }
  function toPdfCoords(cx,cy){ const px=cx/scale; const py=pageH-(cy/scale); return {px,py}; }
  async function renderFirst(ab){ if(!ctx) return; const loadingTask=pdfjsLib.getDocument({data:ab}); const doc=await loadingTask.promise; const page=await doc.getPage(1); const vp=page.getViewport({scale:1}); const desiredW=Math.max(240, Math.min(800, Number(previewWidth?.value||480))); scale=desiredW/vp.width; const vps=page.getViewport({scale}); canvas.width=Math.floor(vps.width); canvas.height=Math.floor(vps.height); pageW=vp.width; pageH=vp.height; bgCanvas=document.createElement('canvas'); const bgctx=bgCanvas.getContext('2d'); bgCanvas.width=vps.width; bgCanvas.height=vps.height; await page.render({canvasContext:bgctx,viewport:vps}).promise; ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(bgCanvas,0,0); const mmW=Math.round(vp.width*0.3527778); const mmH=Math.round(vp.height*0.3527778); if(pageInfo){ pageInfo.textContent='Page size: '+Math.round(vp.width)+' pt × '+Math.round(vp.height)+' pt (~ '+mmW+' mm × '+mmH+' mm)'; } }
  function updatePdfRect(){ const s=toPdfCoords(startX,startY); const c=toPdfCoords(curX,curY); const x=Math.max(0, Math.min(s.px,c.px)); const y=Math.max(0, Math.min(s.py,c.py)); const w=Math.min(pageW-x, Math.abs(c.px - s.px)); const h=Math.min(pageH-y, Math.abs(c.py - s.py)); rectPdf={x,y,w,h}; xInp.value=Math.floor(x); yInp.value=Math.floor(y); wInp.value=Math.floor(Math.max(10,w)); hInp.value=Math.floor(Math.max(10,h)); }
  canvas?.addEventListener('mousedown',e=>{ const r=canvas.getBoundingClientRect(); startX=(e.clientX-r.left); startY=(e.clientY-r.top); dragging=true; curX=startX; curY=startY; drawRect(); updatePdfRect(); });
  canvas?.addEventListener('mousemove',e=>{ if(!dragging) return; const r=canvas.getBoundingClientRect(); curX=(e.clientX-r.left); curY=(e.clientY-r.top); drawRect(); updatePdfRect(); });
  canvas?.addEventListener('mouseup',()=>{ dragging=false; });
  canvas?.addEventListener('mouseleave',()=>{ dragging=false; });
  canvas?.addEventListener('touchstart',e=>{ const t=e.touches[0]; const r=canvas.getBoundingClientRect(); startX=(t.clientX-r.left); startY=(t.clientY-r.top); dragging=true; curX=startX; curY=startY; drawRect(); updatePdfRect(); });
  canvas?.addEventListener('touchmove',e=>{ if(!dragging) return; const t=e.touches[0]; const r=canvas.getBoundingClientRect(); curX=(t.clientX-r.left); curY=(t.clientY-r.top); drawRect(); updatePdfRect(); });
  canvas?.addEventListener('touchend',()=>{ dragging=false; });
  clr?.addEventListener('click',()=>{ if(src) src.value=''; if(ctx){ ctx.clearRect(0,0,canvas.width,canvas.height); } preview.textContent='Ready'; xInp.value='0'; yInp.value='0'; wInp.value='300'; hInp.value='300'; });
  src?.addEventListener('change',async()=>{ preview.textContent=src.files?.[0]?.name||'Ready'; const f=src.files?.[0]; if(f){ const ab=await f.arrayBuffer(); await renderFirst(ab); } });
  previewWidth?.addEventListener('input',async()=>{ const f=src?.files?.[0]; if(f){ const ab=await f.arrayBuffer(); await renderFirst(ab); } });
  btn?.addEventListener('click',async()=>{
    const f=src.files?.[0]; if(!f) return;
    const ab=await f.arrayBuffer();
    const pdfDoc=await PDFLib.PDFDocument.load(ab);
    const pages=pdfDoc.getPages();
    let x=Math.max(0,Number(xInp.value||0));
    let y=Math.max(0,Number(yInp.value||0));
    let w=Math.max(10,Number(wInp.value||300));
    let h=Math.max(10,Number(hInp.value||300));
    if(rectPdf){ x=Math.floor(rectPdf.x); y=Math.floor(rectPdf.y); w=Math.floor(rectPdf.w); h=Math.floor(rectPdf.h); }
    x=Math.min(x, Math.max(0, pageW-1));
    y=Math.min(y, Math.max(0, pageH-1));
    w=Math.min(w, Math.max(10, pageW - x));
    h=Math.min(h, Math.max(10, pageH - y));
    const all=which.value==='all';
    const targets=all?pages:[pages[0]];
    targets.forEach(p=>{ p.setCropBox(x,y,w,h); });
    const bytes=await pdfDoc.save();
    const blob=new Blob([bytes],{type:'application/pdf'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='cropped.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},3000);
  });
})(); 
