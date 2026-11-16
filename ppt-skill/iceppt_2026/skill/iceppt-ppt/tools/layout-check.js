// 版式检查：统计每页汉字数，并生成模糊截图。
// 用法：node tools/layout-check.js <deck.html 的路径> <页数> [输出目录，默认 ./layout-check]
// 适用条件：HTML 幻灯片，用 URL 的 #1、#2… 切页；当前页带 .on 类；标题元素带 .ttl 类。
// 需要 playwright（云端环境已预装；本地先 npm i playwright）。
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
(async()=>{
  const [file,n,out='layout-check']=process.argv.slice(2);
  if(!file||!n){console.error('用法：node layout-check.js <deck.html> <页数> [输出目录]');process.exit(2)}
  fs.mkdirSync(out,{recursive:true});
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
  const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(['error','assert'].includes(m.type()))errs.push(m.text())});
  let fail=0;
  for(let i=1;i<=+n;i++){
    await p.goto('file://'+path.resolve(file)+'?lc='+i+'#'+i);await p.waitForTimeout(600);
    const r=await p.evaluate(()=>{
      const s=document.querySelector('.on')||document.body;const cjk=t=>(t.match(/[一-鿿]/g)||[]).length;
      const tt=s.querySelector('.ttl');const title=tt?cjk(tt.textContent):0;
      // 用 textContent 统计（含 SVG 里的文字）；<style>/<script> 不算
      let all=0;const w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);for(let n;n=w.nextNode();){if(!n.parentElement.closest('style,script'))all+=cjk(n.nodeValue)}
      let longest=0;s.querySelectorAll('*').forEach(e=>{if(e.children.length===0&&e!==tt&&!(tt&&tt.contains(e)))longest=Math.max(longest,cjk(e.textContent))});
      return {title,body:all-title,longest}});
    const ok=r.title<=20&&r.body<=40&&r.longest<=8;if(!ok)fail++;
    console.log(`第 ${i} 页　标题 ${r.title}/20　正文 ${r.body}/40　最长标签 ${r.longest}/8　${ok?'通过':'超出'}`);
    await p.screenshot({path:path.join(out,`p${i}.png`)});
    await p.addStyleTag({content:'html{filter:blur(9px)}'});await p.screenshot({path:path.join(out,`p${i}-blur.png`)});
  }
  if(errs.length)console.log('页面报错：',errs);
  await b.close();process.exit(fail||errs.length?1:0);
})();
