# 语文工作台 · 小学语文教师桌面工作台


<video src="docs/media/demo.mp4" controls muted playsinline width="270"></video>

> 视频打不开?直接下载 [docs/media/demo.mp4](docs/media/demo.mp4)

完全本地运行(数据存本机 SQLite,不上云)的小学语文教师日常工作台:班级名册、教学进度、课堂点名/听写/背诵、批改记录、学生档案(一生一档)、成绩册、A4 打印中心、期末评语、AI 辅助(DeepSeek,可选)。

## 快速开始(教师)

1. 到 [Releases](../../releases) 下载最新的 `语文工作台 Setup xxx.exe`,双击安装
2. 打开应用 →「班级」建立班级、下载名册模板、导入学生
3. (可选)「设置」填入 DeepSeek API Key 启用 AI 功能

> Release 安装包为**零教材版**(教材 PDF 有版权,不随公共仓库分发)。如需内置教材 PDF 阅读:安装后在应用目录的 `resources/textbooks/` 放入 PDF,并按 `app/textbooks-manifest.json` 的结构登记。

## 从源码运行

```bash
# 浏览器版(本地服务 + 页面)
cd chinese/primary/app
python server.py            # 打开 http://127.0.0.1:8765

# 桌面版(Electron)
cd chinese/primary/desktop
npm install
python ../app/build.py      # 生成渲染层(需 Python 3)
npm start
```

## 从源码打包 Windows 安装包

```bash
cd chinese/primary/desktop
npm install
npx electron-builder --win --x64
# 产物在 dist/
```

带教材打包:把教材 PDF 放入 `app/textbooks/` 并登记 manifest,再执行 `python app/build.py` 与 electron-builder。

## 架构

- `chinese/primary/app/` — 应用本体(单文件 HTML 渲染层 + Python 构建脚本 + 本地 SQLite 服务器)
  - `src/app.js` 渲染层(零依赖原生 JS)· `src/style.css` 分层设计系统(L1 令牌 … L14 组件)
  - `server.py` 本地服务器(SQLite 事务存储 / 静态服务 / 新闻与 AI 代理)
  - `build.py` 构建(内联 CSS/JS/词库/PDF.js/logo,产物单文件 `index.html`)
- `chinese/primary/desktop/` — Electron 壳(主进程 IPC:SQLite/打印/AI/新闻;preload 桥)
- `chinese/primary/docs/` — PRD、审批记录、调研报告
- `_shared/` — 跨工作台可复用资产(TTS/AI 客户端/提示词模板)

## 隐私

学生数据仅存本机;AI 为可选功能,默认脱敏(不发送姓名);新闻为唯一主动联网功能且不携带任何本机数据。

---

## 📞 联系我

**定制开发 · 建议 · 反馈**,扫码加我:

<img src="docs/media/contact.jpg" width="270" alt="联系我"/>

## ☕ 赞赏

工具帮到了你的话,请我喝杯咖啡:

<img src="docs/media/donate.jpg" width="270" alt="赞赏码"/>

## 📱 关注我们

| 小红书 **AI工作台** | 公众号 **见山知文** |
|:---:|:---:|
| <img src="docs/media/xhs.jpg" width="200"/> | <img src="docs/media/gzh.jpg" width="200"/> |
