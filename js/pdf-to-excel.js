(function(){
  const src=document.getElementById('pdf2xlSrc');
  const btn=document.getElementById('pdf2xlBtn');
  const clr=document.getElementById('pdf2xlClear');
  const preview=document.getElementById('pdf2xlPreview');
  src?.addEventListener('change',()=>preview.textContent=src.files?.[0]?.name||'Ready');
  clr?.addEventListener('click',()=>{ src.value=''; preview.textContent='Ready'; });
  btn?.addEventListener('click',async()=>{
    const file=src.files?.[0]; if(!file) return;
    const buf=await file.arrayBuffer();
    const loadingTask=pdfjsLib.getDocument({data:buf});
    const pdf=await loadingTask.promise;
    const rows=[];
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);
      const content=await page.getTextContent();
      const lineMap=new Map();
      content.items.forEach(it=>{
        const y=Math.round(it.transform[5]);
        const t=(it.str||'').trim();
        if(!t) return;
        if(!lineMap.has(y)) lineMap.set(y,[]);
        lineMap.get(y).push({x:it.transform[4],t});
      });
      const sortedLines=[...lineMap.entries()].sort((a,b)=>b[0]-a[0]); // top-to-bottom
      sortedLines.forEach(([_, arr])=>{
        arr.sort((a,b)=>a.x-b.x);
        rows.push(arr.map(c=>c.t));
      });
      rows.push([]); // page separator
    }
    const ws=XLSX.utils.aoa_to_sheet(rows);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Extract');
    const out=XLSX.write(wb,{bookType:'xlsx',type:'array'});
    const blob=new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='extracted.xlsx';
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},3000);
  });
})(); 
