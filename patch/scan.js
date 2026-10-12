'use strict';
// scan.js : 扫描 JS 源码，返回字符串字面量 与 受保护区间（注释/正则/字符串）
function scan(src){
  const literals=[]; const prot=[]; const n=src.length; let i=0; let prev='';
  const addProt=(a,b)=>prot.push([a,b]);
  while(i<n){
    const c=src[i];
    if(c==='/'&&src[i+1]==='/'){ let e=src.indexOf('\n',i); if(e<0)e=n; addProt(i,e); i=e; continue; }
    if(c==='/'&&src[i+1]==='*'){ let e=src.indexOf('*/',i+2); e=e<0?n:e+2; addProt(i,e); i=e; continue; }
    if(c==='/'&&(prev===''||!/[A-Za-z0-9_$)\]}]/.test(prev))){
      let j=i+1,inClass=false,ok=false;
      while(j<n){const d=src[j]; if(d==='\\'){j+=2;continue;} if(d==='\n')break; if(d==='[')inClass=true; else if(d===']')inClass=false; else if(d==='/'&&!inClass){ok=true;break;} j++;}
      if(ok){ j++; while(j<n&&/[a-z]/.test(src[j]))j++; addProt(i,j); i=j; prev=')'; continue; }
    }
    if(c==='"'||c==="'"){
      const start=i; let j=i+1,closed=false;
      while(j<n){const d=src[j]; if(d==='\\'){j+=2;continue;} if(d===c){closed=true;break;} if(d==='\n')break; j++;}
      if(closed){ literals.push({start,end:j+1,quote:c,raw:src.slice(start+1,j),isTemplate:false,hasExpr:false}); addProt(start,j+1); i=j+1; prev=c; continue; }
      i++; continue;
    }
    if(c==='`'){
      const start=i; let j=i+1,closed=false,hasExpr=false;
      while(j<n){
        const d=src[j];
        if(d==='\\'){j+=2;continue;}
        if(d==='$'&&src[j+1]==='{'){hasExpr=true; let depth=1; j+=2;
          while(j<n&&depth>0){const e=src[j]; if(e==='\\'){j+=2;continue;} if(e==='{')depth++; else if(e==='}')depth--; else if(e==='"'||e==="'"||e==='`'){const q=e;j++;while(j<n&&src[j]!==q){if(src[j]==='\\')j++;j++;}} j++;}
          continue;
        }
        if(d==='`'){closed=true;break;}
        j++;
      }
      if(closed){ literals.push({start,end:j+1,quote:'`',raw:src.slice(start+1,j),isTemplate:true,hasExpr}); addProt(start,j+1); i=j+1; prev='`'; continue; }
      i++; continue;
    }
    if(!/\s/.test(c)) prev=c;
    i++;
  }
  return {literals, prot};
}
module.exports={scan};
