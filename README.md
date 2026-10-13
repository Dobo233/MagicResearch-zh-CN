# Magic Research 中文汉化补丁

[Magic Research](https://store.steampowered.com/app/2311680/Magic_Research/)（Steam AppID **2311680**）的简体中文汉化，
覆盖界面、法术、物品、建筑、升级、挑战、地下城、图鉴、帮助说明书、事件与剧情等 3022 条词条。

## 下载

到 [**Releases**](../../releases/latest) 下载 `MagicResearch-中文汉化补丁-v1.4.zip`，解压到任意位置。

## 使用方法

1. **先关掉游戏**
2. **双击 `install.bat`**，等它跑完（约 300MB 重新打包，通常 1~3 分钟）
3. 启动游戏，界面就是中文了

自动找不到游戏目录时，把**游戏文件夹拖到 `install.bat` 上**：

```
install.bat "D:\Steam\steamapps\common\Magic Research"
```

**运行环境**：优先使用游戏目录里的 `Magic Research.exe`（游戏自带 Electron，可直接当 Node 用），
其次找系统 PATH 里的 `node`，正常情况下不需要安装任何东西。

## 还原原版

补丁会把原文件备份为 `<游戏目录>\resources\app.asar.orig-汉化前`。
把 `app.asar` 删掉、把 `app.asar.orig-汉化前` 改名为 `app.asar` 即可还原。

## 修改翻译

词典在 `patch/data/translations.json`（「英文原文 → 中文」），改完**重新运行 `install.bat`** 即可生效；
详细说明见 [如何修改翻译.md](如何修改翻译.md)。

## 注意

1. **不要点 Steam 的「验证游戏文件完整性」**，那会覆盖掉汉化。建议把更新设为「仅在我启动时更新」。
2. **存档双向兼容**：英文旧存档直接可用，游戏内导出的存档也能拿到原版游戏里导入。
   唯一例外是存档里**已经存下来的历史文本**（探索日志、事件提示整句、通知分组名）导回原版后仍是中文，
   属于显示层的历史记录，不影响进度。
3. 有 7 个词刻意保留英文：`Research` / `Combat` / `None` / `Power` / `Loot` / `Cost` / `Storyline`
   （它们同时是存档里的查表键）。

## 声明

- 游戏 *Magic Research* 版权归作者 **@Maticolotto** 所有
- 本补丁仅供**学习交流**，请支持正版
- 翻译数据为本人原创，转载请注明出处
