'use strict';
/* 词典编辑工具
 *   node tools/dict.js info                     查看词条数
 *   node tools/dict.js find <关键词>             搜索（英文原文或中文皆可）
 *   node tools/dict.js set "<英文原文>" "<中文>"  修改／新增一条
 *   node tools/dict.js rm  "<英文原文>"           删除一条（该字符串将保持英文）
 *   node tools/dict.js get "<英文原文>"           查看某条当前译文
 */
const fs=require('fs'),path=require('path');
const FILE=path.join(__dirname,'..','patch','data','translations.json');
const load=()=>JSON.parse(fs.readFileSync(FILE,'utf8'));
const save=(o)=>fs.writeFileSync(FILE, JSON.stringify(o,null,1),'utf8');
const [cmd,...args]=process.argv.slice(2);

if(!cmd||cmd==='help'){ console.log(fs.readFileSync(__filename,'utf8').split('*/')[0].replace(/^\/\*|\s*\*\s?/gm,'')); process.exit(0); }

const dict=load();
const K=Object.keys(dict);

if(cmd==='info'){
  const cn=K.filter(k=>/[\u4e00-\u9fff]/.test(dict[k]));
  console.log('词典文件: '+FILE);
  console.log('总条数  : '+K.length);
  console.log('含中文  : '+cn.length);
  console.log('纯符号  : '+(K.length-cn.length)+'  （数值+图标 token，无需中文）');
}

else if(cmd==='find'){
  const q=args.join(' ');
  if(!q){ console.error('用法: node tools/dict.js find <关键词>'); process.exit(1); }
  const hits=K.filter(k=>k.includes(q)||String(dict[k]).includes(q));
  console.log('匹配 '+hits.length+' 条：');
  hits.slice(0,60).forEach(k=>console.log('  '+JSON.stringify(k)+'\n     -> '+JSON.stringify(dict[k])));
  if(hits.length>60) console.log('  还有 '+(hits.length-60)+' 条');
}

else if(cmd==='get'){
  const k=args.join(' ');
  if(!(k in dict)){ console.log('词典里没有这一条。'); process.exit(1); }
  console.log(JSON.stringify(k)+' -> '+JSON.stringify(dict[k]));
}

else if(cmd==='set'){
  const k=args[0], v=args.slice(1).join(' ');
  if(!k||!v){ console.error('用法: node tools/dict.js set "<英文原文>" "<中文>"'); process.exit(1); }
  const isNew=!(k in dict);
  dict[k]=v;
  save(dict);
  console.log((isNew?'已新增':'已修改')+'：'+JSON.stringify(k)+' -> '+JSON.stringify(v));
  console.log('改完请重新运行 install.bat 生效。');
}

else if(cmd==='rm'){
  const k=args.join(' ');
  if(!(k in dict)){ console.log('词典里没有这一条。'); process.exit(1); }
  const old=dict[k]; delete dict[k]; save(dict);
  console.log('已删除：'+JSON.stringify(k)+'（原译文 '+JSON.stringify(old)+'）');
  console.log('该字符串将保持英文。改完请重新运行 install.bat 生效。');
}

else if(cmd==='setenum'){
  // 改「值即键」的枚举名：必须同时改 translations.json 和 rename-idents.json，否则查表会失败
  const id=args[0], v=args.slice(1).join(' ');
  if(!id||!v){ console.error('用法: node tools/dict.js setenum <枚举标识符> "<中文>"\n例：  node tools/dict.js setenum Mana 法力值'); process.exit(1); }
  const REN=path.join(__dirname,'..','patch','data','rename-idents.json');
  const rm=JSON.parse(fs.readFileSync(REN,'utf8'));
  if(!(id in rm)){ console.error('rename-idents.json 里没有 "'+id+'"。现有：'+Object.keys(rm).join(', ')); process.exit(1); }
  const oldCn=rm[id];
  const oldEn=Object.keys(dict).find(k=>dict[k]===oldCn&&/[A-Za-z]/.test(k))||id;
  rm[id]=v; fs.writeFileSync(REN, JSON.stringify(rm,null,2),'utf8');
  if(oldEn in dict){ dict[oldEn]=v; } else { dict[id]=v; }
  save(dict);
  console.log('已同时修改两个文件：');
  console.log('  translations.json : '+JSON.stringify(oldEn)+' -> '+JSON.stringify(v));
  console.log('  rename-idents.json: '+JSON.stringify(id)+' -> '+JSON.stringify(v)+'（原 '+JSON.stringify(oldCn)+'）');
  console.log('改完请重新运行 install.bat 生效。');
}

else console.error('未知命令: '+cmd+'（可用 info / find / get / set / rm / setenum）');