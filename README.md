# Magic Research 中文汉化补丁

[Magic Research](https://store.steampowered.com/app/2311680/Magic_Research/)（Steam AppID **2311680**）的简体中文汉化。

## 下载

到 [**Releases**](../../releases/latest) 下载 `MagicResearch-中文汉化补丁-v1.0.zip`。

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

- **覆盖 3015 条词条**：替换 4657 处字符串 + 重命名 2098 处标识符
- **界面、法术、物品、建筑、升级、挑战、地下城、图鉴、帮助说明书、全部事件与剧情、学派攻略、开发者留言** 均已汉化
- **旧存档直接可用**：补丁内置兼容层，自动把旧存档里的英文键（`Conjuration`、`Fire` 等）转成中文键，无需手动迁移
- **不碰存档**：只修改 `resources\app.asar`

## 注意事项

1. **不要点 Steam 的「验证游戏文件完整性」**，那会覆盖掉汉化。建议把更新设为「仅在我启动时更新」。
2. 部分**字符串拼接**的提示可能夹英文（如 `"Gather more " + 资源 + "!"`），这类片段只翻译了能翻译的部分。
3. 有 **8 个词刻意保留英文**：`Research` / `Gather` / `Combat` / `None` / `Power` / `Loot` / `Cost` / `Storyline`。
   它们既是显示文本又是存档里的查表键，翻译会破坏旧档兼容。

## 原理

游戏的全部文本硬编码在 `renderer.js`（16.4MB 的 webpack 产物）的字符串字面量里，没有 i18n 框架。
补丁的运行流程：

1. 读取你自己游戏里的 `app.asar`，取出 `renderer.js` 与 `renderer.js.map`
2. 用 source map 把每个字符串字面量**归因回原始 TSX 源文件**，只翻译「游戏自身文件」里的字符串
   （避免误翻 React / react-native 等库内部字符串）
3. 套用翻译数据：替换字符串 + 重命名标识符
   （资源、学派、元素、战斗属性、建筑分类的名字是「值即键」的枚举，
   例如 `e.Mana="Mana"` 同时被当作对象键 `{Mana:{...}}` 使用，必须字符串和标识符一起改，否则查表会失败）
4. 往 `index.html` 注入存档兼容层
5. 重新打包 `app.asar` 并安装（原文件自动备份）

**本仓库不包含任何游戏文件**，只有翻译数据与打补丁的程序。

## 目录结构

```
install.bat            一键安装（纯 ASCII，避免 cmd 代码页问题）
patch/
  patch.js             主程序
  pack.js              asar 打包器
  scan.js              JS 词法扫描
  data/
    translations.json  翻译词典（3015 条）
    rename-idents.json 需要连带重命名的枚举标识符（36 项）
```

## 声明

- 游戏 *Magic Research* 版权归作者 **@Maticolotto** 所有
- 本补丁仅供**学习交流**，请支持正版
- 翻译数据为本人原创，转载请注明出处
