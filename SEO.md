# 流量 / SEO 说明与待办

按第一性原理定的路线 A(面向真实的中国英语学习者)。漏斗四层:
**能打开 → 能被找到 → 为什么点 → 为什么再来**。第四层(今日 5 分钟 + 打卡)已建好。
本文件记录前三层的进度、以及几个必须诚实面对的结构性边界。

## 已完成

- **① 日更帖引擎**:`python pipeline/pipeline.py` 会额外产出 `today_post.md` ——
  用当天真实数据(5 个重点表达 + 1 条英文新闻)排成可直接粘贴到小红书/公众号的文案。
  中国的内容发现靠封闭平台,不靠开放网页搜索;网站当归档,日更帖当增长引擎、回链站点。
  **这一步能在不动网站的前提下最先验证需求** —— 发两三周看有没有收藏/关注,
  有人要再往下投基建,没人理就省下备案的痛。
- **② 基础 SEO**:`web/index.html` 补齐 `<meta description>` / keywords / Open Graph /
  canonical。OG 决定链接分享到微信时的标题卡片(爬虫读初始 HTML 的 head,SPA 也能读到)。
  `web/public/{sitemap.xml,robots.txt}` 随构建落到 dist 根。

## 待办(按杠杆排)

- [ ] **og:image**:现在 OG 缺图,微信分享卡片没有缩略图、点击率打折。
      做一张 1200×630 的品牌图(墨蓝 + 琥珀金 + ENG·HOT 字样),放 `web/public/og.png`,
      在 index.html 加 `<meta property="og:image" content="…/eng-hot/og.png">`。
- [ ] **③ SSG 预渲染 + 考试节点 SEO 页**:当前是 SPA,`<div id="root">` 是空壳,
      内容全在 JS bundle 里 —— **百度基本不渲染 JS,等于查无此站**。
      把 `seed_items.json` 里的考试节点内容(四六级查分、雅思考位、托福机考安排)
      各自预渲染成带真实 HTML + 独立 meta 的静态页。这些是高意图、按名字搜、季节性爆发的
      查询("六级成绩什么时候出"每年几百万人搜),是唯一 SEO 打得赢的内容
      (聚合的 RSS 是"薄内容",搜索引擎不给量)。出页后同步补进 sitemap.xml。
      技术选型参考 `vite-react-ssg`,或直接在流水线里按数据渲染静态 HTML。
- [ ] **④ 可访问性**:`github.io` 在大陆访问不稳定,这是流量天花板。
      务实路径:先注册便宜域名挂 Cloudflare Pages(免备案,比 github.io 好),测;
      真起量了再上 ICP 备案 + 国内 CDN。**别为未验证的站第一天就备案。**

## 必须诚实面对的边界

- **robots.txt 基本无效**:这是 GitHub Pages 项目页,本文件实际在
  `mcxiaoyuya.github.io/eng-hot/robots.txt`,而爬虫只认域名根
  `mcxiaoyuya.github.io/robots.txt`(归根仓库管)。抓取规则不被遵守,只作声明。
  真要控制抓取靠独立域名(④)。
- **sitemap.xml 要手动提交**:放着不会自动被发现,去百度搜索资源平台 /
  Google Search Console 手动提交本文件 URL。
- **②改善的是"可分享",不是"可收录"**:OG 让微信卡片好看了,但内容仍在 JS 里,
  百度还是看不到正文。真正的可收录要等 ③(SSG)。
