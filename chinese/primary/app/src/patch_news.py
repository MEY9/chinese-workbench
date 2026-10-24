# -*- coding: utf-8 -*-
"""新闻一级导航:60s API 多实例容错 + 本地缓存 + AI 摘要"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
src = open('app.js', encoding='utf-8').read()
n0 = len(src)

def rep(old, new, cnt=1):
    global src
    assert src.count(old) == cnt, 'anchor count=%r: %s' % (src.count(old), old[:70])
    src = src.replace(old, new)
    open('app.js', 'w', encoding='utf-8').write(src)

# 1) NAV + 路由 + ui
rep("['classroom','课堂','M4 13a8 8 0 0 1 16 0'],",
    "['news','新闻','M3 5h14v10H7l-4 4V5zm14 3h4v12l-4-4h-2z'],")
rep("case'rollcall':body=renderRollcall();break;",
    "case'rollcall':body=renderRollcall();break;case'news':body=renderNews();break;")
rep("profileStudent:null,",
    "profileStudent:null,news:{list:[],date:'',source:'',err:''},newsLoading:false,")

# 2) 视图 + 逻辑
rep("function renderClassroom(){",
"""const NEWS_SOURCES=[
 ['60s.crystelf.top','https://60s.crystelf.top/v2/60s'],
 ['api.elysiayanyu.top','https://api.elysiayanyu.top/v2/60s'],
 ['60s.7se.cn','https://60s.7se.cn/v2/60s'],
 ['60s.mizhoubaobei.top','https://60s.mizhoubaobei.top/v2/60s'],
];
async function newsFetch(force){
  if(ui.newsLoading)return;
  const today=today();
  if(!force&&state.newsCache&&state.newsCache.date===today&&state.newsCache.list.length){ui.news={list:state.newsCache.list,date:state.newsCache.date,source:state.newsCache.source,err:''};renderApp();return}
  ui.newsLoading=true;renderApp();
  for(const [name,url] of NEWS_SOURCES){
    try{
      const r=await fetch(url,{signal:AbortSignal.timeout(9000)});
      const d=await r.json();
      let list=[],date=today,tip='';
      if(Array.isArray(d.data&&d.data.news)){list=d.data.news;date=d.data.date||today;tip=d.data.tip||''}
      else if(Array.isArray(d.data)){list=d.data;date=d.time||today}
      list=list.map(s=>String(s).replace(/^\\d+[、\\. ]\\s*/,''));
      if(list.length){
        state.newsCache={date,list,source:name,tip};ui.dirty=true;await save();
        ui.news={list,date,source:name,err:''};ui.newsLoading=false;renderApp();return;
      }
    }catch(e){/* 试下一个源 */}
  }
  ui.newsLoading=false;ui.news={list:(state.newsCache&&state.newsCache.list)||[],date:(state.newsCache&&state.newsCache.date)||'',source:(state.newsCache&&state.newsCache.source)||'',err:'全部新闻源不可达,显示的是上次缓存(如有)。'};
  renderApp();
}
function renderNews(){
  const n=ui.news;const hasCache=state.newsCache&&state.newsCache.list.length;
  const aiOut=state.aiCache&&state.aiCache['news:'+n.date];
  return heading('新闻 · 每天60秒','来自开源 60s API(多源容错);内容抓取自公开新闻,仅供教师个人浏览。',btn(n.newsLoading?'刷新中…':'↻ 刷新','newsRefresh','sm'))+
  `<div class="grid cols2">
  <section class="card">
    <div class="row space"><h2>${n.date?E(n.date):'今日新闻'} ${n.source?'<span class="pill">'+E(n.source)+'</span>':''}</h2></div>
    ${ui.newsLoading?'<p class="muted">正在从多个新闻源拉取…</p>':
      n.list.length?`<ol class="newslist">${n.list.map(x=>'<li>'+E(x)+'</li>').join('')}</ol>${n.err?'<p class="small" style="color:var(--coral)">'+E(n.err)+'</p>':''}`
      :'<p class="muted">暂无内容。点击右上「刷新」拉取(需要联网;新闻页是全应用唯一主动联网的功能)。</p>'}
    <div class="row mt">${btn('🔊 朗读全部','newsSpeak','sky sm')}${btn('🛑 停止朗读','newsStop','ghost sm')}</div>
    <p class="small muted">隐私说明:新闻拉取不携带任何本机数据;学生数据永不参与。</p>
  </section>
  <section class="stack">
    <div class="card ai-card"><h2>✦ AI 新闻摘要 + 教学联想</h2>
      <div id="newsAIOut">${aiOut?E(aiOut):'<span class="muted small">把今日新闻压缩成 3 句摘要,并联想 1 个可与语文课结合的点(如今日热词/写作素材)。</span>'}</div>
      <div class="row mt">${btn('✦ 生成','newsAI','sky sm')}${aiOut?btn('复制','newsAICopy','grass sm'):''}</div>
    </div>
    <div class="card"><h2>数据来源</h2><p class="small muted">开源项目 <a href="#" data-act="openNewsRepo">vikiboss/60s</a>(MIT),经社区公共实例获取;每日更新,15 条精选。网络不可用时可离线查看当日缓存。</p></div>
  </section></div>`}
function renderClassroom(){""")

# 3) 动作
rep("case'annTool':ui.annTool=el.dataset.tool;renderApp();break;",
"""case'newsRefresh':newsFetch(true);break;
case'newsSpeak':{const n=ui.news;if(!n.list.length){toast('先刷新拉取新闻');break}TTS.speak('今天'+(n.date||'')+'。'+n.list.slice(0,10).join('。'),{rate:0.95});break}
case'newsStop':speechSynthesis.cancel();break;
case'newsAI':{if(!ui.news.list.length){toast('先刷新拉取新闻');break}toast('AI 摘要生成中…');
  try{const out=await DesktopAI.chat([{role:'system',content:'你是语文老师助手。对给出的今日新闻输出:①三句话摘要;②「教学联想」:挑 1 条新闻说明可作课堂写作素材或与语文课结合的点(60字内)。'},{role:'user',content:ui.news.list.join(';')}],0.4);
  state.aiCache=state.aiCache||{};state.aiCache['news:'+ui.news.date]=out;ui.dirty=true;renderApp()}catch(e){toast('AI 失败:'+e.message)}break}
case'newsAICopy':{const t=state.aiCache&&state.aiCache['news:'+ui.news.date];if(!t)break;try{await navigator.clipboard.writeText(t);toast('已复制')}catch(e){toast('复制失败')}break}
case'openNewsRepo':shell.openExternal?shell.openExternal('https://github.com/vikiboss/60s'):window.open('https://github.com/vikiboss/60s','_blank');break;
case'annTool':ui.annTool=el.dataset.tool;renderApp();break;""")

# 4) defaultState + 迁移补齐 newsCache
rep("aiCache:{},widgets:{", "aiCache:{},newsCache:{date:'',list:[],source:''},widgets:{")
rep("state.aiCache=state.aiCache||{};state.widgets=state.widgets||",
    "state.aiCache=state.aiCache||{};state.newsCache=state.newsCache||{date:'',list:[],source:''};state.widgets=state.widgets||")

# 5) 进入新闻页自动拉取(路由处)
rep("case'news':body=renderNews();break;",
    "case'news':body=renderNews();break;")
rep("renderApp();if(storageMode!=='SQLite')throw Error('存储配置错误')",
    "renderApp();if(ui.view==='news')newsFetch(false);if(storageMode!=='SQLite')throw Error('存储配置错误')")

open('app.js', 'w', encoding='utf-8').write(src)
print('news patch done:', n0, '->', len(src))
