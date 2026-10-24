/*!
 * openai-client.js — 工作台通用 OpenAI 兼容客户端(零依赖,原生 fetch)
 * 覆盖三类能力,教师设置页为每类填 { apiKey, baseURL, model } 即可:
 *   1. 文字(DeepSeek 等):chat()
 *   2. 图像(.env 的 gptapi 中转等):image()      — 开发期生成 UI 视觉稿
 *   3. 语音(硅基流动等):speech()               — 实时 TTS 升级项
 * 约定:key 只在内存/localStorage,随请求头发往用户自填的 baseURL。
 */
(function (global) {
  'use strict';

  function check(cfg, name) {
    if (!cfg || !cfg.apiKey || !cfg.baseURL) {
      throw new Error(name + ': 缺少 apiKey 或 baseURL 配置');
    }
  }

  var client = {
    /** 对话补全。messages: [{role:'system'|'user'|'assistant', content}] */
    chat: function (cfg, messages, opt) {
      check(cfg, 'chat');
      opt = opt || {};
      return fetch(cfg.baseURL.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.apiKey
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: messages,
          temperature: opt.temperature != null ? opt.temperature : 0.7,
          stream: false
        })
      }).then(function (r) {
        if (!r.ok) throw new Error('chat HTTP ' + r.status + ': ' + r.statusText);
        return r.json();
      }).then(function (d) { return d.choices[0].message.content; });
    },

    /** 图像生成(文生图)。返回 PNG Blob。size 需用端点支持值,如 '1536x1024' */
    image: function (cfg, prompt, opt) {
      check(cfg, 'image');
      opt = opt || {};
      return fetch(cfg.baseURL.replace(/\/$/, '') + '/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.apiKey
        },
        body: JSON.stringify({
          model: cfg.model,
          prompt: prompt,
          size: opt.size || '1536x1024',
          quality: opt.quality || 'high'
        })
      }).then(function (r) {
        if (!r.ok) throw new Error('image HTTP ' + r.status + ': ' + r.statusText);
        return r.json();
      }).then(function (d) {
        var item = d.data[0];
        if (item.b64_json) {
          var bytes = atob(item.b64_json), arr = new Uint8Array(bytes.length);
          for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
          return new Blob([arr], { type: 'image/png' });
        }
        return fetch(item.url).then(function (ir) { return ir.blob(); }); // url 型立即下载
      });
    },

    /** 实时 TTS(OpenAI 兼容 /audio/speech,硅基流动等)。返回音频 Blob */
    speech: function (cfg, text, opt) {
      check(cfg, 'speech');
      opt = opt || {};
      return fetch(cfg.baseURL.replace(/\/$/, '') + '/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.apiKey
        },
        body: JSON.stringify({
          model: cfg.model,
          input: text,
          voice: opt.voice || 'FunAudioLLM/CosyVoice2-0.5B:alex', /* 端点音色命名以文档为准 */
          response_format: opt.format || 'mp3',
          speed: opt.speed || 1.0
        })
      }).then(function (r) {
        if (!r.ok) throw new Error('speech HTTP ' + r.status + ': ' + r.statusText);
        return r.blob();
      });
    },

    /** 设置页「测试连接」:最小请求,返回耗时 ms */
    testChat: function (cfg) {
      var t0 = performance.now();
      return this.chat(cfg, [{ role: 'user', content: 'hi' }], { temperature: 0 })
        .then(function () { return Math.round(performance.now() - t0); });
    }
  };

  global.WorkbenchAPI = client;
})(window);
