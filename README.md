# 周年纪念日

一个可以直接运行的 Agent Skill：把两个人的真实照片和故事，做成一个能点、能玩的纪念日互动网页礼物（纯静态，双击 `index.html` 就能打开，不用联网、不用服务器）。

Skill 名（`name` 字段）：`anniversary-site`。中文名字「周年纪念日」用于展示。

## 里面有什么

| 页面 | 内容 |
|---|---|
| 封面 | 夜空、满天星、相机；按快门洗出拍立得，显示在一起的天数 |
| 胶卷 | 两条可拖动的胶卷，点一格放大 |
| 大富翁 | 等距 3D 棋盘，两个小人走一圈，每 3 格一件两人的大事 |
| 小餐桌 | 不爱吃的菜点一下撤走，最爱的拿不走 |
| 门票 | 一只手一张票，点一下变成两只手两张连座票 |
| 小游戏 | 横版跳跃，半路 2P 加入才有二段跳 |
| 唱片机 | 点一下换唱片，背景音乐跟着切 |
| 结尾 | 方块和光点拼成合照，旁边逐句出现一段话 |

不需要的页面在 `assets/template/js/config.js` 里用 `hidePages` 关掉。

## 安装

```bash
gh skill install YUYU20061107/周年纪念日-repo anniversary-site
```

或者把 `anniversary-site/` 整个目录复制到 `~/.dsh/skills/`（或 `~/.claude/skills/`）。

## 目录

```
anniversary-site/
  SKILL.md                 # 技能说明与工作流程
  assets/template/         # 做好并测过的网页模板（html / css / js / 字体 / 测试）
  scripts/prepare_photos.py# 照片压缩、旋转、编号
  references/customizing.md# 改配色、加页、改小游戏的落点
```

## 许可

模板代码供个人制作礼物使用。字体（龙藏体 / 马善政体）随各自 `LICENSE.txt` 分发，遵循 SIL Open Font License。
