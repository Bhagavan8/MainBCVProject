(function(){
  const filesInput=document.getElementById('mergeFiles');
  const btn=document.getElementById('mergeBtn');
  const clearBtn=document.getElementById('clearMerge');
  const preview=document.getElementById('mergePreview');
  const outName=document.getElementById('mergeName');
  const orderSel=document.getElementById('mergeOrder');
  let items=[];
  const seen=new Set();
  function fileKey(f){ return [f.name,f.size,f.lastModified].join('|'); }
  function ensureGrid(){
    if(!preview.querySelector('.thumb-grid')){
      preview.innerHTML='';
      const grid=document.createElement('div');
      grid.className='thumb-grid';
      preview.appendChild(grid);
    }
    return preview.querySelector('.thumb-grid');
  }
  async function addItems(files){
    const grid=ensureGrid();
    for(const f of files){
      const key=fileKey(f);
      if(seen.has(key)) continue;
      const buf=await f.arrayBuffer();
      const loadingTask=pdfjsLib.getDocument({data:buf});
      const doc=await loadingTask.promise;
      const page=await doc.getPage(1);
      const viewport=page.getViewport({scale:1});
      const scale=140/viewport.width;
      const vp=page.getViewport({scale});
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d');
      canvas.width=vp.width;
      canvas.height=vp.height;
      await page.render({canvasContext:ctx,viewport:vp}).promise;
      const item={file:f,name:f.name,pages:doc.numPages,canvas,key};
      items.push(item);
      seen.add(key);
      const card=document.createElement('div');
      card.className='thumb-item';
      const thumb=document.createElement('div');
      thumb.className='thumb';
      thumb.appendChild(canvas);
      const close=document.createElement('button');
      close.className='thumb-close';
      close.textContent='×';
      const meta=document.createElement('div');
      meta.className='thumb-meta';
      const nameEl=document.createElement('div');
      nameEl.className='thumb-name';
      nameEl.textContent=f.name;
      const pagesEl=document.createElement('div');
      pagesEl.className='thumb-pages';
      pagesEl.textContent=doc.numPages+' pages';
      const actions=document.createElement('div');
      actions.className='thumb-actions';
      const up=document.createElement('button');
      up.className='small-btn';
      up.textContent='Up';
      const down=document.createElement('button');
      down.className='small-btn';
      down.textContent='Down';
      actions.appendChild(up);
      actions.appendChild(down);
      meta.appendChild(nameEl);
      meta.appendChild(pagesEl);
      meta.appendChild(actions);
      card.appendChild(thumb);
      card.appendChild(close);
      card.appendChild(meta);
      grid.appendChild(card);
      up.addEventListener('click',function(){
        const idx=items.indexOf(item);
        if(idx>0){
          const tmp=items[idx-1];
          items[idx-1]=items[idx];
          items[idx]=tmp;
          rebuildGrid();
        }
      });
      down.addEventListener('click',function(){
        const idx=items.indexOf(item);
        if(idx<items.length-1){
          const tmp=items[idx+1];
          items[idx+1]=items[idx];
          items[idx]=tmp;
          rebuildGrid();
        }
      });
      close.addEventListener('click',function(){
        items=items.filter(it=>it!==item);
        seen.delete(item.key);
        rebuildGrid();
      });
    }
  }
  function rebuildGrid(){
    preview.innerHTML='';
    const grid=document.createElement('div');
    grid.className='thumb-grid';
    preview.appendChild(grid);
    for(const item of items){
      const card=document.createElement('div');
      card.className='thumb-item';
      const thumb=document.createElement('div');
      thumb.className='thumb';
      thumb.appendChild(item.canvas);
      const close=document.createElement('button');
      close.className='thumb-close';
      close.textContent='×';
      const meta=document.createElement('div');
      meta.className='thumb-meta';
      const nameEl=document.createElement('div');
      nameEl.className='thumb-name';
      nameEl.textContent=item.name;
      const pagesEl=document.createElement('div');
      pagesEl.className='thumb-pages';
      pagesEl.textContent=item.pages+' pages';
      const actions=document.createElement('div');
      actions.className='thumb-actions';
      const up=document.createElement('button');
      up.className='small-btn';
      up.textContent='Up';
      const down=document.createElement('button');
      down.className='small-btn';
      down.textContent='Down';
      actions.appendChild(up);
      actions.appendChild(down);
      meta.appendChild(nameEl);
      meta.appendChild(pagesEl);
      meta.appendChild(actions);
      card.appendChild(thumb);
      card.appendChild(close);
      card.appendChild(meta);
      grid.appendChild(card);
      up.addEventListener('click',function(){
        const idx=items.indexOf(item);
        if(idx>0){
          const tmp=items[idx-1];
          items[idx-1]=items[idx];
          items[idx]=tmp;
          rebuildGrid();
        }
      });
      down.addEventListener('click',function(){
        const idx=items.indexOf(item);
        if(idx<items.length-1){
          const tmp=items[idx+1];
          items[idx+1]=items[idx];
          items[idx]=tmp;
          rebuildGrid();
        }
      });
      close.addEventListener('click',function(){
        items=items.filter(it=>it!==item);
        seen.delete(item.key);
        rebuildGrid();
      });
    }
  }
  filesInput?.addEventListener('change',async function(){
    const files=Array.from(filesInput.files||[]);
    if(!files.length){ if(!items.length){ preview.textContent='Selected files will appear here'; } return; }
    await addItems(files);
  });
  clearBtn?.addEventListener('click',function(){
    if(filesInput) filesInput.value='';
    items=[];
    seen.clear();
    preview.textContent='Selected files will appear here';
  });
  const mergeAdd=document.getElementById('mergeAdd');
  const mergeActionClear=document.getElementById('mergeActionClear');
  mergeAdd?.addEventListener('click',()=>filesInput?.click());
  mergeActionClear?.addEventListener('click',()=>clearBtn?.click());
  btn?.addEventListener('click',async function(){
    if(!items.length) return;
    const order=orderSel?.value||'time';
    let src=items.slice();
    if(order==='name') src=src.sort((a,b)=>a.name.localeCompare(b.name));
    const pdfDoc=await PDFLib.PDFDocument.create();
    for(const it of src){
      const buf=await it.file.arrayBuffer();
      const srcDoc=await PDFLib.PDFDocument.load(buf);
      const pages=await pdfDoc.copyPages(srcDoc,srcDoc.getPageIndices());
      pages.forEach(p=>pdfDoc.addPage(p));
    }
    const bytes=await pdfDoc.save();
    const blob=new Blob([bytes],{type:'application/pdf'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=(outName?.value&&outName.value.trim())?outName.value.trim():'merged.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},3000);
  });
})(); 
