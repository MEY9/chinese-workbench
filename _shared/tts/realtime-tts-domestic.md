# 实时语音生成 · 国内平台调研(教师自助配置向)

> 使用场景:工作台功能需要**实时生成语音**(如听写随机报词、AI 生成的评语朗读),且由教师本人填 key 使用。
> 调研日期:2026-10-22。结论先行:**推荐硅基流动(SiliconFlow)作为实时 TTS 默认平台**,与 DeepSeek 共用同一个"OpenAI 兼容设置页"模式。

## 对比

| 平台 | 接口形态 | 教师需填的内容 | 上手难度 | 中文音色质量 | 结论 |
|---|---|---|---|---|---|
| **硅基流动 SiliconFlow** | **OpenAI 兼容** `POST /v1/audio/speech` | apikey + baseurl(`https://api.siliconflow.cn/v1`)+ 模型名 | ★ 最低,与 DeepSeek 设置页完全同构 | 好(CosyVoice2 等,自然度高) | ✅ **默认推荐** |
| 火山引擎·豆包语音 | 私有 REST/WS,需 APPID + Access Token + Cluster 多参数 | 3 项以上,无 baseurl 概念 | ★★★ | 顶级(情感/多情感) | 备选:追求音质且有人协助时 |
| MiniMax | REST,需 group_id + api_key 双参数 | 2 项,非 baseurl 模式 | ★★ | 好(可克隆) | 备选 |
| 科大讯飞 | WebSocket + 签名(HMAC 阶梯鉴权) | appid/secret 双 key + 签名逻辑 | ★★★★ | 好 | 不推荐教师自助 |
| 腾讯云/阿里云 TTS | 私有 SDK,SecretId/Key + 地域 + 签名 | 4 项以上 | ★★★★ | 好 | 不推荐教师自助 |
| 浏览器内置 `speechSynthesis` | 本地 API | **零配置** | ★ | 因系统而异(Win 中文可用) | ✅ **永远作为无 key 时的免费降级** |

## 推荐方案(已定)

1. **默认**:浏览器内置 TTS(零配置,离线可用)——P0 听写即用此。
2. **升级**:设置页新增「语音服务」区,三件套与 AI 区一致:
   - API Key(硅基流动控制台 cloud.siliconflow.cn 创建)
   - Base URL(默认 `https://api.siliconflow.cn/v1`)
   - 模型名(默认 `FunAudioLLM/CosyVoice2-0.5B`,可填 `fnlp/MOSS-TTSD-v0.5` 等)
   调用:`POST {baseurl}/audio/speech`,body `{model, input, voice, response_format:'mp3', speed}`,Bearer 鉴权,**响应即音频流**,播放/下载均可。
3. 教师引导文案:"打开 cloud.siliconflow.cn 注册 → 复制 API 密钥 → 粘贴到这里",两步完成,不出现任何技术术语。

## 设置页合并设计(教师视角,只填一次)

```
设置
├─ AI 文字服务(DeepSeek)   key + baseurl + 模型   ← P0 已定
├─ 语音服务(可选)          key + baseurl + 模型   ← 本调研结论,同构复用
└─ 内置语音(Azure)         自动用本机配置,教师无需填  ← VOICES.md
```

三个区都是"有 key 用云,无 key 用内置/免费"的降级链,教师只在想要更好效果时才填。

## 参考

- 硅基流动语音合成文档:https://docs.siliconflow.com/cn/userguide/capabilities/text-to-speech
- OpenAI SDK 兼容性说明(改 key/baseurl/模型三处即可):https://www.siliconflow.com/blog/openai-sdk-siliconflow-compatibility-checks
- 请求示例(Python,验证协议兼容):https://docs.siliconflow.cn/en/userguide/capabilities/text-to-speech
