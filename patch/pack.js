/* 用游戏自带 Electron 当 Node 运行时会接管 fs/asar，这里关掉 */
try{ process.noAsar = true; }catch(e){}
﻿'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto');

function readAsar(asarPath){
  const fd=fs.openSync(asarPath,'r');
  const b=Buffer.alloc(16); fs.readSync(fd,b,0,16,0);
  const jsonLen=b.readUInt32LE(12);
  const jb=Buffer.alloc(jsonLen); fs.readSync(fd,jb,0,jsonLen,16);
  const header=JSON.parse(jb.toString('utf8'));
  const base=8+b.readUInt32LE(4);
  return {fd, header, base};
}

function listFiles(node, prefix, out){
  out=out||[];
  for(const [name,val] of Object.entries(node.files||{})){
    const p = prefix ? prefix+'/'+name : name;
    if(val.files) listFiles(val,p,out); else out.push({path:p, entry:val});
  }
  return out;
}

function sha256hex(buf){ return crypto.createHash('sha256').update(buf).digest('hex'); }
function computeIntegrity(buf){
  const blockSize=4194304;
  const blocks=[];
  for(let i=0;i<buf.length;i+=blockSize) blocks.push(sha256hex(buf.slice(i,Math.min(i+blockSize,buf.length))));
  if(blocks.length===0) blocks.push(sha256hex(Buffer.alloc(0)));
  return {algorithm:'SHA256', hash:sha256hex(buf), blockSize, blocks};
}

function pack(srcAsar, outAsar, opts){
  opts=opts||{};
  const {fd, header, base} = readAsar(srcAsar);
  const entries = listFiles(header, '');
  let offset = 0;
  const chunks=[];
  // 先计算偏移与内容
  for(const {path:p, entry} of entries){
    let content=null;
    if(opts.getOverride){ const ov=opts.getOverride(p); if(ov) content = ov; }
    if(content===null && !entry.unpacked){
      content = Buffer.alloc(entry.size);
      if(entry.size>0) fs.readSync(fd, content, 0, entry.size, base+Number(entry.offset));
    }
    if(content!==null){
      entry.size = content.length;
      entry.offset = String(offset);
      if(entry.integrity) entry.integrity = computeIntegrity(content);
      offset += content.length;
      chunks.push(content);
    }
  }
  fs.closeSync(fd);
  // 写头部
  const json=Buffer.from(JSON.stringify(header),'utf8');
  const pad=(4-(json.length%4))%4;
  const payloadSize=4+json.length+pad;
  const headerBuf=Buffer.alloc(4+payloadSize);
  headerBuf.writeUInt32LE(payloadSize,0);
  headerBuf.writeUInt32LE(json.length,4);
  json.copy(headerBuf,8);
  const prefix=Buffer.alloc(8);
  prefix.writeUInt32LE(4,0);
  prefix.writeUInt32LE(headerBuf.length,4);
  const out=fs.createWriteStream(outAsar);
  out.write(prefix); out.write(headerBuf);
  // 顺序写数据（chunks 与遍历顺序一致）
  let idx=0;
  const writeAll=()=>{
    if(idx>=chunks.length){ out.end(); return; }
    const c=chunks[idx++];
    if(out.write(c)) setImmediate(writeAll); else out.once('drain', ()=>setImmediate(writeAll));
  };
  writeAll();
  return new Promise((res,rej)=>{ out.on('finish',()=>res({files:entries.length,bytes:offset})); out.on('error',rej); });
}

module.exports={ pack, readAsar, listFiles, computeIntegrity };

if(require.main===module){
  const [,,src,out]=process.argv;
  pack(src,out).then(r=>console.log('打包完成:', JSON.stringify(r))).catch(e=>{console.error(e);process.exit(1);});
}
