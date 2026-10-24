# -*- coding: utf-8 -*-
"""
生成部编版三年级上册内置词库 wordbank.js
数据:人工(模型知识)写入 LESSONS;pinyin 由 pypinyin 本地生成,人工覆盖个别课文特殊读音。
诚实标注:conf=high 是高把握课文;conf=mid 为待校对(软件 UI 会提示)。
"""
import json, io, sys
from pypinyin import pinyin, Style

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# conf: high=高把握 / mid=请校对
LESSONS = [
 {"no":1,"title":"大青树下的小学","conf":"high",
  "chars":"晨绒球汉艳装扮演读静停粗影",
  "words":["早晨","穿戴","鲜艳","服装","打扮","安静","停止","粗壮","影子"]},
 {"no":2,"title":"花的学校","conf":"mid",
  "chars":"荒笛狂罚怒裳壁雷",
  "words":["荒野","口笛","跳舞","狂欢","罚站","发怒","衣裳","墙壁"]},
 {"no":4,"title":"古诗三首(山行/赠刘景文/夜书所见)","conf":"high",
  "chars":"寒径斜霜赠刘盖菊残君橙挑送",
  "words":["寒山","石径","霜叶","菊花","橙子","送别"]},
 {"no":5,"title":"铺满金色巴掌的水泥道","conf":"high",
  "chars":"铺泥晶紧院印排列规则乱棕迟",
  "words":["水泥","放晴","明朗","亮晶晶","金黄","雨珠","落叶","规则","凌乱"]},
 {"no":6,"title":"秋天的雨","conf":"high",
  "chars":"盒颜料票飘争仙闻梨勾曲丰",
  "words":["清凉","留意","颜料","枫叶","邮票","果树","菊花","气味","香甜","丰收"]},
 {"no":8,"title":"卖火柴的小女孩","conf":"mid",
  "chars":"柴旧裙怜饿乎焰烘暖烛富",
  "words":["火柴","旧围裙","可怜","饥饿","火焰","暖烘烘","蜡烛","富有"]},
 {"no":15,"title":"搭船的鸟","conf":"high",
  "chars":"搭亲父沙啦响羽翠嘴悄吞哦",
  "words":["搭船","母亲","羽毛","翠鸟","嘴巴","悄悄","吞下","下雨"]},
 {"no":16,"title":"金色的草地","conf":"high",
  "chars":"蒲英盛耍喊欠钓而察拢趣喜",
  "words":["蒲公英","玩耍","喊叫","哈欠","钓鱼","观察","合拢","有趣","喜爱"]},
 {"no":17,"title":"古诗三首(望天门山/饮湖上初晴后雨/望洞庭)","conf":"mid",
  "chars":"断楚至孤帆饮初镜未磨遥银盘",
  "words":["天门山","中断","孤帆","日出","西湖","比喻","银盘"]},
 {"no":18,"title":"富饶的西沙群岛","conf":"mid",
  "chars":"富饶岛屿栖岩虾鸟宝贵业产",
  "words":["富饶","群岛","岛屿","栖息","岩石","龙虾","海鸟","宝贵","物产"]},
 {"no":19,"title":"海滨小城","conf":"high",
  "chars":"滨灰帆渔遍躺载靠栽亚夏除",
  "words":["海滨","灰色","帆船","渔船","遍地","满载","栽树","亚热带","夏天"]},
 {"no":20,"title":"美丽的小兴安岭","conf":"mid",
  "chars":"脑袋严实挡视坛显材软库欣",
  "words":["小兴安岭","脑袋","严实","挡住","视线","花坛","显得","木材","软绵绵","欣赏"]},
 {"no":21,"title":"大自然的声音","conf":"high",
  "chars":"妙演奏琴柔感受激击器滴敲",
  "words":["美妙","演奏","感受","温柔","激动","乐器","水滴","敲打"]},
 {"no":24,"title":"司马光","conf":"high",
  "chars":"司光登跌众弃持",
  "words":["司马光","庭院","跌倒","众人","放弃","坚持"]},
 {"no":25,"title":"掌声","conf":"mid",
  "chars":"掌班默腿轮投调摇晃烈勇",
  "words":["掌声","文静","默默","轮流","讲台","勇气","热烈","持久"]},
 {"no":26,"title":"灰雀","conf":"high",
  "chars":"雀郊养粉谷粒男或者冻惜肯",
  "words":["灰雀","郊外","养病","谷粒","男孩","或者","可惜","肯定"]},
]

# 个别字在课文语境下的特殊读音(覆盖 pypinyin 默认)
OVERRIDES = {4: {"挑": "tiǎo"}, 6: {"曲": "qǔ"}}

def py_char(c):
    r = pinyin(c, style=Style.TONE, errors=lambda x: [x])
    return r[0][0]

def py_word(w):
    if len(w) == 1:
        return py_char(w)
    ps = pinyin(w, style=Style.TONE, errors=lambda x: [x])
    return " ".join(p[0] for p in ps)

out = {"version": "部编版", "grade": 3, "term": "上",
       "note": "内置样例词库:拼音经 pypinyin 校验;conf=mid 课文内容请教师校对",
       "lessons": []}

for L in LESSONS:
    no = L["no"]
    ovs = OVERRIDES.get(no, {})
    chars = [{"c": c, "p": ovs.get(c) or py_char(c)} for c in L["chars"]]
    words = [{"w": w, "p": py_word(w)} for w in L["words"]]
    out["lessons"].append({"no": no, "title": L["title"], "conf": L["conf"],
                           "chars": chars, "words": words})

json.dump(out, open("bank.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
n_lessons = len(out["lessons"])
n_chars = sum(len(l["chars"]) for l in out["lessons"])
n_words = sum(len(l["words"]) for l in out["lessons"])
print(f"OK {n_lessons} lessons, {n_chars} chars, {n_words} words -> bank.json")
# 抽查打印
for l in out["lessons"][:3]:
    print(l["no"], l["title"], "|", "".join(c["c"] for c in l["chars"]), "|", l["words"][0]["w"], l["words"][0]["p"])
