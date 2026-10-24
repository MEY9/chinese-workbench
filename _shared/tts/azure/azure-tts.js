/*!
 * azure-tts.js — 工作台内置语音合成封装(Azure Speech)
 * 依赖:同目录 speech-sdk.bundle.js(官方 SDK,须先加载)
 * 配置:AZURE key + region 由工作台设置页传入,不写死、不落日志
 * 用法:
 *   const tts = await AzureTTS.create({ key: 'xxx', region: 'eastasia' });
 *   const blob = await tts.speak('秋天来了', { voice: 'zh-CN-XiaoxiaoNeural', rate: '-10%', style: 'gentle' });
 *   new Audio(URL.createObjectURL(blob)).play();
 */
(function (global) {
  'use strict';

  // 教育场景推荐音色(详见 VOICES.md);voice 缺省时按用途取默认
  var PRESETS = {
    dictate:  { voice: 'zh-CN-XiaoxiaoNeural', rate: '-10%', style: 'gentle'   }, // 听写:慢而清晰
    narrate:  { voice: 'zh-CN-XiaoxiaoNeural', rate: '-5%',  style: 'cheerful' }, // 课文/课件讲解
    classical:{ voice: 'zh-CN-YunyangNeural',  rate: '-15%', style: 'lyrical'  }, // 古诗文范读
    lively:   { voice: 'zh-CN-XiaoyiNeural',   rate: '+0%',  style: 'cheerful' }  // 低年级互动
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildSSML(text, opt) {
    // style 为可选项:仅部分音色支持(见 VOICES.md),不支持时由服务端忽略
    var styleTag = opt.style
      ? '<mstts:express-as style="' + esc(opt.style) + '">'
      : '';
    var styleClose = opt.style ? '</mstts:express-as>' : '';
    return '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"' +
           ' xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">' +
           '<voice name="' + esc(opt.voice) + '">' +
           '<prosody rate="' + esc(opt.rate || '+0%') + '" pitch="' + esc(opt.pitch || '+0Hz') + '">' +
           styleTag + esc(text) + styleClose +
           '</prosody></voice></speak>';
  }

  var AzureTTS = {
    /**
     * @param {object} cfg { key: Azure Speech key, region: 如 'eastasia' }
     */
    create: function (cfg) {
      if (!cfg || !cfg.key || !cfg.region) {
        return Promise.reject(new Error('AzureTTS: 缺少 key 或 region 配置'));
      }
      if (!global.SpeechSDK) {
        return Promise.reject(new Error('AzureTTS: 请先加载 speech-sdk.bundle.js'));
      }
      var SDK = global.SpeechSDK;
      var speechConfig = SDK.SpeechConfig.fromSubscription(cfg.key, cfg.region);
      speechConfig.speechSynthesisOutputFormat =
        SDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

      var synthesizer = new SDK.SpeechSynthesizer(speechConfig, null /* null=内存返回 */);

      return {
        /**
         * @param {string} text 待合成文本
         * @param {object} [opt] { preset:'dictate|narrate|classical|lively',
         *                          voice, rate, pitch, style } — 显式项覆盖 preset
         * @returns {Promise<Blob>} mp3 音频
         */
        speak: function (text, opt) {
          opt = Object.assign({}, PRESETS[(opt && opt.preset) || 'narrate'], opt || {});
          return new Promise(function (resolve, reject) {
            synthesizer.speakSsmlAsync(
              buildSSML(text, opt),
              function (result) {
                if (result.reason === SDK.ResultReason.SynthesizingAudioCompleted) {
                  resolve(new Blob([new Uint8Array(result.audioData)],
                                   { type: 'audio/mpeg' }));
                } else {
                  reject(new Error('AzureTTS 合成失败: ' + result.errorDetails));
                }
              },
              function (err) { reject(new Error('AzureTTS 错误: ' + err)); }
            );
          });
        },
        /** 播放并返回 Audio 元素(便于控制暂停/事件) */
        play: function (text, opt) {
          return this.speak(text, opt).then(function (blob) {
            var audio = new Audio(URL.createObjectURL(blob));
            audio.play();
            return audio;
          });
        },
        /** 释放底层资源(页面长期驻留时在设置变更后调用) */
        dispose: function () { synthesizer.close(); }
      };
    },
    PRESETS: PRESETS
  };

  global.AzureTTS = AzureTTS;
})(window);
