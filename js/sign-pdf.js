(function(){
  const src=document.getElementById('signSrc');
  const pad=document.getElementById('signPad');
  const place=document.getElementById('signPlace');
  const btn=document.getElementById('signBtn');
  const clr=document.getElementById('signClear');
  const size=document.getElementById('signSize');
  const which=document.getElementById('signPage');
  const pageNumInp=document.getElementById('signPageNum');
  const modeSel=document.getElementById('signMode');
  const padGroup=document.getElementById('signPadGroup');
  const typeControls=document.getElementById('signTypeControls');
  const typeGroup=document.getElementById('signTypeGroup');
  const typeCanvas=document.getElementById('signTypeCanvas');
  const typeCtx=typeCanvas?.getContext('2d');
  const typeText=document.getElementById('signText');
  const typeStyle=document.getElementById('signStyle');
  const typeColor=document.getElementById('signColor');
  const previewWidth=document.getElementById('signPreviewWidth');
  const pageInfo=document.getElementById('signPageInfo');
  const preview=document.getElementById('signPreview');
  const ctx=pad?.getContext('2d');
  let drawing=false;
  let placeCtx=place?.getContext('2d');
  let placeScale=1;
  let pageW=0,pageH=0;
  let placePos=null;
  let lastAb=null;
  let placeBg=null;
  if(ctx){ ctx.strokeStyle='#111827'; ctx.lineWidth=2; }
  function pos(e){ const r=pad.getBoundingClientRect(); return {x:(e.clientX||e.touches?.[0]?.clientX)-r.left,y:(e.clientY||e.touches?.[0]?.clientY)-r.top}; }
  pad?.addEventListener('mousedown',e=>{drawing=true; const p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y);});
  pad?.addEventListener('mousemove',e=>{ if(!drawing) return; const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke();});
  pad?.addEventListener('mouseup',()=>drawing=false);
  pad?.addEventListener('mouseleave',()=>drawing=false);
  pad?.addEventListener('touchstart',e=>{drawing=true; const p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y);});
  pad?.addEventListener('touchmove',e=>{ if(!drawing) return; const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke();});
  pad?.addEventListener('touchend',()=>drawing=false);
  clr?.addEventListener('click',()=>{ if(ctx){ ctx.clearRect(0,0,pad.width,pad.height); } src.value=''; preview.textContent='Ready'; if(placeCtx&&place){ placeCtx.clearRect(0,0,place.width,place.height); } placePos=null; });
  function placePosCanvas(e){ const r=place.getBoundingClientRect(); const cx=(e.clientX||e.touches?.[0]?.clientX)-r.left; const cy=(e.clientY||e.touches?.[0]?.clientY)-r.top; return {cx,cy}; }
  function drawMarker(cx,cy){ if(!placeCtx) return; if(placeBg){ placeCtx.clearRect(0,0,place.width,place.height); placeCtx.drawImage(placeBg,0,0); } placeCtx.strokeStyle='#2563eb'; placeCtx.lineWidth=2; placeCtx.beginPath(); placeCtx.arc(cx,cy,6,0,Math.PI*2); placeCtx.stroke(); placeCtx.beginPath(); placeCtx.moveTo(cx-10,cy); placeCtx.lineTo(cx+10,cy); placeCtx.moveTo(cx,cy-10); placeCtx.lineTo(cx,cy+10); placeCtx.stroke(); }
  async function renderPlacement(ab, pageIndex){ if(!placeCtx||!place) return; const loadingTask=pdfjsLib.getDocument({data:ab}); const doc=await loadingTask.promise; const clamp=Math.min(Math.max(1, pageIndex||1), doc.numPages); const page=await doc.getPage(clamp); const vp=page.getViewport({scale:1}); const desiredW=Math.max(240, Math.min(800, Number(previewWidth?.value||360))); const sc=desiredW/vp.width; const vps=page.getViewport({scale:sc}); place.width=Math.floor(vps.width); place.height=Math.floor(vps.height); placeBg=document.createElement('canvas'); const bgctx=placeBg.getContext('2d'); placeBg.width=vps.width; placeBg.height=vps.height; await page.render({canvasContext:bgctx,viewport:vps}).promise; placeCtx.clearRect(0,0,place.width,place.height); placeCtx.drawImage(placeBg,0,0); placeScale=sc; pageW=vp.width; pageH=vp.height; const mmW=Math.round(vp.width*0.3527778); const mmH=Math.round(vp.height*0.3527778); if(pageInfo){ pageInfo.textContent='Page size: '+Math.round(vp.width)+' pt × '+Math.round(vp.height)+' pt (~ '+mmW+' mm × '+mmH+' mm)'; } drawOverlay(); }
  place?.addEventListener('click',e=>{ if(!placeCtx||!place) return; const {cx,cy}=placePosCanvas(e); drawMarker(cx,cy); const px=cx/placeScale; const py=pageH-(cy/placeScale); placePos={x:px,y:py}; });
  place?.addEventListener('click',()=>{ drawOverlay(); });
  place?.addEventListener('wheel',e=>{ const val=Math.max(40,Number(size.value||160)); const next=val+(e.deltaY>0?-10:10); size.value=Math.max(20, Math.min(600, next)); drawOverlay(); });
  src?.addEventListener('change',async()=>{ preview.textContent=src.files?.[0]?.name||'Ready'; const f=src.files?.[0]; if(f){ lastAb=await f.arrayBuffer(); const p=(which.value==='specific')?Number(pageNumInp.value||1):1; renderPlacement(lastAb,p); } });
  which?.addEventListener('change',()=>{ if(lastAb){ const p=(which.value==='specific')?Number(pageNumInp.value||1):1; renderPlacement(lastAb,p); } });
  pageNumInp?.addEventListener('input',()=>{ if(lastAb){ const p=(which.value==='specific')?Number(pageNumInp.value||1):1; renderPlacement(lastAb,p); } });
  previewWidth?.addEventListener('input',()=>{ if(lastAb){ const p=(which.value==='specific')?Number(pageNumInp.value||1):1; renderPlacement(lastAb,p); } });
  modeSel?.addEventListener('change',()=>{ const m=modeSel.value; const draw=m==='draw'; padGroup.style.display=draw?'':'none'; typeControls.style.display=draw?'none':''; typeGroup.style.display=draw?'none':''; });
  function drawOverlay(){
    if(!placeCtx||!placeBg) return;
    placeCtx.clearRect(0,0,place.width,place.height);
    placeCtx.drawImage(placeBg,0,0);
    const desiredH=Math.max(40,Number(size.value||160));
    const m=modeSel?.value||'draw';
    let srcCanvas=null;
    if(m==='type'){ renderTyped(); srcCanvas=typeCanvas; }
    else { srcCanvas=pad; }
    if(!srcCanvas) return;
    const overlayH=desiredH*placeScale;
    const ratio=overlayH/Math.max(1,srcCanvas.height);
    const overlayW=Math.max(1,Math.floor(srcCanvas.width*ratio));
    let drawX= (place.width-overlayW)/2;
    let drawY= (place.height-overlayH)/2;
    if(placePos){
      const cx=placePos.x*placeScale;
      const cy=(pageH-placePos.y)*placeScale;
      drawX=Math.max(0, Math.min(place.width-overlayW, cx));
      drawY=Math.max(0, Math.min(place.height-overlayH, cy-overlayH));
    }
    try{ placeCtx.globalAlpha=0.85; placeCtx.drawImage(srcCanvas, drawX, drawY, overlayW, overlayH); placeCtx.globalAlpha=1; }catch(_){}
    const signSizeInfo=document.getElementById('signSizeInfo');
    if(signSizeInfo){
      const ptH=Math.round(desiredH);
      const ptW=Math.round((srcCanvas.width/srcCanvas.height)*desiredH);
      const mmH=Math.round(ptH*0.3527778);
      const mmW=Math.round(ptW*0.3527778);
      signSizeInfo.textContent='Signature size preview: '+ptW+' pt × '+ptH+' pt (~ '+mmW+' mm × '+mmH+' mm)';
    }
  }
  size?.addEventListener('input',drawOverlay);
  typeText?.addEventListener('input',drawOverlay);
  typeStyle?.addEventListener('change',drawOverlay);
  modeSel?.addEventListener('change',drawOverlay);
  async function ensureFont(fam){ try{ if(window?.document?.fonts){ await document.fonts.load('48px '+fam); } }catch(e){} }
  async function renderTyped(){
    if(!typeCtx) return;
    const text=(typeText.value||'').trim()||'Your Name';
    const style=(typeStyle.value||'simple');
    const baseColor=(typeColor?.value||'#111827');
    const h=120; typeCanvas.height=h; typeCanvas.width=600;
    typeCtx.clearRect(0,0,typeCanvas.width,typeCanvas.height);
    let font='48px Helvetica';
    let color=baseColor;
    if(style==='simple'){ font='bold 48px Helvetica'; }
    else if(style==='elegant'){ font='italic 48px Georgia, serif'; color='#0b5ed7'; }
    else if(style==='boxed'){ font='600 42px "Segoe UI", Arial'; }
    else if(style==='cursive1'){ font='48px "Pacifico", cursive'; await ensureFont('Pacifico'); }
    else if(style==='cursive2'){ font='54px "Great Vibes", cursive'; await ensureFont('Great Vibes'); }
    else if(style==='cursive3'){ font='52px "Dancing Script", cursive'; await ensureFont('Dancing Script'); }
    else if(style==='cursive4'){ font='56px "Sacramento", cursive'; await ensureFont('Sacramento'); }
    else if(style==='cursive5'){ font='52px "Satisfy", cursive'; await ensureFont('Satisfy'); }
    else if(style==='underline'){ font='600 46px "Segoe UI", Arial'; }
    else if(style==='pill'){ font='600 42px "Segoe UI", Arial'; }
    else if(style==='seal'){ font='600 40px "Segoe UI", Arial'; }
    typeCtx.fillStyle=color;
    typeCtx.font=font;
    typeCtx.textBaseline='middle';
    const padX=24, y=h/2;
    const metrics=typeCtx.measureText(text);
    const textW=Math.ceil(metrics.width);
    let canvasW=textW+padX*2;
    if(style==='pill' || style==='boxed') canvasW=Math.max(canvasW, textW+60);
    if(style==='seal') canvasW=Math.max(canvasW, 220);
    typeCanvas.width=Math.max(240, Math.min(800, canvasW));
    typeCtx.clearRect(0,0,typeCanvas.width,typeCanvas.height);
    if(style==='pill'){
      const r=36;
      typeCtx.fillStyle='#111827';
      typeCtx.beginPath();
      typeCtx.moveTo(r, y-36);
      typeCtx.lineTo(typeCanvas.width-r, y-36);
      typeCtx.arc(typeCanvas.width-r, y, r, -Math.PI/2, Math.PI/2);
      typeCtx.lineTo(r, y+36);
      typeCtx.arc(r, y, r, Math.PI/2, -Math.PI/2);
      typeCtx.fill();
      typeCtx.fillStyle='#ffffff';
    } else if(style==='seal'){
      const cx=typeCanvas.width/2;
      const radius=Math.min(100, Math.floor(typeCanvas.width/2)-20);
      typeCtx.fillStyle='#dc2626';
      typeCtx.beginPath();
      typeCtx.arc(cx, y, radius, 0, Math.PI*2);
      typeCtx.fill();
      typeCtx.fillStyle='#ffffff';
    } else if(style==='boxed'){
      typeCtx.strokeStyle='#9ca3af'; typeCtx.lineWidth=2;
      typeCtx.strokeRect(12, y-36, typeCanvas.width-24, 72);
      typeCtx.fillStyle=color;
    }
    typeCtx.font=font;
    typeCtx.textBaseline='middle';
    let tx=padX;
    if(style==='seal'){ const tw=typeCtx.measureText(text).width; tx=(typeCanvas.width-tw)/2; }
    typeCtx.fillText(text, tx, y);
    if(style==='underline'){
      typeCtx.strokeStyle=color; typeCtx.lineWidth=3;
      typeCtx.beginPath();
      typeCtx.moveTo(tx, y+28);
      typeCtx.lineTo(tx+typeCtx.measureText(text).width, y+28);
      typeCtx.stroke();
    }
  }
  typeText?.addEventListener('input',renderTyped);
  typeStyle?.addEventListener('change',renderTyped);
  typeColor?.addEventListener('input',renderTyped);
  // initialize typed preview
  renderTyped();
  btn?.addEventListener('click',async()=>{
    try{
      const file=src.files?.[0]; if(!file) return;
      let imgData=null;
      const m=modeSel?.value||'draw';
      if(m==='type'){ renderTyped(); }
      else { imgData=pad.toDataURL('image/png'); }
      const pdfDoc=await PDFLib.PDFDocument.load(await file.arrayBuffer());
      const pages=pdfDoc.getPages();
      const desiredH=Math.max(40,Number(size.value||160));
      let png=null, dims=null, scale=1, drawW=0, drawH=0;
      let useImage=(m!=='type');
      if(useImage){
        const b64=imgData.split(',')[1]||'';
        const bin=atob(b64);
        const bytesArr=new Uint8Array(bin.length);
        for(let i=0;i<bin.length;i++){ bytesArr[i]=bin.charCodeAt(i); }
        try{ png=await pdfDoc.embedPng(bytesArr); dims=png.scale(1); scale=desiredH/dims.height; drawW=dims.width*scale; drawH=dims.height*scale; if(!isFinite(drawW)||!isFinite(drawH)||drawW<=0||drawH<=0) useImage=false; }catch(e){ useImage=false; }
      }
      const mode=which.value;
      let targets=pages;
      if(mode==='all'){ targets=pages; }
      else if(mode==='specific'){ const idx=Math.max(1,Number(pageNumInp.value||1)); const i=Math.min(idx,pages.length)-1; targets=[pages[i]]; }
      else { targets=[pages[0]]; }
      const first=targets[0];
      const pageW0=first.getWidth(), pageH0=first.getHeight();
      const crop0=first.getCropBox? first.getCropBox() : {x:0,y:0,width:pageW0,height:pageH0};
      if(useImage && drawW > (crop0.width-72)){ scale=(crop0.width-72)/dims.width; drawW=dims.width*scale; drawH=dims.height*scale; }
      function hexToRgb(h){ const r=parseInt(h.slice(1,3),16)/255; const g=parseInt(h.slice(3,5),16)/255; const b=parseInt(h.slice(5,7),16)/255; return PDFLib.rgb(r,g,b); }
      const textVal=(typeText?.value||'').trim()||'Your Name';
      const styleVal=(typeStyle?.value||'simple');
      const hexVal=(typeColor?.value||'#111827');
      const colorVal=hexToRgb(hexVal);
      const sizePt=Math.max(18, desiredH*0.8);
      let font=null;
      if(!useImage){
        let fontName=PDFLib.StandardFonts.Helvetica;
        if(styleVal==='elegant'||styleVal?.startsWith('cursive')) fontName=PDFLib.StandardFonts.TimesItalic;
        else if(styleVal==='boxed'||styleVal==='pill'||styleVal==='seal'||styleVal==='simple') fontName=PDFLib.StandardFonts.HelveticaBold;
        font=await pdfDoc.embedFont(fontName);
      }
      targets.forEach(p=>{
        const pageW=p.getWidth(), pageH=p.getHeight();
        const crop=p.getCropBox? p.getCropBox() : {x:0,y:0,width:pageW,height:pageH};
        let x=(crop.x||0)+((crop.width-drawW)/2), y=(crop.y||0)+((crop.height-drawH)/2);
        if(placePos){
          const ox=crop.x||0, oy=crop.y||0, ow=crop.width||pageW, oh=crop.height||pageH;
          x=Math.max(ox, Math.min(ox+ow-(useImage?drawW:0), ox + placePos.x));
          y=Math.max(oy, Math.min(oy+oh-(useImage?drawH:0), oy + placePos.y));
        }
        if(useImage && png){
          p.drawImage(png,{x,y,width:drawW,height:drawH,opacity:0.95});
        } else {
          p.drawText(textVal,{x,y,size:sizePt,font,color:colorVal});
        }
      });
      const bytes=await pdfDoc.save();
      const blob=new Blob([bytes],{type:'application/pdf'});
      const original=(src.files?.[0]?.name||'document.pdf');
      const dlName=original.toLowerCase().endsWith('.pdf') ? original.replace(/\.pdf$/i,'-signed.pdf') : 'signed.pdf';
      function safeDownload(b,name){
        try{
          const url=URL.createObjectURL(b);
          const a=document.createElement('a');
          a.href=url; a.download=name; a.rel='noopener'; a.target='_blank';
          document.body.appendChild(a);
          a.click();
          setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){} a.remove(); },1000);
        }catch(e){
          try{
            const url=URL.createObjectURL(b);
            window.open(url,'_blank','noopener');
          }catch(_){}
        }
      }
      safeDownload(blob, dlName);
      preview.textContent='Signed and downloaded';
    }catch(e){
      preview.textContent='Failed to apply signature';
    }
  });
})(); 
