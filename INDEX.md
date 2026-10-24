# 工作台索引

> 多工作台平台的总入口。开发流程见 [PROCESS.md](PROCESS.md)(小红书调研 → 审批 → AI 生图 → 审批 → 开发);可复用资产沉淀在 `_shared/`。

## 工作台清单

| 科目 | 学段 | 名称 | 状态 | 入口 | 备注 |
|---|---|---|---|---|---|
| chinese | primary | 小学语文教师工作台 | **开发完成并持续迭代(2026-10-24,v2.6.1)**：桌面应用——M0–M3 全部功能 + 厚重书册质感 + 内联校验/涟漪/Toast 交互体系 + PDF 引擎内联(标注器可用) + 新闻一级导航(服务端/主进程代抓,无 CORS) + 品牌可自定义(设置页改名称/标语) + 确认框前置(保存冻结根治);R1 回归全绿。待办:macOS 打包、A3/A6 实验项。范围：五幕工作流 + AI 全线赋能（A1–A13）+ 学生档案 P0 + 特色组件（跑马灯/时钟）+ 教材标注划线；技术：Electron+TS，打包 exe/dmg | **唯一 PRD**：`chinese/primary/docs/PRD-语文教师工作台-v1.0.md`；架构：`docs/技术架构-v3-桌面化.md`；审批记录：`docs/审批与变更记录.md`；**G1 视觉 14 页概念图已提交待批**：`design/concepts/prd-v1-g1/`（README 含逐页清单）；历版文档已归档 `archive/docs-20261024/` |

> 2026-10-23：小学语文教师工作台的[补充调研](chinese/primary/research/xhs/teacher_workbench_20261023/调研结论.md)、[PRD v1](chinese/primary/docs/PRD-教师工作台-v1-待审.md)和[六张新版视觉候选图](chinese/primary/design/concepts/teacher-workbench-v1/README.md)已形成。用户回复“通过”，[G0/G1 已记录批准](chinese/primary/docs/acceptance/G0-G1-审批记录.md)，R1 代码开发完成；旧 P0 状态仅指上一版工具原型。

状态机:调研中 → PRD 已批 → 视觉待审 → 开发中 → 已交付

## 共享资产 `_shared/`(新工作台开发前先查这里)

| 资产 | 路径 | 说明 |
|---|---|---|
| 开发流程 | `../PROCESS.md` | 两道审批门的完整流程,所有工作台强制走 |
| UI 生图提示词模板 | `prompts/ui-image-prompt-template.md` | 七段结构 + 小学/初中/高中风格变体,实战验证零乱码 |
| OpenAI 兼容客户端 | `api/openai-client.js` | chat / image / speech 三合一,零依赖;配套设置页三件套模式 |
| Azure 内置语音 SDK | `tts/azure/speech-sdk.bundle.js` | 微软官方浏览器版(v1.45.0,1.15MB,本地化无 CDN) |
| Azure 语音封装 | `tts/azure/azure-tts.js` | speak/play + 教育音色预设(听写/讲解/古诗文/低年级) |
| Azure 音色表 | `tts/azure/VOICES.md` | 用途→音色映射与验收要点;配置读根 .env,密钥不落盘 |
| 实时 TTS 平台调研 | `tts/realtime-tts-domestic.md` | 结论:硅基流动(OpenAI 兼容)为教师自助默认;浏览器 TTS 永远兜底 |

## 语音决策树(所有工作台统一)

```
需要语音?
├─ 实时生成(内容随运行变化)
│   ├─ 教师配了语音服务 key → 硅基流动 /audio/speech(与 DeepSeek 同一设置页模式)
│   └─ 未配置 → 浏览器内置 speechSynthesis(零配置兜底)
└─ 内置随软件交付(离线可用)
    → Azure Speech(.env 配置,SDK 已沉淀 _shared/tts/azure/),音色按 VOICES.md 用途表
```

## 配置约定

- 密钥只放项目根 `.env`(开发期)或工作台设置页(交付后,存用户本机 localStorage),**不进 Git、不进产物**
- 当前 `.env` 相关变量:`OPENAI_API_KEY` / `OPENAI_BASE_URL`(生图+文字中转)、`GPT_IMAGE_MODEL_NAME`、`azure_area` + `axure_secret`(Azure Speech,别名兼容 AZURE_SPEECH_KEY)
- 新增平台能力先在本文件登记,再进 `PROCESS.md` 流程
