# Azure 音色表(教育场景,经本机课件流水线验证)

配置来源:项目根 `.env`(`azure_area=eastasia` + `axure_secret`,读取时按 azure-tts skill 的别名规则兼容 `AZURE_SPEECH_KEY/AZURE_KEY` 等)。**密钥不进 Git、不写日志、不进产物元数据。**

## 用途映射(多个音色按用途选用,一次功能内保持主讲音色稳定)

| 用途 | 音色 | 通用名 | 特点 | 预设 SSML |
|---|---|---|---|---|
| **听写**(默认) | `zh-CN-XiaoxiaoNeural` | 晓晓·女 | 清晰亲切、吐字准,数字/单位读法正确 | rate -10%,style gentle |
| 课文/课件讲解 | `zh-CN-XiaoxiaoNeural` | 晓晓 | 同上,节奏稍快 | rate -5%,style cheerful |
| 古诗文范读 | `zh-CN-YunyangNeural` | 云扬·男 | 专业播音腔,沉稳有韵律感 | rate -15%,style lyrical |
| 低年级互动/儿歌 | `zh-CN-XiaoyiNeural` | 晓伊·女 | 活泼,偏童声感 | +0%,style cheerful |
| 角色/对话(备用) | `zh-CN-YunxiNeural` | 云希·男 | 年轻自然 | +0% |

- 小学场景以**晓晓为主讲、云扬为范读、晓伊为低年级互动**的三音色组合;不追求音色多而杂。
- `style` 仅部分音色支持(晓晓/晓伊支持 cheerful、gentle、lyrical 等;不支持时服务端自动忽略,不报错)。
- 全量音色清单用 SDK 的 `listVoicesAsync` 或查官方表:https://learn.microsoft.com/azure/ai-services/speech-service/language-support

## 接入方式

- **内置软件(本工作台)**:加载 `_shared/tts/azure/speech-sdk.bundle.js` + `azure-tts.js`,设置页只需 region + key(默认已从 .env 带出),见 `azure-tts.js` 头部用法。
- **批处理(课件旁白等离线产物)**:走 azure-tts skill 的 Python `azure-cognitiveservices-speech` 流程,产物存各工作台 `resources/voiceover/`。

## 验收要点(沿用 azure-tts skill)

1. 先生成一小段试听:普通话、断句、多音字(如「乐 yuè/lè」)、数字读法。
2. 听写场景必须逐字清晰、无连读吞字;语速宁慢勿快。
3. 失败或误读 → 改文本/SSML 重生成,**不用静音或残次音频凑数**。
