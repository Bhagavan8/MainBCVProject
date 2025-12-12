document.addEventListener('DOMContentLoaded',()=>{
  const pdfFile=document.getElementById('pdfFile');
  const mergeMode=document.getElementById('mergeMode');
  const docTitle=document.getElementById('docTitle');
  const convertBtn=document.getElementById('convertDocx');
  const clearBtn=document.getElementById('clearDocx');
  const preview=document.getElementById('wordPreview');

  clearBtn.addEventListener('click',()=>{ pdfFile.value=''; preview.textContent='Ready'; });

  convertBtn.addEventListener('click',async()=>{
    if(!pdfFile.files||!pdfFile.files[0]) return;
    const arrayBuffer=await pdfFile.files[0].arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:arrayBuffer}).promise;
    const paragraphs=[];
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p);
      const text=await page.getTextContent();
      const str=text.items.map(i=>i.str).join(' ').replace(/\s+/g,' ').trim();
      if(str) paragraphs.push({page:p,text:str});
    }
    const doc=new docx.Document({
      sections:[{
        properties:{},
        children:[
          docTitle.value?new docx.Paragraph({text:docTitle.value,heading:docx.HeadingLevel.HEADING_1}):null,
          ...paragraphs.flatMap(pr=>{
            const head=new docx.Paragraph({text:`Page ${pr.page}`,heading:docx.HeadingLevel.HEADING_2});
            const body=new docx.Paragraph({text:pr.text});
            if(mergeMode.value==='pagebreak'){
              return [head,body,new docx.Paragraph({}),new docx.Paragraph({children:[new docx.PageBreak()]})];
            } else {
              return [head,body];
            }
          }).filter(Boolean)
        ]
      }]
    });
    const blob=await docx.Packer.toBlob(doc);
    saveBlob(blob,'converted.docx');
    preview.textContent='Converted';
  });

  function saveBlob(blob,filename){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},0);
  }
});
