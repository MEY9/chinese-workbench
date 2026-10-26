# 语文工作台 · 小学语文教师桌面工作台


<video src="docs/media/demo.mp4" controls muted playsinline width="270"></video>

> 视频打不开?直接下载 [docs/media/demo.mp4](docs/media/demo.mp4)

完全本地运行(数据存本机 SQLite,不上云)的小学语文教师日常工作台:班级名册、教学进度、课堂点名/听写/背诵、批改记录、学生档案(一生一档)、成绩册、A4 打印中心、期末评语、AI 辅助(DeepSeek,可选)。

## 快速开始(教师)

1. 到 [Releases](../../releases) 下载安装包,双击安装:
   - 正式安装包适用于 Windows x64，默认内置教材 PDF；当前包含人教社统编版 1–6 年级上下册，共 12 册。
   - 版本变更与验证范围见 [v3.0.8 发布说明](chinese/primary/docs/releases/v3.0.8.md)。
2. 打开应用 →「班级」建立班级、下载名册模板、导入学生
3. (可选)「设置」填入 DeepSeek API Key 启用 AI 功能

> 本项目为教师个人教学用途,非商业分发;教材 PDF 版权归人民教育出版社所有。

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
# 没有教材 PDF 时，先设置 WB_CI=1 并运行 python ../app/build.py
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

## 正式发布规则

用户已明确要求：今后正式 EXE 安装包默认包含教材 PDF，不得以无教材版代替。先运行 `python chinese/primary/desktop/package-release.py`，该脚本构建完整包、运行检查并生成校验文件。发布 `desktop/dist/release/` 中当前版本的完整安装包。详细规则见 [发布约定](chinese/primary/docs/releases/发布约定.md)。GitHub Actions 只检查无教材源码构建，不会自动发布精简版。
