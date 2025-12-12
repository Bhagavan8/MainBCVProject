(function(){
  const fileInput=document.getElementById('docxFile');
  const preview=document.getElementById('wordHtmlPreview');
  const btn=document.getElementById('convertWordPdf');
  const clear=document.getElementById('clearWordPdf');
  const pageSize=document.getElementById('wdPageSize');
  const orientation=document.getElementById('wdOrientation');
  const margins=document.getElementById('wdMargins');
  let html='';
  fileInput?.addEventListener('change',async function(){
    const f=this.files&&this.files[0];
    if(!f){ preview.textContent='Ready'; html=''; return; }
    const buf=await f.arrayBuffer();
    const res=await window.mammoth.convertToHtml({arrayBuffer:buf});
    html=res.value||'';
    preview.innerHTML=html||'No content';
  });
  clear?.addEventListener('click',function(){
    fileInput.value=''; preview.textContent='Ready'; html='';
  });
  btn?.addEventListener('click',async function(){
    if(!html) return;
    const tmp=document.createElement('div');
    tmp.style.width='800px';
    tmp.style.padding='10px';
    tmp.innerHTML=html;
    document.body.appendChild(tmp);
    const {jsPDF}=window.jspdf;
    const ori=orientation.value==='landscape'?'l':'p';
    const size=pageSize.value==='letter'?'letter':'a4';
    const marginMm=Math.max(0,Number(margins.value||10));
    const doc=new jsPDF({orientation:ori,unit:'mm',format:size});
    const pageW=doc.internal.pageSize.getWidth();
    await doc.html(tmp,{x:marginMm,y:marginMm,width:pageW-(marginMm*2),html2canvas:{scale:2,windowWidth:tmp.offsetWidth}});
    document.body.removeChild(tmp);
    doc.save('document.pdf');
  });
})();
