'use strict';
/* 生成「存档双向兼容层」的 HTML <script> 片段
 *   读入（localStorage.getItem / JSON.parse）：英文键 -> 中文键
 *   写出（JSON.stringify）              ：中文键 -> 英文键
 * 这样英文旧存档可直接用，导出的存档也能被原版游戏导入，磁盘上保持原始英文格式。
 */

/* 反查表 = 中文 -> 原版真正的英文名 / 键。三部分，优先级由低到高（后写覆盖前写）：
 *
 * 1) 注册表规范名（getName / getSpellName / getBuildingName）
 *    这些名字就是游戏拿来做键/查表用的名字，反查时必须原样回去。
 *    只靠 translations 求逆是不够的：同一个中文被多个英文名共用时「后写的赢」，踩出两类错：
 *      Furnace/Furnaces、Generator/Generators、Mana Geyser/Mana Geysers、Mine/Mines、
 *      Mana Shard/The Mana Shard、Time Capsule/Time Capsules
 *        -> buildings 的键翻成复数/带冠词的写法，导入原版后该建筑查不到 = 设施消失、进度倒退
 *      Slow(法术名)/Slowed(只在 grantTemporaryEffect 里当显示名用)
 *        -> lastSpellCastTimes 的键翻错，CD 记录丢失
 *    顺序：getName -> getSpellName -> getBuildingName。
 *    建筑名放最后，是因为 Dimensional Artifact(建筑) 与 Dimensional Artifacts(怪物) 同译「次元造物」，
 *    而 buildings 容器的键取 getBuildingName()；怪物在存档里一律按 camelCase id 存
 *    （timesEnemyDefeated / creatureAllocation / currentEnemy.id 都是 mouse、schoolBasementB3 这种），
 *    从不用显示名，所以建筑名优先是安全的。
 *
 * 2) 结构性键（rename-idents）：键取的是枚举「成员的值」，不一定等于成员名：
 *      e.TimePieces = "Time Pieces"   -> 键是 "Time Pieces"，不是 "TimePieces"
 *      e.MaxHP      = "MaxHP"         -> 键就是 "MaxHP"
 *    所以就地在游戏源码里把 oldId="value" 的值取出来当反查目标，优先级最高。
 *    少了这一步，「时间碎片」会被反查成显示名 "Time Piece"、MaxHP 会变成 "Max HP"。
 */
function extractNames(src, method){
  var re=new RegExp(method+'\\(\\)\\{return"((?:[^"\\\\]|\\\\.)*)"\\}','g');
  var out=[], m;
  while((m=re.exec(src))){ if(out.indexOf(m[1])<0) out.push(m[1]); }
  return out;
}

/* 受保护的自指枚举值（值即键里的自指成员）：汉化对它们只改名、不改值
   （rename-idents 里列出的除外，那些要跟着键一起翻）。
   汉化版里它们仍然是英文：ExplorationStatus.Combat="Combat"、ExplorationStatus.None="None"、
   CostKind.Cost="Cost"、RewardKind.Loot="Loot" 等（README 里也写着「8 个词刻意保留英文」）。
   游戏代码大量用枚举比较（explorationStatus===z.ExplorationStatus.Combat、
   primarySchool===SpellSchool.X），所以读存档时若把这类值翻成中文，比较就永远不相等，
   表现是探索状态卡住、进度异常（用户报的「探索到一半停止」）。
   注意：rename-idents 里的 Time/School/元素/属性等**不**属于这一类，它们的值在汉化版里
   就是中文（"Mana"->"法力"），读入时必须照翻，否则同样会坏。 */
function extractProtectedValues(src, renameMap){
  var out=[], seen={}, re, m;
  var res=[[/([A-Za-z_$][\w$]*)\s*=\s*"((?:[^"\\]|\\.)*)"/g,1,2],
           [/([A-Za-z_$][\w$]*)\s*:\s*"((?:[^"\\]|\\.)*)"/g,1,2]];
  for(var ri=0;ri<res.length;ri++){
    re=res[ri][0];
    while((m=re.exec(src))){
      if(m[1]!==m[2]) continue;                                   /* 只看自指 X="X" / X:"X" */
      if(renameMap&&Object.prototype.hasOwnProperty.call(renameMap,m[1])) continue; /* 要跟着键翻 */
      if(!seen[m[2]]){seen[m[2]]=1;out.push(m[2]);}
    }
  }
  return out;
}

function buildKeyMap(renameMap, src, translations){
  const K={};
  const T=(translations&&typeof translations==='object')?translations:{};
  const put=function(list){
    for(const name of list){
      const zh=T[name];
      if(typeof zh==='string'&&zh) K[zh]=name;
    }
  };
  put(extractNames(src,'getName'));
  put(extractNames(src,'getSpellName'));
  put(extractNames(src,'getBuildingName'));
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

function makeShim(M, K, enumValues){
  const mapJson=JSON.stringify(M||{});
  const keyJson=JSON.stringify(K||{});
  const enumJson=JSON.stringify(enumValues||[]);
  const js=[
    '(function(){try{',
    'var has=Object.prototype.hasOwnProperty;',
    'var M='+mapJson+';',
    'var K='+keyJson+';',
    'var NOV={},EV='+enumJson+';for(var ni=0;ni<EV.length;ni++){NOV[EV[ni]]=1;}',
    'var R={};',
    'for(var k in M){if(has.call(M,k))R[M[k]]=k;}',
    'for(var k in K){if(has.call(K,k))R[k]=K[k];}',
    'var KEY="PlayerContextState";',
    'function looksLikeSave(o){return !!o&&typeof o==="object"&&!Array.isArray(o)&&!!o.resources&&!!o.global;}',
    'function isPlain(o){var p=Object.getPrototypeOf(o);return p===Object.prototype||p===null;}',
    '/* 整串查表查不到时，再按「名字片段」翻一次。游戏里到处把名字拼进键：',
    '     "upgrade:"+getName()              -> "upgrade:Mana Crystal" / "升级：法力水晶"',
    '     <学派>+"_mastery_event_triggered" -> "Conjuration_mastery_event_triggered"',
    '     "mastery_event_"+<学派>           -> "mastery_event_Conjuration1791818138828"',
    '     "building_stasis_completed_"+建筑名',
    '     "<事件前缀>_"+<学派>+时间戳        -> "RandomSpoutEvents_8_Illusion1791818086522"',
    '   规则：片段两侧要是「非字母数字」边界（串首/串尾算边界），右边允许纯数字到结尾；',
    '   这样 IllusionistSlow / AirDragonBlur / ManaBatteryCap / ever_Research_Intro_Triggered',
    '   这类效果 id、字面量键不会被误伤。以「：」结尾的条目光检查左侧边界（名字跟在它后面）。',
    '   FRW 只用于写出（中文片段->英文），FRR 只用于读入（规范名->中文）。 */',
    'var DEL=/[^A-Za-z0-9]/;',
    'function okRight(s,i){if(i>=s.length)return true;if(DEL.test(s.charAt(i)))return true;return /^[0-9]+$/.test(s.slice(i));}',
    'function frag(s,F){',
    '  for(var i=0;i<F.length;i++){',
    '    var f=F[i][0],t=F[i][1],onlyLeft=/:$/.test(t)||/\\uff1a$/.test(t),p=0,idx;',
    '    while((idx=s.indexOf(f,p))>=0){',
    '      if(((idx===0)||DEL.test(s.charAt(idx-1)))&&(onlyLeft||okRight(s,idx+f.length))){',
    '        s=s.slice(0,idx)+t+s.slice(idx+f.length);p=idx+t.length;',
    '      }else{p=idx+1;}',
    '    }',
    '  }',
    '  return s;',
    '}',
    'function mapKey(s,T,F){',
    '  if(has.call(T,s))return T[s];',
    '  if(F===FRW&&!/[\\u4e00-\\u9fff]/.test(s))return s;',
    '  var r=frag(s,F);',
    '  if(r!==s)return has.call(T,r)?T[r]:r;',
    '  return s;',
    '}',
    'function mapStr(s,T){',
    '  if(has.call(NOV,s))return s;',
    '  if(has.call(T,s))return T[s];',
    '  var m=/^Level_Up_(.+?)(\\d*)$/.exec(s);',
    '  if(m&&has.call(T,m[1]))return "Level_Up_"+T[m[1]]+m[2];',
    '  return s;',
    '}',
    'function map(o,T,F){',
    '  if(Array.isArray(o)){for(var i=0;i<o.length;i++)o[i]=map(o[i],T,F);return o;}',
    '  if(o&&typeof o==="object"){',
    '    if(o instanceof Date||!isPlain(o))return o;',
    '    var ks=Object.keys(o);',
    '    for(var j=0;j<ks.length;j++){',
    '      var kk=ks[j],nk=mapKey(kk,T,F),vv=map(o[kk],T,F);',
    '      if(nk!==kk){o[nk]=vv;delete o[kk];}else{o[kk]=vv;}',
    '    }',
    '    return o;',
    '  }',
    '  if(typeof o==="string")return mapStr(o,T);',
    '  return o;',
    '}',
    'var FRW=[],FRR=[];',
    'for(var k in R){if(has.call(R,k)&&/[\\u4e00-\\u9fff]/.test(k))FRW.push([k,R[k]]);}',
    'var seen={};',
    'for(var k in K){if(has.call(K,k)&&/[\\u4e00-\\u9fff]/.test(k)&&!has.call(seen,K[k])){FRR.push([K[k],k]);seen[K[k]]=1;}}',
    '/* 拼串前缀（如 "upgrade:" -> "升级："）：只取词典里以冒号结尾的条目，避免把 Research/Help 这类普通词当片段 */',
    'for(var k in M){if(has.call(M,k)&&/:$/.test(k)&&/[\\u4e00-\\u9fff]/.test(M[k])&&!has.call(seen,k)){FRR.push([k,M[k]]);seen[k]=1;}}',
    'FRW.sort(function(a,b){return b[0].length-a[0].length;});',
    'FRR.sort(function(a,b){return b[0].length-a[0].length;});',
    'var p=JSON.parse,s=JSON.stringify;',
    'var g=Storage.prototype.getItem;',
    '/* 读入：localStorage 里的英文键 -> 内存里的中文键 */',
    'Storage.prototype.getItem=function(k){',
    '  var v=g.call(this,k);',
    '  if(k===KEY&&typeof v==="string"&&v.charCodeAt(0)===123){try{return s(map(p(v),M,FRR));}catch(e){}}',
    '  return v;',
    '};',
    '/* 读入：导入存档 / 粘贴存档 都走 JSON.parse */',
    'JSON.parse=function(){var r=p.apply(this,arguments);if(looksLikeSave(r)){try{map(r,M,FRR);}catch(e){}}return r;};',
    '/* 写出：内存里的中文键 -> 英文键（导出存档、写 localStorage 都走这里）*/',
    'JSON.stringify=function(v){var a=arguments;',
    '  if(looksLikeSave(v)){var c=null;try{c=map(p(s(v)),R,FRW);}catch(e){c=null;}',
    '    if(c)return s.apply(this,[c].concat(Array.prototype.slice.call(a,1)));}',
    '  return s.apply(this,a);};',
    '}catch(e){}})();'
  ].join('\n');
  return '<script>\n/* === 中文汉化补丁 === 存档双向兼容层 ===\n'+
    '   汉化把「值即键」的枚举连同标识符一起改名了（Conjuration -> 咒法）。\n'+
    '   为了让存档在汉化版 / 原版之间自由来回，这里做双向转换：\n'+
    '     读入时：英文键 -> 中文键（英文旧存档直接可用）\n'+
    '     写出时：中文键 -> 英文键（导出存档能被原版导入；磁盘上也保持原始格式）\n'+
    '   另外游戏会把名字拼进键里（"upgrade:"+升级名、<学派>+"_mastery_event_triggered" 等），\n'+
    '   整串查不到表时按名字片段再翻一次。\n'+
    '   */\n'+js+'\n</script>';
}
module.exports={makeShim, buildKeyMap, extractProtectedValues};
