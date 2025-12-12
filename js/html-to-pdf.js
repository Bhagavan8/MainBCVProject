(function(){
  const input=document.getElementById('htmlInput');
  const btn=document.getElementById('html2pdfBtn');
  const clr=document.getElementById('html2pdfClear');
  const size=document.getElementById('htmlPageSize');
  const ori=document.getElementById('htmlOrientation');
  const preview=document.getElementById('html2pdfPreview');
  input?.addEventListener('input',()=>preview.textContent=(input.value||'Ready').slice(0,60));
  clr?.addEventListener('click',()=>{ input.value=''; preview.textContent='Ready'; });
  btn?.addEventListener('click',async()=>{
    const html=input.value?.trim(); if(!html) return;
    const tmp=document.createElement('div');
    tmp.style.width='900px'; tmp.style.padding='10px';
    tmp.innerHTML=html; document.body.appendChild(tmp);
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:ori.value==='landscape'?'l':'p',unit:'mm',format:size.value==='letter'?'letter':'a4'});
    const pageW=doc.internal.pageSize.getWidth();
    await doc.html(tmp,{x:10,y:10,width:pageW-20,html2canvas:{scale:2,windowWidth:tmp.offsetWidth}});
    document.body.removeChild(tmp);
    doc.save('html.pdf');
  });
})(); 
