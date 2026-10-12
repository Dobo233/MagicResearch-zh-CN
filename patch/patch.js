/* 用游戏自带 Electron 当 Node 运行时会接管 fs/asar，这里关掉 */
try{ process.noAsar = true; }catch(e){}
﻿'use strict';
/* Magic Research 中文汉化补丁  主程序
 * 用法: node patch.js [游戏目录]
 * 原理: 读取你自己游戏里的 app.asar -> 解析 renderer.js 的 source map 定位「游戏自身文件」
 *       里的字符串字面量 -> 套用翻译 -> 重新打包 app.asar（原文件自动备份）
 * 本程序不含任何游戏代码，只含翻译数据。
 */
const fs=require('fs'), path=require('path'), os=require('os'), crypto=require('crypto'), zlib=require('zlib');
const {scan}=require('./scan.js');
const {pack, readAsar, listFiles}=require('./pack.js');

const DATA=path.join(__dirname,'data');
const translations=JSON.parse(fs.readFileSync(path.join(DATA,'translations.json'),'utf8'));
const renameMap=JSON.parse(fs.readFileSync(path.join(DATA,'rename-idents.json'),'utf8'));
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);

/* ---------- 1. 定位游戏 ---------- */
function findGame(arg){
  const cands=[];
  if(arg) cands.push(arg);
  // Steam 常见路径
  const steamRoots=[];
  try{
    const rel=require('child_process').execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath',{encoding:'latin1'});
    const m=/SteamPath\s+REG_SZ\s+(.+)/.exec(rel); if(m) steamRoots.push(m[1].trim());
  }catch(e){}
  steamRoots.push('C:\\Program Files (x86)\\Steam');
  const libs=[];
  for(const sr of steamRoots){
    libs.push(sr);
    try{
      const vdf=fs.readFileSync(path.join(sr,'steamapps','libraryfolders.vdf'),'utf8');
      for(const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libs.push(m[1].replace(/\\\\/g,'\\'));
    }catch(e){}
  }
  for(const lib of libs) cands.push(path.join(lib,'steamapps','common','Magic Research'));
  for(const c of cands){
    const a=path.join(c,'resources','app.asar');
    if(fs.existsSync(a)) return a;
  }
  return null;
}

const asarPath=findGame(process.argv[2]);
if(!asarPath){
  console.log('');
  console.log(' 没有找到《Magic Research》的游戏目录。');
  console.log('');
  console.log('   解决办法：把游戏文件夹拖到 install.bat 上，或者：');
  console.log('     install.bat "D:\\Steam\\steamapps\\common\\Magic Research"');
  console.log('');
  console.log('   （游戏目录里应该有 resources\\app.asar 这个文件）');
  process.exit(1);
}
const gameDir=path.dirname(path.dirname(asarPath));
console.log('游戏目录: '+gameDir);

/* ---------- 2. 读取 asar ---------- */
/* 优先从「未汉化的原始备份」重新生成：这样改完词典直接重跑即可，不必手动还原 */
const pristine=path.join(path.dirname(asarPath),'app.asar.orig-\u6c49\u5316\u524d');
let srcAsar=asarPath;
if(fs.existsSync(pristine)){ srcAsar=pristine; console.log('\u2192 \u4f7f\u7528\u539f\u59cb\u5907\u4efd\u4f5c\u4e3a\u6e90\u6587\u4ef6\u91cd\u65b0\u751f\u6210'); }
const {fd, header, base}=readAsar(srcAsar);
function readEntry(name){
  let n=header; for(const seg of name.split('/')) n=n.files[seg];
  if(!n) return null;
  const b=Buffer.alloc(n.size);
  if(n.size) fs.readSync(fd,b,0,n.size,base+Number(n.offset));
  return b;
}
const entry=(name)=>{ let n=header; for(const s of name.split('/')) n=n&&n.files[s]; return n; };
const srcBuf=readEntry('renderer.js');
const mapBuf=readEntry('renderer.js.map');
const htmlBuf=readEntry('index.html');
if(!srcBuf){ console.error(' app.asar 里没有 renderer.js，游戏版本可能不受支持'); process.exit(1); }
const src=srcBuf.toString('utf8');
const html0=htmlBuf?htmlBuf.toString('utf8'):null;

if(srcAsar===asarPath && (src.includes('中文汉化补丁') || (html0&&html0.includes('中文汉化补丁')))){
  console.log('ℹ  这个游戏已经打过汉化补丁，而且没有找到原始备份，无法自动重新生成。');
  console.log('   如果要改词典后重打，请先手动把 app.asar.orig-汉化前 恢复为 app.asar。');
  process.exit(0);
}

/* ---------- 3. 扫描字符串 + source map 归因 ---------- */
function decode(raw){
  let s='';
  for(let i=0;i<raw.length;i++){
    const c=raw[i];
    if(c!=='\\'){ s+=c; continue; }
    const d=raw[++i];
    switch(d){
      case 'n':s+='\n';break; case 't':s+='\t';break; case 'r':s+='\r';break;
      case 'b':s+='\b';break; case 'f':s+='\f';break; case 'v':s+='\v';break; case '0':s+='\0';break;
      case 'x':s+=String.fromCharCode(parseInt(raw.substr(i+1,2),16));i+=2;break;
      case 'u': if(raw[i+1]==='{'){const e=raw.indexOf('}',i);s+=String.fromCodePoint(parseInt(raw.slice(i+2,e),16));i=e;}
                else {s+=String.fromCharCode(parseInt(raw.substr(i+1,4),16));i+=4;} break;
      case '\n': break;
      default: s+=d;
    }
  }
  return s;
}

let gameStarts=null, lits=null;
const sc=scan(src);
lits=sc.literals;
if(mapBuf){
  try{
    const map=JSON.parse(mapBuf.toString('utf8'));
    const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const B64I={}; B64.split('').forEach((c,i)=>B64I[c]=i);
    const vlq=(str)=>{ const res=[]; let sh=0,val=0;
      for(const ch of str){ const d=B64I[ch]; const cont=d&32; val+=(d&31)<<sh;
        if(cont){ sh+=5; } else { const neg=val&1; val>>=1; res.push(neg?-val:val); val=0; sh=0; } }
      return res; };
    const dec=[]; let si=0,sl=0,sc2=0,nm=0;
    for(const line of map.mappings.split(';')){
      let gc=0; const segs=[];
      if(line) for(const seg of line.split(',')){
        if(!seg) continue;
        const f=vlq(seg); gc+=f[0];
        if(f.length>=4){ si+=f[1]; sl+=f[2]; sc2+=f[3]; if(f.length>=5) nm+=f[4]; segs.push([gc,si,sl,sc2]); }
        else segs.push([gc,-1,-1,-1]);
      }
      dec.push(segs);
    }
    const fileLines=src.split('\n');
    const codeLineIdx=fileLines.findIndex(l=>l.startsWith('module.exports=function'));
    let mapCodeIdx=0;
    for(let i=0;i<dec.length;i++) if(dec[i].length>(dec[mapCodeIdx]||[]).length) mapCodeIdx=i;
    const OFF=(codeLineIdx>=0)?(codeLineIdx-mapCodeIdx):0;
    const lineStarts=[0];
    for(let i=0;i<src.length;i++) if(src[i]==='\n') lineStarts.push(i+1);
    const posLC=(pos)=>{ let lo=0,hi=lineStarts.length-1;
      while(lo<hi){ const mid=(lo+hi+1)>>1; if(lineStarts[mid]<=pos) lo=mid; else hi=mid-1; }
      return {line:lo,col:pos-lineStarts[lo]}; };
    const lookup=(gl,gc)=>{
      const segs=dec[gl]; if(!segs||!segs.length) return null;
      let best=null; for(const s of segs){ if(s[0]<=gc) best=s; else break; }
      if(!best||best[1]<0) return null;
      return map.sources[best[1]]||null;
    };
    gameStarts=new Set();
    for(const l of lits){
      const lc=posLC(l.start);
      const s=lookup(lc.line-OFF, lc.col);
      if(!s) continue;
      const r=s.replace(/^webpack:\/\/\/?/,'');
      if(r && !r.includes('node_modules') && !r.includes('/../')) gameStarts.add(l.start);
    }
    console.log('source map 归因成功：游戏自身字面量 '+gameStarts.size+' 个');
  }catch(e){ console.warn('source map 解析失败，退化为「全部文件」模式: '+e.message); }
}else{
  console.warn('游戏未附带 source map，退化为「全部文件」模式（可能误翻库内文字）');
}

/* ---------- 4. 应用翻译 ---------- */
function selfRefOwner(start,value){
  const pre=src.slice(Math.max(0,start-48), start);
  let m=/([A-Za-z_$][\w$]*)\s*=\s*$/.exec(pre); if(m&&m[1]===value) return m[1];
  m=/([A-Za-z_$][\w$]*)\s*:\s*$/.exec(pre); if(m&&m[1]===value) return m[1];
  m=/["']([^"']*)["']\s*:\s*$/.exec(pre); if(m&&m[1]===value) return m[1];
  return null;
}
const mask=new Uint8Array(src.length);
for(const [a,b] of sc.prot) mask.fill(1,a,b);

const edits=[]; let litHit=0, skipped=0;
for(const l of lits){
  if(l.hasExpr) continue;
  const v=decode(l.raw);
  if(!has(translations,v)) continue;
  if(gameStarts && !gameStarts.has(l.start)){ skipped++; continue; }
  const owner=selfRefOwner(l.start,v);
  if(owner!==null && !has(renameMap,owner)){ skipped++; continue; }
  litHit++;
  edits.push({start:l.start,end:l.end,text:JSON.stringify(translations[v]),kind:'lit',value:v});
}
/* 一致性自检：rename-idents 的每一项，都必须有对应的字符串翻译，否则枚举「值」和「键」会不一致 */
try{
  const selfRef={}; const re=/([A-Za-z_$][\w$]*)\s*=\s*"((?:[^"\\]|\\.)*)"/g; let mm;
  while((mm=re.exec(src))!==null){ if(mm[1]===mm[2]) selfRef[mm[1]]=mm[2]; }
  const bad=[];
  for(const id of Object.keys(renameMap)){
    const v=selfRef[id];
    if(v!==undefined && !has(translations,v)) bad.push(id+'  枚举值 "'+v+'" 没有对应翻译');
  }
  if(bad.length){
    console.log('');
    console.log(' 一致性问题：以下标识符会被改名，但对应的字符串没有翻译，查表会失败');
    bad.forEach(x=>console.log('   '+x));
    console.log('    请同时在 rename-idents.json 和 translations.json 里改，或用 tools/dict.js setenum');
    console.log('');
  }
}catch(e){}

let idHit=0;
let i=0;
while(i<src.length){
  if(mask[i]){ i++; continue; }
  if(/[A-Za-z_$]/.test(src[i])){
    let j=i+1; while(j<src.length && /[A-Za-z0-9_$]/.test(src[j]) && !mask[j]) j++;
    const tok=src.slice(i,j);
    if(has(renameMap,tok)){ edits.push({start:i,end:j,text:renameMap[tok],kind:'id',value:tok}); idHit++; }
    i=j; continue;
  }
  i++;
}
edits.sort((a,b)=>b.start-a.start);
let out=src, prev=Infinity, overlap=0;
for(const e of edits){
  if(e.end>prev){ overlap++; continue; }
  out=out.slice(0,e.start)+e.text+out.slice(e.end); prev=e.start;
}
console.log('翻译替换 '+litHit+' 处，标识符重命名 '+idHit+' 处，跳过 '+skipped+' 处'+(overlap?('，冲突 '+overlap):''));

/* ---------- 5. 生成并注入「存档双向兼容层」 ---------- */
/* 显示名/值：英 -> 中，用于读入；反查成英时用 */
const nameLike=Object.entries(translations).filter(([k])=>
  k.length<=48 && !/[\n\t]/.test(k) && !/[*_`]/.test(k) && !/[.!?]$/.test(k) && /^[A-Za-z]/.test(k));
/* 结构性键（rename-idents）：中文 -> 原版真正的键，反查时优先级最高。
   少了它，「时间碎片」会被反查成显示名 "Time Piece"，原版查 Resource.TimePieces 就落空。 */
const {makeShim, buildKeyMap}=require('./shim.js');
const keyMap=buildKeyMap(renameMap, src);
const missingKeys=Object.keys(renameMap).filter(id=>!keyMap[renameMap[id]]);
if(missingKeys.length){
  console.log('');
  console.log(' 警告：以下「值即键」枚举没能在 renderer.js 里找到 标识符="值" 的定义，');
  console.log('        导出存档时它们的键可能对不上原版，请检查：');
  missingKeys.forEach(id=>console.log('   '+id+' -> '+renameMap[id]));
}
console.log('兼容层映射：显示名/值 '+nameLike.length+' 条，结构性键 '+Object.keys(keyMap).length+' 条');
const shim=makeShim(Object.fromEntries(nameLike), keyMap);

let html=html0;
if(html){
  if(/<title>Magic Research<\/title>/.test(html)) html=html.replace('<title>Magic Research</title>','<title>魔法研究</title>');
  if(html.includes('Oh no! It looks like JavaScript is not enabled in your browser.'))
    html=html.replace('Oh no! It looks like JavaScript is not enabled in your browser.','糟糕！你的浏览器似乎没有启用 JavaScript。');
  const tag='<script src="renderer.js"></script>';
  if(html.includes(tag) && !html.includes('中文汉化补丁')) html=html.replace(tag, shim+'\n  '+tag);
}

/* ---------- 6. 打包 & 安装 ---------- */
const tmpAsar=path.join(os.tmpdir(),'app.zh.'+Date.now()+'.asar');
const overrides={ 'renderer.js':Buffer.from(out,'utf8') };
if(html) overrides['index.html']=Buffer.from(html,'utf8');

console.log('\n正在打包（约 300MB，请稍候）');
pack(srcAsar, tmpAsar, {getOverride:(p)=>overrides[p]||null}).then(()=>{
  // 备份原文件（只备份一次）
  const bak=pristine;
  if(!fs.existsSync(bak)){ fs.copyFileSync(asarPath,bak); console.log('已备份原文件 -> '+bak); }
  else console.log('原始备份已存在（未覆盖）: '+bak);
  fs.copyFileSync(tmpAsar, asarPath);
  fs.unlinkSync(tmpAsar);
  console.log('\n 汉化安装完成！');
  console.log('   现在可以正常启动游戏。存档兼容层会自动处理英文键的旧存档。');
  console.log('   如需还原：把 app.asar.orig-汉化前 改名为 app.asar 即可。');
}).catch(e=>{ console.error('打包失败: '+e.message); process.exit(1); });
