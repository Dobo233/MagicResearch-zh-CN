'use strict';
/* 生成「存档双向兼容层」的 HTML <script> 片段
 *   读入（localStorage.getItem / JSON.parse）：英文键 -> 中文键
 *   写出（JSON.stringify）              ：中文键 -> 英文键
 * 这样英文旧存档可直接用，导出的存档也能被原版游戏导入，磁盘上保持原始英文格式。
 */

/* 结构性键的反查表：中文名 -> 原版真正的键
 *
 * rename-idents.json 里的标识符之所以要「连标识符一起改名」，就是因为它们同时是存档里的键。
 * 但键取的是枚举「成员的值」，不一定等于成员名：
 *     e.TimePieces = "Time Pieces"   -> 键是 "Time Pieces"，不是 "TimePieces"
 *     e.MaxHP      = "MaxHP"         -> 键就是 "MaxHP"
 * 于是就地在游戏源码里把 oldId="value" 的值取出来当反查目标。
 * 少了这一步，「时间碎片」会被反查成显示名 "Time Piece"、MaxHP 会变成 "Max HP"，
 * 而原版查表用的是 Resource.TimePieces / CombatStat.MaxHP，键对不上，进度直接丢。
 */
function buildKeyMap(renameMap, src){
  const K={};
  for(const oldId of Object.keys(renameMap||{})){
    const zh=renameMap[oldId];
    if(typeof zh!=='string'||!zh) continue;
    const esc=oldId.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp('(?:[^A-Za-z0-9_$]|^)'+esc+'\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"');
    const m=re.exec(src);
    if(m) K[zh]=m[1];
  }
  return K;
}

function makeShim(M, K){
  const mapJson=JSON.stringify(M||{});
  const keyJson=JSON.stringify(K||{});
  const js=[
    '(function(){try{',
    'var has=Object.prototype.hasOwnProperty;',
    'var M='+mapJson+';',
    'var K='+keyJson+';',
    'var R={};',
    'for(var k in M){if(has.call(M,k))R[M[k]]=k;}',
    'for(var k in K){if(has.call(K,k))R[k]=K[k];}',
    'var KEY="PlayerContextState";',
    'function looksLikeSave(o){return !!o&&typeof o==="object"&&!Array.isArray(o)&&!!o.resources&&!!o.global;}',
    'function isPlain(o){var p=Object.getPrototypeOf(o);return p===Object.prototype||p===null;}',
    'function mapStr(s,T){',
    '  if(has.call(T,s))return T[s];',
    '  var m=/^Level_Up_(.+?)(\\d*)$/.exec(s);',
    '  if(m&&has.call(T,m[1]))return "Level_Up_"+T[m[1]]+m[2];',
    '  return s;',
    '}',
    'function map(o,T){',
    '  if(Array.isArray(o)){for(var i=0;i<o.length;i++)o[i]=map(o[i],T);return o;}',
    '  if(o&&typeof o==="object"){',
    '    if(o instanceof Date||!isPlain(o))return o;',
    '    var ks=Object.keys(o);',
    '    for(var j=0;j<ks.length;j++){',
    '      var kk=ks[j],nk=mapStr(kk,T),vv=map(o[kk],T);',
    '      if(nk!==kk){o[nk]=vv;delete o[kk];}else{o[kk]=vv;}',
    '    }',
    '    return o;',
    '  }',
    '  if(typeof o==="string")return mapStr(o,T);',
    '  return o;',
    '}',
    'var p=JSON.parse,s=JSON.stringify;',
    'var g=Storage.prototype.getItem;',
    '/* 读入：localStorage 里的英文键 -> 内存里的中文键 */',
    'Storage.prototype.getItem=function(k){',
    '  var v=g.call(this,k);',
    '  if(k===KEY&&typeof v==="string"&&v.charCodeAt(0)===123){try{return s(map(p(v),M));}catch(e){}}',
    '  return v;',
    '};',
    '/* 读入：导入存档 / 粘贴存档 都走 JSON.parse */',
    'JSON.parse=function(){var r=p.apply(this,arguments);if(looksLikeSave(r)){try{map(r,M);}catch(e){}}return r;};',
    '/* 写出：内存里的中文键 -> 英文键（导出存档、写 localStorage 都走这里）*/',
    'JSON.stringify=function(v){var a=arguments;',
    '  if(looksLikeSave(v)){var c=null;try{c=map(p(s(v)),R);}catch(e){c=null;}',
    '    if(c)return s.apply(this,[c].concat(Array.prototype.slice.call(a,1)));}',
    '  return s.apply(this,a);};',
    '}catch(e){}})();'
  ].join('\n');
  return '<script>\n/* === 中文汉化补丁 === 存档双向兼容层 ===\n'+
    '   汉化把「值即键」的枚举连同标识符一起改名了（Conjuration -> 咒法）。\n'+
    '   为了让存档在汉化版 / 原版之间自由来回，这里做双向转换：\n'+
    '     读入时：英文键 -> 中文键（英文旧存档直接可用）\n'+
    '     写出时：中文键 -> 英文键（导出存档能被原版导入；磁盘上也保持原始格式）\n'+
    '   */\n'+js+'\n</script>';
}
module.exports={makeShim, buildKeyMap};
