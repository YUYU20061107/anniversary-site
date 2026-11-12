# 改模板本身

配置项（`js/config.js`）够用时不要动这里的东西。需要改时，先看文件地图找到位置。

## 文件地图

```
index.html          八个 <section class="page">，顺序就是翻页顺序
css/style.css       设计变量（颜色、字体）、翻页骨架、翻页条、拍立得、放大看
css/pages.css       封面、胶卷、小餐桌、门票、小游戏、结尾；末尾是手机横屏的规则
css/extra.css       大富翁（等距 3D）和唱片机
css/font-*.css      两种手写中文字体（Ma Shan Zheng 标题、Long Cang 手写），文件在 fonts/
js/config.js        所有内容
js/mosaic-data.js   prepare_photos.py 生成，不要手改
js/logic.js         纯逻辑：天数、可复现随机数、小餐桌规则          ← node 可测
js/game-core.js     纯逻辑：小游戏的关卡、物理、2P 加入、通关机器人  ← node 可测
js/board-core.js    纯逻辑：大富翁的格子、掷骰子、不能跳过的站      ← node 可测
js/app.js           骨架：翻页、隐藏页面、音效、背景音乐、闪光、放大看；导出 window.Anniv
js/scenes.js        封面、胶卷、小餐桌、门票
js/game.js          小游戏的画面、键盘和触屏输入、游戏循环
js/board.js         大富翁的 3D 搭建、走路动画、事件卡
js/vinyl.js         唱片机
js/finale.js        结尾的粒子动画和信
tests/              logic.test.js、board.test.js（node --test），e2e.js（真实浏览器）
```

规则和画面是分开的：`*-core.js` 和 `logic.js` 不碰 DOM，改规则时先改它们并跑 `node --test`，再改画面。

## 常见改动

**换配色 / 字体**：`css/style.css` 开头的 `:root` 变量。每一页的背景色写在各自的 `.page-xxx` 规则里。

**调整页面顺序**：在 `index.html` 里移动整个 `<section>`。封面必须是第一个。翻页条的圆点是按页面自动生成的。

**加一页**：
1. 在 `index.html` 加一个 `<section class="page page-xxx" id="p-xxx" data-title="翻页条上的名字">`。
2. 样式加在 `css/extra.css`。
3. 新建 `js/xxx.js`，在 `index.html` 末尾 `app.js` 之后引入。用 `window.Anniv` 提供的东西：
   - `A.$(id)`、`A.config`、`A.photos`（`{ full, thumb, caption }` 数组）
   - `A.onEnter('p-xxx', fn)` / `A.onLeave('p-xxx', fn)`：进入、离开这一页时调用
   - `A.nudgeNext('p-xxx')`：这一页的互动做完了，让"下一页"按钮动一动
   - `A.sfx(name)`：音效，名字见 `app.js` 里的 `SOUNDS`
   - `A.openLightbox(index, openerEl)`：放大看某张照片
4. 在 `tests/e2e.js` 的 `steps` 里加上 `'p-xxx'` 的步骤，否则测试走到这一页会报错。

**小游戏关卡**：`js/game-core.js` 开头的 `PITS`（坑）、`BRICKS`（砖）、`WALLS`（墙）、`HEARTS`、`ENEMIES`，单位是格子。`JOIN_COL` 是 2P 加入的位置，`WALL_COL` 是那堵一个人过不去的墙。改完一定跑 `node --test tests/logic.test.js`：里面有两条测试分别证明"单人过不了墙"和"两人能通关"，这是这一页的全部意义，不能改坏。

**小人的样子**：小游戏里的像素小人在 `js/game.js` 的 `SPRITES` 和 `PALETTE`（一个字符一个像素）；大富翁里的方块小人在 `js/board.js` 的 `person()` 和 `css/extra.css` 的 `.person-him` / `.person-her`。两只手的袖子花纹在 `index.html` 开头的 `<pattern>` 和 `js/scenes.js` 的 `handSvg()` 调用处。

**大富翁的格子数**：`js/board-core.js` 的 `SIDE`（每边格数）和 `EVENT_GAP`。改了之后 `js/board.js` 里的 `MEMORY_SPOTS`（纪念物摆在棋盘中间的位置）和 `css/extra.css` 里 `.iso-board` 的宽高（`var(--s) * 6`）要跟着改。

## 容易踩的坑

这些都是做第一版时实际遇到过的：

- **延时回调要带页面 id。** `setTimeout` 里调用 `A.nudgeNext()` 时如果人已经翻走了，会在错误的页面上提示"可以下一页了"。所以 `nudgeNext` 接受页面 id，不在那一页就什么都不做。
- **游戏输入要在重开和通关时清零。** 按着方向键通关、通关画面出来后才松手，松键事件如果被忽略，重开后小人会自己跑。`game.js` 里松键任何时候都生效。
- **按着跳键通关会把通关画面跳过去。** 所以通关后 700ms 内不接受"按跳重开"，并且忽略长按产生的重复按键。
- **立牌会挡东西。** 大富翁里正对镜头的立牌（`.bb`）离镜头近时会盖住小人，也会伸出棋盘压到下面的按钮。起点的"起点"两个字因此是平铺在格子上的。
- **3D 里的 `transition: transform`。** 小人的位置用 `translate3d` 过渡，跳跃用里面一层单独的元素做动画，两者不要写在同一个元素上，否则会互相覆盖。
- **手机横屏很矮。** `css/pages.css` 和 `css/extra.css` 末尾各有一段 `@media (max-height: 460px)`，新加的页面也要在这里处理，并用 e2e 的 landscape 截图确认按钮没有被裁到屏幕外。
- **音频请求被"中止"不是错误。** 切歌时把播放位置设回 0，浏览器会中止旧请求再重新请求，测试里会看到 `ERR_ABORTED`。判断音乐是否正常，要看播放进度有没有往前走。
- **背景音乐和音效分开静音。** 音效出错时只关音效，不要连背景音乐一起静音。
