// 版式检查：量每页的留白比例、细节密度和汉字数，并生成模糊截图。只报告，不设字数上限。
// 用法：node tools/layout-check.js <deck.html 的路径> <页数> [输出目录，默认 ./layout-check]
// 适用条件：HTML 幻灯片，用 URL 的 #1、#2… 切页；当前页带 .on 类。
// 对照值（图库绿色体系、评分 ≥4 的 151 页，缩到 640×360 后测）：留白 60%–79%（中位 71%），细节密度 4.0–6.6（中位 5.2）。
//   留白 = 亮度 ≥245 的像素占比；细节密度 = 横向相邻像素亮度差 >40 的占比，近似"笔画和边线有多少"。
// 需要 playwright（云端环境已预装；本地先 npm i playwright）。
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
(async()=>{
  const [file,n,out='layout-check']=process.argv.slice(2);
  if(!file||!n){console.error('用法：node layout-check.js <deck.html> <页数> [输出目录]');process.exit(2)}
  fs.mkdirSync(out,{recursive:true});
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
  const m=await b.newPage({viewport:{width:640,height:360}});await m.setContent('<canvas id=c width=640 height=360></canvas>');
  const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',x=>{if(['error','assert'].includes(x.type()))errs.push(x.text())});
  let low=0;
  for(let i=1;i<=+n;i++){
    await p.goto('file://'+path.resolve(file)+'?lc='+i+'#'+i);await p.waitForTimeout(600);
    const cjk=await p.evaluate(()=>{const s=document.querySelector('.on')||document.body;let c=0;const w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);
      for(let x;x=w.nextNode();){if(!x.parentElement.closest('style,script'))c+=(x.nodeValue.match(/[一-鿿]/g)||[]).length}return c});
    const png=await p.screenshot({path:path.join(out,`p${i}.png`)});
    const r=await m.evaluate(async b64=>{const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();const c=document.getElementById('c'),g=c.getContext('2d');g.drawImage(img,0,0,640,360);
      const d=g.getImageData(0,0,640,360).data;let white=0,edge=0,prev=0;
      for(let y=0;y<360;y++)for(let x=0;x<640;x++){const k=(y*640+x)*4,l=Math.round(.299*d[k]+.587*d[k+1]+.114*d[k+2]);if(l>=245)white++;if(x>0&&Math.abs(l-prev)>40)edge++;prev=l}
      return {white:white/230400*100,edge:edge/(639*360)*100}},png.toString('base64'));
    const thin=r.edge<4.0||r.white>79;if(thin)low++;
    console.log(`第 ${i} 页　留白 ${r.white.toFixed(1)}%（原图 60–79）　细节密度 ${r.edge.toFixed(1)}（原图 4.0–6.6）　汉字 ${cjk}　${thin?'偏空':'在范围内'}`);
    await p.addStyleTag({content:'html{filter:blur(9px)}'});await p.screenshot({path:path.join(out,`p${i}-blur.png`)});
  }
  if(errs.length)console.log('页面报错：',errs);
  await b.close();process.exit(low||errs.length?1:0);
})();
