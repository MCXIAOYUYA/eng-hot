"""
ENG·HOT 内容流水线
==================
信源抓取 → AI 摘要/打标 → 热度评分 → 输出前端数据文件

用法(本地):
    pip install requests beautifulsoup4 feedparser anthropic
    export ANTHROPIC_API_KEY=sk-...
    python pipeline.py            # 全量跑
    python pipeline.py --no-ai    # 跳过 AI 摘要(调试抓取用)

产出:
    ../web/src/data.js   前端直接 import 的数据模块
    ./raw_items.json     抓取的原始条目(留档/调试)
"""

import argparse
import hashlib
import json
import math
import os
import re
import sys
import time
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

try:
    import feedparser  # RSS 信源用
except ImportError:
    feedparser = None

# ----------------------------------------------------------------------------
# 1. 信源配置 —— 加新信源只改这里
#    weight: 信源权重 0~1,进热度公式
#    kind:   rss | html
#    selector: html 信源的条目选择器(链接元素)
#    注:RSS 地址若失效,去对应站点页脚的 RSS 入口更新即可
# ----------------------------------------------------------------------------
#    topic:     该信源条目的默认主题(AI 关掉时用;AI 开启会覆盖)
#    evergreen: True 则豁免时效衰减(教程/常青材料),按固定新鲜度计热度
#    strip:     从标题里剥掉的前缀(RSS 里常带栏目名)
SOURCES = [
    {
        # 分级新闻,带真实日期,时效性最强 —— 站点的"热点"主力
        "id": "bne",
        "name": "Breaking News English",
        "kind": "rss",
        "url": "https://breakingnewsenglish.com/rss.xml",
        "weight": 0.85,
        "lang": "en",
        "topic": "reading",
        "limit": 10,
    },
    {
        # 经典听力节目,常青,数百集
        "id": "bbc_6min",
        "name": "BBC 6 Minute English",
        "kind": "rss",
        "url": "https://feeds.bbci.co.uk/learningenglish/english/features/6-minute-english/rss",
        "weight": 0.95,
        "lang": "en",
        "topic": "listening",
        "evergreen": True,
        "strip": "BBC Learning English - 6 Minute English / ",
        "limit": 7,
    },
    {
        # 地道口语表达 / 习语
        "id": "bbc_tews",
        "name": "BBC The English We Speak",
        "kind": "rss",
        "url": "https://feeds.bbci.co.uk/learningenglish/english/features/the-english-we-speak/rss",
        "weight": 0.9,
        "lang": "en",
        "topic": "vocab",
        "evergreen": True,
        "strip": "BBC Learning English - The English We Speak / ",
        "limit": 6,
    },
    {
        # 职场英语情景剧
        "id": "bbc_work",
        "name": "BBC English at Work",
        "kind": "rss",
        "url": "https://feeds.bbci.co.uk/learningenglish/english/features/english-at-work/rss",
        "weight": 0.85,
        "lang": "en",
        "topic": "speaking",
        "evergreen": True,
        "strip": "BBC Learning English - English at Work / ",
        "limit": 3,
    },
    # HTML 信源示例(需按目标页 DOM 调 selector);官方考试信息建议进 seed_items.json
]

TOPICS = ["vocab", "listening", "speaking", "reading", "exam", "method", "news"]

HEADERS = {"User-Agent": "Mozilla/5.0 (eng-hot content pipeline; personal project)"}

# ----------------------------------------------------------------------------
# 2. 数据模型
# ----------------------------------------------------------------------------
@dataclass
class Item:
    id: str
    title: str
    url: str
    source: str
    source_weight: float
    captured: str                    # YYYY-MM-DD 抓取日期
    published: str = ""              # 原文日期(拿得到就填)
    time: str = ""                   # 原文时间 HH:MM(拿得到就填,前端展示到分钟)
    summary: str = ""                # AI 摘要
    reason: str = ""                 # AI 推荐理由:一句话说清对学习者的价值
    topic: str = "method"            # AI 打的主题标签
    featured: bool = False           # AI 判断是否进精选
    heat: int = 0                    # 热度分
    sources: list = field(default_factory=list)  # 多信源聚合:同一事件的其他信源名
    lang: str = "zh"
    lead_en: str = ""                # 原文英文导语(不翻译,直接当学习材料展示)
    expressions: list = field(default_factory=list)  # 重点表达 [{en, cn, note}]
    extra: dict = field(default_factory=dict)


def make_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:10]


# 关键词 → 主题的启发式分类(AI 关掉时给条目一个像样的 topic,而非全落到 method)
TOPIC_HINTS = [
    ("exam", ["ielts", "toefl", "四六级", "考研", "雅思", "托福", "cet", "gre", "exam", "test"]),
    ("vocab", ["word", "vocabulary", "idiom", "phrase", "词汇", "单词", "词根", "slang"]),
    ("listening", ["listen", "podcast", "audio", "听力", "6 minute", "minute english"]),
    ("speaking", ["speak", "pronunc", "accent", "口语", "发音", "conversation"]),
    ("reading", ["read", "article", "news", "story", "阅读", "外刊", "双语"]),
    ("method", ["how to", "tip", "guide", "learn", "study", "方法", "技巧", "攻略"]),
]


def classify_topic(title: str, default: str = "method") -> str:
    t = title.lower()
    for topic, kws in TOPIC_HINTS:
        if any(k in t for k in kws):
            return topic
    return default


# RSS 里夹带的推广/页脚条目,标题命中即丢弃
BOILERPLATE = ("lessons.com", "free lessons", "related to these lessons",
               "all my sites", "sign up", "subscribe", "advertisement")


def is_boilerplate(title: str) -> bool:
    t = title.lower()
    return t.startswith("...") or any(b in t for b in BOILERPLATE)


def clean_summary(html_or_text: str, limit: int = 160) -> str:
    """RSS 描述常带 HTML,清成纯文本做 AI 缺席时的兜底摘要。"""
    if not html_or_text:
        return ""
    text = BeautifulSoup(html_or_text, "html.parser").get_text(" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    return text[:limit]


# ----------------------------------------------------------------------------
# 2b. 中文兜底骨架 —— 没有 API key、editorial 也没覆盖时的呈现
#     以前这种情况直接把英文 RSS 描述当 summary 塞给前端,推荐理由留空:
#     最新抓来的内容 = 最差的呈现,而且每天都在增加。
#     现在:summary 由信源模板生成(描述的是节目形态,恒真,不会说错),
#     英文原文导语挪到 lead_en 单独展示 —— 对英语学习站来说这是材料不是噪声。
# ----------------------------------------------------------------------------
SOURCE_FALLBACK = {
    "bne": {
        "summary": "Breaking News English 当日分级新闻。同一篇配多档难度与慢速音频,"
                   "生词表、填空、讨论题齐全,适合当天泛读一遍再精读一遍。",
        "reason": "每天更新、难度可选,是最容易坚持下来的日更阅读材料 —— 先挑一档读完,别贪多。",
    },
    "bbc_6min": {
        "summary": "BBC 6 Minute English 本期节目。两位主持人 6 分钟对话,配完整文本与词汇讲解,"
                   "适合先盲听一遍再对着文本精听。",
        "reason": "公认的听力入门神器:话题有趣、语速友好,精听和影子跟读都合适。",
    },
    "bbc_tews": {
        "summary": "BBC The English We Speak 本期讲一个地道表达。3 分钟一集,"
                   "把用法、语境和例句讲透,教材里通常学不到。",
        "reason": "3 分钟攒一个地道说法,积少成多,口语和写作立刻不土。",
    },
    "bbc_work": {
        "summary": "BBC English at Work 职场情景剧本集。在连续剧情里学办公室英语,"
                   "带完整对话文本。",
        "reason": "把职场英语拍成连续剧,追剧一样学表达,比背对话有意思得多。",
    },
}

# Breaking News English 的 RSS 描述以 "Jul 20, 2026. " 开头,导语要把这段日期剥掉
_LEAD_DATE = re.compile(r"^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\.\s*")


def apply_fallback(it: Item, src: dict) -> None:
    """把英文描述转存 lead_en,summary/reason 用信源模板兜底。"""
    desc = it.summary
    if desc:
        it.lead_en = _LEAD_DATE.sub("", desc).strip()
    fb = SOURCE_FALLBACK.get(src["id"])
    if fb:
        it.summary = fb["summary"]
        it.reason = fb["reason"]
    else:
        # 未配模板的新信源:至少别把英文当中文摘要下发
        it.summary = f"{src['name']} 最新内容。"
        it.reason = ""


# ----------------------------------------------------------------------------
# 3. 抓取层
# ----------------------------------------------------------------------------
def fetch_html_source(src: dict, limit: int = 15) -> list[Item]:
    items = []
    try:
        r = requests.get(src["url"], headers=HEADERS, timeout=15)
        r.raise_for_status()
    except Exception as e:
        print(f"  [跳过] {src['name']}: {e}", file=sys.stderr)
        return items
    soup = BeautifulSoup(r.text, "html.parser")
    seen = set()
    for a in soup.select(src["selector"])[: limit * 2]:
        href = a.get("href", "")
        title = a.get_text(" ", strip=True)
        if not href or not title or len(title) < 8:
            continue
        url = href if href.startswith("http") else src["base"] + href
        if url in seen:
            continue
        seen.add(url)
        it = Item(
            id=make_id(url), title=title[:120], url=url,
            source=src["name"], source_weight=src["weight"],
            captured=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            topic=classify_topic(title, src.get("topic", "method")),
            lang=src["lang"],
        )
        apply_fallback(it, src)
        if src.get("evergreen"):
            it.extra["evergreen"] = True
        items.append(it)
        if len(items) >= limit:
            break
    print(f"  {src['name']}: {len(items)} 条")
    return items


def fetch_rss_source(src: dict, limit: int = 15) -> list[Item]:
    if feedparser is None:
        print("  [跳过] RSS 信源需要 pip install feedparser", file=sys.stderr)
        return []
    try:
        feed = feedparser.parse(src["url"])
    except Exception as e:
        print(f"  [跳过] {src['name']}: {e}", file=sys.stderr)
        return []
    strip = src.get("strip", "")
    default_topic = src.get("topic", "method")
    evergreen = bool(src.get("evergreen"))
    items, seen = [], set()
    for e in feed.entries[:limit * 2]:
        link = getattr(e, "link", "")
        title = getattr(e, "title", "").strip()
        if strip and title.startswith(strip):
            title = title[len(strip):].strip()
        if not link or len(title) < 6 or link in seen or is_boilerplate(title):
            continue
        seen.add(link)
        pub, tm = "", ""
        pp = getattr(e, "published_parsed", None)
        if pp:
            pub = time.strftime("%Y-%m-%d", pp)
            tm = time.strftime("%H:%M", pp)
        desc = clean_summary(getattr(e, "summary", ""))
        it = Item(
            id=make_id(link), title=title[:120], url=link,
            source=src["name"], source_weight=src["weight"],
            captured=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            published=pub, time=tm, summary=desc,
            topic=classify_topic(title, default_topic), lang=src["lang"],
        )
        apply_fallback(it, src)
        if evergreen:
            it.extra["evergreen"] = True
        items.append(it)
        if len(items) >= limit:
            break
    print(f"  {src['name']}: {len(items)} 条")
    return items


def crawl() -> list[Item]:
    print("== 抓取 ==")
    all_items: list[Item] = []
    for src in SOURCES:
        fn = fetch_rss_source if src["kind"] == "rss" else fetch_html_source
        all_items.extend(fn(src, src.get("limit", 15)))
    # 按 URL 去重
    uniq = {}
    for it in all_items:
        uniq.setdefault(it.id, it)
    print(f"去重后 {len(uniq)} 条")
    return list(uniq.values())


# ----------------------------------------------------------------------------
# 4. AI 层:摘要 + 主题 + 精选判断(批量,一次请求处理多条,省 token)
# ----------------------------------------------------------------------------
AI_SYSTEM = (
    "你是英语学习内容聚合站的编辑,读者是中国的英语学习者(四六级/考研/雅思托福/日常提升)。对每条内容:\n"
    "1) 用中文写 40~70 字摘要 summary,信息密度高,不带营销腔;英文原文条目请点出对学习者的价值;\n"
    "2) 写一句 25~45 字的推荐理由 reason,口吻像懂行的学长直接说清『为什么值得你点开、能帮你解决什么』,可以有观点,别复述摘要;\n"
    f"3) 从 {TOPICS} 里选一个 topic(词汇=vocab 听力=listening 口语=speaking "
    "阅读/外刊=reading 考试资讯与备考=exam 学习方法/工具=method 其他教育动态=news);\n"
    "4) featured: 只有当天真正值得看的重点才 true(每批最多 2~3 条);\n"
    "5) expressions: 从该条内容里挑 3~5 个真正值得带走的表达,每个 {en, cn, note}——\n"
    "   en=英文词/短语(照抄原文形态,别自己造),cn=简洁中文释义,\n"
    "   note=一句话说清用法或搭配(可省)。只挑学习者用得上的:\n"
    "   地道短语、高频搭配、话题核心词;不要 the/and 这种功能词,不要生僻到用不上的。\n"
    "   **只从 title/desc 里确实出现的内容挑,拿不准就少给几个,绝对不要编。**\n"
    "只输出 JSON 数组,元素为 {id, summary, reason, topic, featured, expressions},"
    "不要任何其他文字。"
)


def normalize_expressions(raw, limit: int = 5) -> list:
    """清洗重点表达:丢掉缺 en/cn 的、去重、截断。AI 和 editorial 共用。"""
    out, seen = [], set()
    for e in (raw or []):
        if not isinstance(e, dict):
            continue
        en = (e.get("en") or "").strip()
        cn = (e.get("cn") or "").strip()
        if not en or not cn or en.lower() in seen:
            continue
        seen.add(en.lower())
        item = {"en": en[:60], "cn": cn[:40]}
        note = (e.get("note") or "").strip()
        if note:
            item["note"] = note[:60]
        out.append(item)
        if len(out) >= limit:
            break
    return out


def ai_enrich(items: list[Item], batch: int = 10) -> None:
    # 人工核实的种子跳过 AI(摘要更可靠);抓取来的条目即使带英文描述也要过 AI,
    # 让 AI 把英文描述改写成中文摘要 + 推荐理由。
    items = [it for it in items if not it.extra.get("curated")]
    if not items:
        return
    try:
        from anthropic import Anthropic
    except ImportError:
        print("[跳过 AI] pip install anthropic", file=sys.stderr)
        return
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("[跳过 AI] 未设置 ANTHROPIC_API_KEY", file=sys.stderr)
        return
    client = Anthropic()
    print("== AI 摘要/打标 ==")
    for i in range(0, len(items), batch):
        chunk = items[i:i + batch]
        # desc 优先给英文原文导语 —— summary 此时已是中文兜底模板,喂回去没信息量
        payload = [{"id": it.id, "title": it.title, "source": it.source,
                    "desc": it.lead_en or it.summary} for it in chunk]
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            system=AI_SYSTEM,
            messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
        )
        text = "".join(b.text for b in msg.content if b.type == "text")
        text = re.sub(r"```json|```", "", text).strip()
        try:
            results = {r["id"]: r for r in json.loads(text)}
        except json.JSONDecodeError:
            print(f"  批次 {i//batch} 解析失败,跳过", file=sys.stderr)
            continue
        for it in chunk:
            r = results.get(it.id)
            if r:
                it.summary = r.get("summary", "")[:120]
                it.reason = r.get("reason", "")[:90]
                it.topic = r.get("topic") if r.get("topic") in TOPICS else "method"
                it.featured = bool(r.get("featured"))
                it.expressions = normalize_expressions(r.get("expressions"))
        print(f"  批次 {i//batch + 1}: {len(chunk)} 条完成")


# ----------------------------------------------------------------------------
# 5. 热度算法
#    heat = 信源权重(0~40) + 时效衰减(0~40) + 精选加成(0~12) + 关键词加成(0~8)
#    时效: exp(-days/3) —— 3 天半衰,一周后基本归零
#    考试节点类信息(查分/报名/考位)天然带强时效,靠关键词加成再抬一档
# ----------------------------------------------------------------------------
HOT_KEYWORDS = ["四六级", "考研", "雅思", "托福", "真题", "成绩", "查分", "报名",
                "考位", "大纲", "出分", "cet", "ielts", "toefl", "高考"]


def heat_score(it: Item) -> int:
    src = it.source_weight * 40
    if it.extra.get("evergreen"):
        recency = 40 * 0.55  # 常青内容(方法/工具/词根)豁免衰减,按固定中等新鲜度计
    else:
        ref = it.published or it.captured
        try:
            days = (datetime.now(timezone.utc) - datetime.strptime(ref, "%Y-%m-%d").replace(tzinfo=timezone.utc)).days
        except ValueError:
            days = 7
        recency = 40 * math.exp(-max(days, 0) / 3)
    feat = 12 if it.featured else 0
    kw = 8 if any(k in it.title.lower() for k in HOT_KEYWORDS) else 0
    return min(99, round(src + recency + feat + kw))


# ----------------------------------------------------------------------------
# 6. 种子数据 —— 手工整理的常青内容与已核实条目(seed_items.json)
#    与抓取结果按 id 合并,种子优先(带人工摘要,不进 AI 层)
# ----------------------------------------------------------------------------
def load_seed() -> list[Item]:
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_items.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    items = []
    for d in raw:
        extra = d.pop("extra", {})
        extra["curated"] = True  # 种子是人工核实内容,跳过 AI 层
        items.append(Item(**{**d, "extra": extra}))
    print(f"种子数据 {len(items)} 条")
    return items


# ----------------------------------------------------------------------------
# 6b. 编辑覆盖层 —— 对抓取来的条目做人工润色(editorial.json,按 id 覆盖字段)
#     优先级最高:AI 生成后仍可被这里覆盖;没有 API key 时,它就是中文摘要的来源。
# ----------------------------------------------------------------------------
def apply_editorial(items: list[Item]) -> None:
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "editorial.json")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        overrides = json.load(f)
    n = 0
    for it in items:
        o = overrides.get(it.id)
        if not o:
            continue
        for k in ("summary", "reason", "topic", "featured", "sources", "lead_en"):
            if k in o:
                setattr(it, k, o[k])
        if "expressions" in o:
            it.expressions = normalize_expressions(o["expressions"])
        n += 1
    print(f"编辑覆盖 {n} 条")


# ----------------------------------------------------------------------------
# 7. 输出
# ----------------------------------------------------------------------------
def emit(items: list[Item]) -> None:
    items.sort(key=lambda x: x.heat, reverse=True)
    data = []
    for it in items:
        d = asdict(it)
        extra = d.pop("extra")
        extra.pop("curated", None)  # 内部标记,不下发前端
        d.update(extra)  # phases / evergreen 展平到顶层,前端直接用
        data.append(d)
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "raw_items.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    out = os.path.join(here, "..", "web", "src", "data.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("// 由 pipeline.py 自动生成,勿手改 · " +
                datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC") + "\n")
        f.write("export const ITEMS = ")
        f.write(json.dumps(data, ensure_ascii=False, indent=2))
        f.write(";\n")
    print(f"== 输出 {len(items)} 条 → web/src/data.js ==")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-ai", action="store_true", help="跳过 AI 摘要")
    ap.add_argument("--seed-only", action="store_true", help="只用种子数据(离线调试)")
    args = ap.parse_args()
    items = [] if args.seed_only else crawl()
    seed = load_seed()
    merged = {it.id: it for it in items}
    for it in seed:
        merged[it.id] = it  # 种子优先(人工摘要更可靠)
    items = list(merged.values())
    if not items:
        print("没抓到任何条目,检查信源配置", file=sys.stderr)
        sys.exit(1)
    if not args.no_ai:
        ai_enrich(items)
    apply_editorial(items)  # 人工润色覆盖(优先级最高)
    for it in items:
        it.heat = heat_score(it)
    emit(items)


if __name__ == "__main__":
    main()
