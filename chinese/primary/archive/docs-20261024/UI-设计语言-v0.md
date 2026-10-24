# 语文老师工作台 · UI 设计语言 v0 ——「案头纸墨」

> 一句话:一位语文老师的**书桌**——宣纸打底、朱砂批注、楷体旁批、印章落款。有材质、有手作感,但零依赖、单文件、几十 KB。

## 1. 为什么是这个方向(调研结论)

- 2025–26 的主流趋势报告里,"calm interfaces(安静界面)"与"微组件质感(texture/skeuomorphic touches)"是被反复点名的反仪表盘方向;而"有质感的手工个人工具"在独立软件圈正是小众但鲜明的审美,天然避开烂大街([Tubik 2026 趋势](https://tubikstudio.com/blog/ui-design-trends-2026)、[Envato 2026 趋势](https://elements.envato.com/learn/ux-ui-design-trends)、[LinkedIn: 仪表盘中加入质感微组件](https://www.linkedin.com/pulse/how-apply-20252026-design-trends-dashboards-saas-products-zirva-zahid-sbyvf))
- 纸质纹理的轻量实现已有成熟方案与实战案例:内联 SVG `feTurbulence` 数据 URI 替代纹理图,体积从几百 KB 降到几百字节([Common Paper 案例:图片体积降 99%](https://commonpaper.com/blog/speeding-up-common-paper-reducing-image-size-by-99)、[CSS-Tricks: Grainy Gradients](https://css-tricks.com/grainy-gradients)、[Codrops 教程](https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence))
- 语文这门学科自带现成的视觉母题:**红笔朱批、田字格、四线三格、印章、楷体旁批、着重号**——别的学科抄不走,通用工具更没有。材质不用发明,从学科里取。

## 2. 禁用清单(杜绝烂大街)

| 禁用 | 替代 |
|---|---|
| 蓝紫渐变 hero / Tailwind 默认蓝 | 宣纸米白底 + 朱砂红点缀 |
| SaaS 仪表盘(左侧栏+顶栏+KPI 卡片阵列) | 案头桌面隐喻:物件有机摆放,非等距网格 |
| 玻璃拟态大 Blur / 大圆角 16px+ 胶囊 | 纸张卡片:小圆角 4–6px、细边线、软阴影 |
| Inter + 无衬线一统天下 | 界面黑体 + 标题批注楷体 + 正文宋体,系统自带 |
| emoji 当图标 | 10 个内联 SVG 线性图标 |
| 发光渐变按钮 | 朱砂实色钮 / 描边钮,按下微下沉 |

## 3. 调色板(中国传统色,全部 CSS 变量)

| 令牌 | 色值 | 用途 |
|---|---|---|
| `--paper` | `#F5F1E6` | 宣纸底色,全局背景 |
| `--sheet` | `#FCFAF3` | 纸张卡片面 |
| `--ink` | `#2A2620` | 墨色主文字 |
| `--ink-2` | `#6B6353` | 淡墨次级文字 |
| `--line` | `#E3DBC8` | 纸边线、分隔线 |
| `--zhu` | `#B5453C` | **朱砂**:主强调、按钮、朱批、印章 |
| `--dian` | `#3D5A6C` | 靛青:链接、蓝批(替代烂大街蓝) |
| `--tai` | `#6B7F4E` | 苔绿:成功/完成态 |
| `--zhe` | `#A9744F` | 赭石:提醒/待办 |
| 夜读模式 | 背景 `#211E19`、纸面 `#2A2620`、文字 `#D9D0BC`、朱砂提亮 `#C9584E` | 暖色夜灯,不用冷黑 |

朱砂是全局唯一的高饱和色,**只给"教师动作"**(批、改、判、确认),装饰一律不用——让红色保住"批改"的语义重量。

## 4. 字体(零下载,系统自带)

```css
--font-ui:  "PingFang SC","Microsoft YaHei UI","Segoe UI",sans-serif;  /* 界面 */
--font-kai: "Kaiti SC","KaiTi","STKaiti",serif;   /* 标题、旁批、评语——老师的笔 */
--font-song:"Songti SC","SimSun",serif;           /* 作文正文、打印——学生的纸 */
--font-num: "Segoe UI",ui-monospace,monospace;    /* 分数、统计数字,tabular-nums */
```

## 5. 材质系统(轻量实现,总预算 < 1KB 纹理)

1. **纸纹颗粒**:全局一层内联 SVG `feTurbulence` fractalNoise,`opacity .35`,几百字节,替代任何纹理图片
2. **纸张卡片**:`--sheet` 面色 + 1px `--line` 边 + 双层软阴影(`0 1px 2px` 贴地 + `0 10px 30px` 漫射,色相偏暖棕);圆角 5px
3. **印章**:朱砂底 + 楷体白字 + 印泥不匀(radial-gradient 内浅外深 + 颗粒),旋转 -3°~5°;用于 logo、「已批」「优」落款,全屏不超过 2 枚
4. **朱批三件套**(作文批改视图):病句 = 朱砂波浪线 `text-decoration: underline wavy`;亮点 = 靛青下划点;强调 = `text-emphasis: filled dot`(着重号,中文排版原生特性,UI 里几乎没人用)
5. **田字格 / 四线三格**:纯 CSS 虚线网格,生字卡与拼音的天然材质
6. **便签**:米黄 `#F3E8C9`,楷体,顶部一条粘胶压边,允许 ±1.5° 微旋转——桌面"活物"感
7. **书脊标签**:模块名竖排 `writing-mode: vertical-rl`,像备课本的书签页

## 6. 布局:案头隐喻,三层结构

```
┌─ 笔杆条(顶栏 48px):印章 +「某老师的案头」…… 学段·册别备课本标签 …… 设置 ⚙
├─ 案头(首页):
│    [备课本 ↖2°]  [听写卡堆 ↘1°]  [作文本堆]   ← 有机摆放、大小不一
│    [便签:今日待办]                 [成绩册]
│    物件 = 入口,hover 时"拿起"(抬升+阴影加深+转正)
├─ 铺纸(工具全屏页):一张大纸铺开占满,左缘竖排「返回」书签页
│    阅读区限宽 46em,打印视图与屏幕视图同一套材质
└─ Ctrl+K 命令面板:老手快跳,案头的"抽屉"
```

- 首页**不是等距卡片网格**:物件带微旋转、微错位,像真的桌面;但栅格对齐隐藏在底下(视觉乱、骨架齐)
- 打开工具 = 转场"铺纸"(160ms,translateY + 阴影展开),无弹窗轰炸
- `prefers-reduced-motion` 全部降级为渐隐

## 7. 动效与手感

- 时长 140–200ms,`ease-out`,只做"拿起/放下/铺开"三种物理隐喻
- 按钮 active = 下沉 1px + 阴影收紧(盖章手感)
- 无 parallax、无 bounce、无自动轮播

## 8. 轻便约束(与"完全本地化"一致)

- 零依赖:无框架、无图标库、无 webfont、无图片文件
- 纹理 = SVG data URI;图标 = ≤10 个内联 SVG;CSS 目标 < 25KB;JS 原生
- 打印样式直接复用纸面材质(所见即所打,老师要的就是能打印)

## 9. 小样

`design/style-tile.html` —— 单文件材质小样,含调色板、纸张/印章/朱批/田字格/便签/按钮/夜读切换,直接双击打开。
