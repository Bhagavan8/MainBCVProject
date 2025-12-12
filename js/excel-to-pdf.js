(function(){
  const fileInput=document.getElementById('xlsxFile');
  const sheetSelect=document.getElementById('sheetSelect');
  const preview=document.getElementById('excelHtmlPreview');
  const btn=document.getElementById('convertExcelPdf');
  const clear=document.getElementById('clearExcelPdf');
  const orientation=document.getElementById('xlOrientation');
  const pageSize=document.getElementById('xlPageSize');
  let workbook=null;
  let html='';
  fileInput?.addEventListener('change',async function(){
    const f=this.files&&this.files[0];
    if(!f){ workbook=null; html=''; sheetSelect.innerHTML='<option value=\"\">Select after upload</option>'; preview.textContent='Ready'; return; }
    const buf=await f.arrayBuffer();
    workbook=XLSX.read(buf,{type:'array'});
    sheetSelect.innerHTML='';
    workbook.SheetNames.forEach((n,i)=>{
      const opt=document.createElement('option');
      opt.value=n; opt.textContent=n;
      if(i===0) opt.selected=true;
      sheetSelect.appendChild(opt);
    });
    renderSheet();
  });
  sheetSelect?.addEventListener('change',renderSheet);
  function renderSheet(){
    if(!workbook){ preview.textContent='Ready'; return; }
    const name=sheetSelect.value||workbook.SheetNames[0];
    const ws=workbook.Sheets[name];
    html=XLSX.utils.sheet_to_html(ws);
    preview.innerHTML=html;
  }
  clear?.addEventListener('click',function(){
    fileInput.value=''; preview.textContent='Ready'; sheetSelect.innerHTML='<option value=\"\">Select after upload</option>'; workbook=null; html='';
  });
  btn?.addEventListener('click',async function(){
    if(!html) return;
    const tmp=document.createElement('div');
    tmp.style.width='1000px';
    tmp.style.padding='10px';
    tmp.innerHTML=html;
    document.body.appendChild(tmp);
    const {jsPDF}=window.jspdf;
    const ori=orientation.value==='landscape'?'l':'p';
    const size=pageSize.value==='letter'?'letter':'a4';
    const doc=new jsPDF({orientation:ori,unit:'mm',format:size});
    const pageW=doc.internal.pageSize.getWidth();
    await doc.html(tmp,{x:10,y:10,width:pageW-20,html2canvas:{scale:2,windowWidth:tmp.offsetWidth}});
    document.body.removeChild(tmp);
    doc.save('sheet.pdf');
  });
})(); 
