# ENG·HOT — 英语学习热点聚合站

仿 AIHOT 产品逻辑的英语学习内容聚合站:
**信源抓取 → AI 摘要打标 → 热度评分 → 热度信息流**。

面向中国英语学习者(四六级 / 考研 / 雅思托福 / 日常提升),把 BBC/VOA、外刊、
考试官方通知、学习方法等散落的内容聚成一条按热度排序的信息流。
与 [VAL·HOT](../web) 同架构复用,展示 AI 应用层工程能力(爬虫 + LLM 结构化输出 + 算法设计 + React 前端)。

## 架构

```
eng-hot/
├── pipeline/
│   ├── pipeline.py       # 内容流水线(抓取 → AI → 热度 → 输出)
│   └── seed_items.json   # 种子数据:人工核实条目 + 常青内容(跟练流程/词根/方法)
└── web/                  # Vite + React 前端
    └── src/
        ├── App.jsx       # 单页应用:精选/全部/日报/主题/收藏 五视图
        └── data.js       # 由 pipeline.py 自动生成,前端直接 import
```

## 流水线

```bash
pip install -r pipeline/requirements.txt

# 真实抓取 + 编辑覆盖(无需 API key,产出全中文真实站点):
python pipeline/pipeline.py --no-ai

# 全量(抓取 + AI 中文改写 + 编辑覆盖 + 热度):
export ANTHROPIC_API_KEY=sk-...
python pipeline/pipeline.py

python pipeline/pipeline.py --seed-only --no-ai   # 离线:只用人工种子
```

> 无 API key 时,抓取条目的中文摘要来自内置 `editorial.json`;设置 key 后
> 由 AI 自动生成,`editorial.json` 仍可对个别条目做最终覆盖。当前 `data.js`
> 即由 `--no-ai` 一条命令真实跑出:Breaking News English 当日新闻 + BBC 常青节目。

四层设计:

1. **抓取层**:RSS(feedparser)+ HTML(BeautifulSoup + CSS 选择器)双模式。
   信源在 `SOURCES` 配置,含权重、默认主题、常青标记、标题前缀剥离、每源条数上限。
   **当前实跑的真实信源**(RSS,稳定):
   - Breaking News English —— 分级新闻,带真实日期,时效性最强,站点"热点"主力
   - BBC 6 Minute English —— 经典听力节目(常青,数百集)
   - BBC The English We Speak —— 地道口语表达 / 习语(常青)
   - BBC English at Work —— 职场英语情景剧(常青)

   抓取层自带:标题清洗(剥 RSS 栏目前缀)、页脚/推广条目过滤(`is_boilerplate`)、
   关键词→主题启发式分类(`classify_topic`,AI 关掉时也能给出像样的 topic)。
   加新信源只加一条配置。
2. **AI 层**:批量调 Claude(一次 10 条省 token),按严格 JSON 返回
   `{summary(中文摘要), reason(推荐理由), topic(七类之一), featured(是否精选)}`。
   `reason` 是一句「学长口吻」的为什么值得看,是 AIHOT 式的核心编辑增值。
   抓取条目会把 RSS 英文描述一并喂给 AI 做中英改写;**没有 API key 时优雅降级**——
   直接展示 RSS 英文描述,不报错。人工核实的种子(`curated`)跳过 AI。
   主题分为:词汇 / 听力 / 口语 / 阅读 / 考试 / 方法 / 资讯。
3. **编辑覆盖层**(`editorial.json`):按 id 对抓取条目做人工润色,优先级最高——
   AI 生成后仍可被覆盖;没有 API key 时,它就是抓取条目中文摘要/推荐理由的来源。
   本仓库已内置一份对当前真实抓取条目的中文润色,所以**离线也能跑出全中文的真实站点**。
4. **热度层**(0–99):
   ```
   heat = 信源权重×40 + 时效衰减×40 + 精选加成 12 + 热词加成 8
   时效: exp(-days/3) —— 3 天半衰,一周基本归零
   常青内容(evergreen): 豁免衰减,按 0.55 固定新鲜度计,方法/词根不被冲掉
   热词: 四六级/考研/雅思/查分/报名 等考试节点词加成,应试时效强
   ```

## 前端

```bash
cd web
npm install
npm run dev        # 开发(端口 5174)
npm run build      # 构建
```

- AIHOT 式信息架构:精选 / 全部动态 / 日报(按日分组)/ 主题 / 收藏
- **今日热点 Hero**:最新日期里热度最高的一条置顶聚焦,带日期 + Top 1 + 信源数
- **推荐理由**:每条卡片一句编辑视角的「为什么值得看」,是 AIHOT 的招牌增值
- **多信源聚合**:同一事件的其他信源以「N 个信源报道」徽标呈现,详情抽屉列出全部信源
- **明暗主题切换**:深色 / 跟随系统 / 浅色,选择记在 localStorage
- 每条:热度分 + 火苗条、主题色标、信源、**精确到分钟的时间**,按热度或时间排序
- 学习流程类条目(带 `phases`)点开是抽屉详情:分阶段清单 + **可跟练倒计时器**
  (如晨读 15 分钟四阶段、影子跟读 10 分钟流程)
- 视觉语言:墨蓝 #0F1626 + 琥珀金 #FFB100,书卷 / 晚自习气质,Playfair 衬线点缀

## 版权

本站为聚合摘要与阅读索引,摘要为 AI/人工改写,原文版权归各来源;
展示处均保留原文链接。抓取遵守各站 robots.txt。

## Roadmap

- [ ] 信源扩充:可可英语、扇贝、知乎英语话题
- [ ] 生词本:条目内摘出的重点表达一键收藏,导出 Anki
- [ ] 热度趋势:记录每日快照,识别加速上升的考试节点
- [ ] 定时任务:GitHub Actions 每日跑 pipeline 自动更新
