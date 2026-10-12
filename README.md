# Magic Research 中文汉化补丁

[Magic Research](https://store.steampowered.com/app/2311680/Magic_Research/)（Steam AppID **2311680**）的简体中文汉化。

## 下载

到 [**Releases**](../../releases/latest) 下载 `MagicResearch-中文汉化补丁-v1.4.zip`。

## 使用方法

1. 解压到任意位置
2. **双击 `install.bat`**
3. 等它跑完（约 300MB 重新打包，通常 1~3 分钟）
4. 启动游戏

自动找不到游戏时，把**游戏文件夹拖到 `install.bat` 上**即可：

```
install.bat "D:\Steam\steamapps\common\Magic Research"
```

**运行环境**：优先使用游戏目录里的 `Magic Research.exe`（游戏自带 Electron，可直接当 Node 用），
其次找系统 PATH 里的 `node`。正常情况下**不需要安装任何东西**。

## 还原原版

补丁会把原文件备份为 `<游戏目录>\resources\app.asar.orig-汉化前`。
把 `app.asar` 删掉、把 `app.asar.orig-汉化前` 改名为 `app.asar` 即可还原。

## 特性

- **覆盖 3022 条词条**：替换 4607 处字符串 + 重命名 2267 处标识符
- **界面、法术、物品、建筑、升级、挑战、地下城、图鉴、帮助说明书、全部事件与剧情、学派攻略、开发者留言** 均已汉化
- **存档双向兼容**：英文旧存档直接可用；**游戏内导出的存档也能拿到原版游戏里导入**（见下节）
- **不碰存档文件**：只修改 `resources\app.asar`

## 存档兼容（v1.4）

汉化把「值即键」的枚举**连标识符一起改了名**（`Conjuration` → `咒法`、`TimePieces` → `时间碎片`），
所以存档里的键也会跟着变。补丁往 `index.html` 注入一个约 53KB 的兼容层
（由 `patch/shim.js` 生成），在**读取**和**写出**两处做等价改名：

| 时机 | 方向 | 作用 |
|---|---|---|
| `localStorage.getItem` / `JSON.parse` | 英文键 → 中文键 | 英文旧存档直接能读，不用迁移 |
| `JSON.stringify` | 中文键 → 英文键 | 游戏内导出、写回磁盘都是原版格式 |

于是：

- **英文旧存档 → 汉化版**：直接能读
- **汉化版导出 → 原版游戏**：能导入（v1.1 及更早做不到，导出的串只有汉化版自己认）
- **汉化版写盘 → 原版格式**：哪天卸掉汉化，原版也能直接读同一份存档

兼容层靠三张表：

1. **显示名/值表**（1665 条）：词典里的短字符串，按词表反查（含句末带 `!`/`?`/`.` 的整句词条）。
2. **反查表**（375 条）= 结构性键 + 注册表规范名：
   - **结构性键**（`rename-idents.json`，41 项）优先级最高。这些键取的是枚举**成员的值**，
     不一定等于成员名 —— `e.TimePieces="Time Pieces"` 的键是 `"Time Pieces"`，不是 `TimePieces`。
     少了这张表，「时间碎片」会被反查成显示名 `Time Piece`，原版查 `Resource.TimePieces` 就落空，
     资源上限/强化等级会直接丢。
   - **注册表规范名**：从原版 `renderer.js` 抓 `getName()` / `getSpellName()` / `getBuildingName()`
     的返回值。游戏把建筑/法术/动作注册在**显示名**下（`o[e.getBuildingName()]=e`），
     反查必须回到注册表里的那个名字 —— `熔炉` 必须是 `Furnace`（不是词典显示名 `Furnaces`）、
     `法力碎片` 必须是 `Mana Shard`（不是 `The Mana Shard`）、`迟缓` 必须是 `Slow`（不是 `Slowed`）。
     建筑名与怪物名撞车时**建筑名优先**。
3. **自指枚举值保护表**（298 条）：有些枚举成员的值就是成员名、且刻意保留英文（`e.Combat="Combat"`）。
   它们既当存档键、又当代码里比较的枚举值，读入时**不能**翻译 —— 只挡「值」，键照常翻。

### v1.4 修的问题

1. **背包槽位 `Hand`/`Body`/`Accessory`、校园分组 `Gather`/`Ancient` 一直是英文**：
   它们是 `e.X="X"` 自指枚举，值既是显示文本又是查表键，被自指枚举保护挡住。
   现在按「值即键」规则同时改字符串与标识符（`rename-idents.json` 36 → 41 项），
   槽位名显示为 **手部 / 身体 / 饰品**，校园分组显示为 **采集 / 远古**；
   存档 `equipment` 的键照旧往返（内存中文 ↔ 磁盘 `Hand`/`Body`/`Accessory`）。
2. **两段结局正文 + Demo 帮助未翻译**（约 9,700 字符）：`creation_ending`（3,882）、
   `standard_ending`（3,450）、`HelpLoaderDemo.tsx` 的**退休**帮助（2,382）都已翻译，段落与标记按原文保留。
3. **拼串键在中文文本内部被误替换**：存档里当 id 用的「你的研究员获得灵感！」曾被替换成
   「你的Researchers获得灵感！」。现在片段替换要求两侧是**非字母数字且非中日韩**字符，
   并补上 `Master of ` 这类「以空格结尾的前缀词条」的反向映射，`secret_Storyline_*`、`temporaryEffects` 键正确还原。

### v1.3 修的两个问题

1. **导入原版后少设施**：反查表撞车时「后写的赢」，把 6 个建筑名带偏
   （`熔炉→Furnaces`、`发电机→Generators`、`法力间歇泉→Mana Geysers`、`矿场→Mines`、
   `法力碎片→The Mana Shard`、`时间胶囊→Time Capsules`），原版 `getBuildingAmount` 取不到 → 设施直接消失。
   另外存档里有一批**拼串键**（`'升级：'+升级名`、`'<学派>_mastery_event_triggered'`、
   `'mastery_event_'+<学派>`、`'building_stasis_completed_'+建筑名`、带时间戳的事件 id），整串查不到表。
   现在兼容层在**键**上做「带边界的片段替换」（只在键上做，且要求两侧是非字母数字边界），两类键都能还原。
2. **探索到一半停止**：读入方向的翻译原本作用在**所有字符串**上，把枚举值也翻了
   （`"Combat"` → `战斗`、`"Exploring"` → 探索中），而汉化版代码比较的是 `ExplorationStatus.Combat`，
   读档后状态机对不上，探索就卡住。现在自指枚举值（`Combat` / `Cost` / `Gather` / `Loot` / `None` /
   `Power` / `Research` / `Storyline` 这 8 个词，外加一批库内部值）读入时保持英文。

### 已验证（v1.3）

- 25 个建筑名全部反查回注册表原名；真实存档导出后原版导入 **25/25 个建筑键与数量完全一致**
- 实机：内存里 `exploration.explorationStatus === "Combat"`，读档后探索持续推进（敌人 HP 2619 → 474、时间 +45 秒、无异常）
- 导出串与磁盘存档 **0 个中文键**；`upgrade:Mana Crystal` / `Conjuration_mastery_event_triggered` 等拼串键正确

### 已验证（v1.4）

- 实机：背包显示 **手部：空 / 身体：空 / 饰品：空**（无 `Hand`/`Body`/`Accessory`），校园分组标题是 **采集**（无 `Gather`），无异常
- 三种模式（仓库 / 已安装 asar / 发布包重打）**全部通过**；重建后三段中文在 `renderer.js` 里、英文原文已消失
- 全文扫描：游戏代码里仍是英文原文的只剩内部标识符、枚举成员、无障碍标签、格式串，无可显示文本

### 已知限制

导回原版时，**存档里已经存下来的历史文本**仍是中文。游戏会把渲染好的成品文本写进存档
（探索日志里的 `[2:34:11 PM] 你找到了1 羊毛!`、事件参数里的整句提示、通知分组名等），
这些不是词典里的名字，没法按表还原。属于显示层的历史记录，**不影响进度、不会报错**。

## 注意事项

1. **不要点 Steam 的「验证游戏文件完整性」**，那会覆盖掉汉化。建议把更新设为「仅在我启动时更新」。
2. 部分**字符串拼接**的提示可能夹英文（如 `"Gather more " + 资源 + "!"`），这类片段只翻译了能翻译的部分。
3. 有 **7 个词刻意保留英文**：`Research` / `Combat` / `None` / `Power` / `Loot` / `Cost` / `Storyline`。
   它们既是显示文本又是存档里的查表键，翻译会破坏旧档兼容（`Gather`/`Hand`/`Body`/`Accessory`/`Ancient`
   已在 v1.4 按「字符串 + 标识符一起改」的完整做法翻掉）。

## 修改翻译

翻译词典在 `patch/data/translations.json`（「英文原文 → 中文」，3015 条）。

仓库带了 `dict.bat` 工具：

```bat
dict.bat find 法力                        搜索（英文原文或中文都能搜）
dict.bat set  "Campus" "学院"              修改／新增
dict.bat rm   "Campus"                    删除该条（保持英文）
dict.bat setenum Mana "法力值"             改组「值即键」的枚举名（会同时改两个文件）
```

改完**重新运行 `install.bat`** 即可生效补丁会自动从 `app.asar.orig-汉化前` 重新生成，
所以可以**反复改、反复重打**，不会累积错误。

详细说明见 [如何修改翻译.md](如何修改翻译.md)。

## 原理

游戏的全部文本硬编码在 `renderer.js`（16.4MB 的 webpack 产物）的字符串字面量里，没有 i18n 框架。
补丁的运行流程：

1. 读取你自己游戏里的 `app.asar`，取出 `renderer.js` 与 `renderer.js.map`
2. 用 source map 把每个字符串字面量**归因回原始 TSX 源文件**，只翻译「游戏自身文件」里的字符串
   （避免误翻 React / react-native 等库内部字符串）
3. 套用翻译数据：替换字符串 + 重命名标识符
   （资源、学派、元素、战斗属性、建筑分类的名字是「值即键」的枚举，
   例如 `e.Mana="Mana"` 同时被当作对象键 `{Mana:{...}}` 使用，必须字符串和标识符一起改，否则查表会失败）
4. 往 `index.html` 注入**双向存档兼容层**（`patch/shim.js`，见上节），
   必须排在 `renderer.js` 之前执行
5. 重新打包 `app.asar` 并安装（原文件自动备份）

**本仓库不包含任何游戏文件**，只有翻译数据与打补丁的程序。

## 目录结构

```
install.bat            一键安装
dict.bat               改词典的小工具
patch/
  patch.js             主程序
  shim.js              存档双向兼容层生成器（读入英->中，写出中->英）
  pack.js              asar 打包器
  scan.js              JS 词法扫描
  data/
    translations.json  翻译词典（3015 条）
    rename-idents.json 需要连带重命名的枚举标识符（36 项）
tools/
  dict.js              dict.bat 的实现
```

## 更新记录

- **v1.4**：补齐最后一批可见英文
  - 背包槽位 `Hand`/`Body`/`Accessory` → **手部/身体/饰品**，校园分组 `Gather`/`Ancient` → **采集/远古**
    （自指枚举按「值即键」规则同时改字符串 + 标识符，`rename-idents.json` 36 → 41 项；存档 `equipment` 键仍往返）
  - 翻译两段结局正文（3,882 + 3,450 字符）与 Demo 版**退休**帮助（2,382 字符）
  - 片段替换边界收紧：**不在中文文本内部**做片段替换；右侧允许孤立复数 `s`；
    显示名表纳入句末标点整句词条与 `Master of ` 这类前缀词条（`secret_Storyline_*`、`temporaryEffects` 键还原正确）
  - 词条 3015  3022，替换 4593  4607，标识符重命名 2098  2267

- **v1.3**：修复「导入原版后少设施」和「探索到一半停止」
  - 反查表加入**注册表规范名**（`getName` / `getSpellName` / `getBuildingName`），
    修掉 6 个被显示名带偏的建筑键（`Furnace` / `Generator` / `Mana Geyser` / `Mine` /
    `Mana Shard` / `Time Capsule`），撞车时建筑名优先
  - 兼容层新增**带边界的片段替换**，还原拼串键：`升级：X` → `upgrade:X`、
    `咒法_mastery_event_*` → `Conjuration_mastery_event_*`、带时间戳的事件 id 等
  - 新增**自指枚举值保护表**（303 条）：读入时不再翻译 `Combat` / `None` 这类枚举值，
    修掉「读档后探索状态机卡住」的根因
  - 兼容层从约 40KB 增至约 53KB；`verify-compat.js` 19 项断言两种模式全通过

- **v1.2**：修复导出存档无法在原版游戏导入的问题
  - 兼容层从「只会 英中」升级成**双向**：写出时 中英，导出的存档回到原版格式
  - 新增**结构性键表**：按枚举成员的值反查，修正 `时间碎片  "Time Pieces"`、
    `最大生命  MaxHP`、`生命回复  HPRegen`、`暴击率  CritChance`、
    `攻击间隔  AttackDelay`、`暗  Darkness` 等会被显示名带偏的键
  - 组合事件 id `Level_Up_<学派>`（含时间戳后缀）也会跟着转
- v1.1：改词后可一键重打；新增 `dict.bat`、一致性自检、修改说明
- v1.0：首个版本，3015 条词条；内置旧存档兼容层

## 声明

- 游戏 *Magic Research* 版权归作者 **@Maticolotto** 所有
- 本补丁仅供**学习交流**，请支持正版
- 翻译数据为本人原创，转载请注明出处
