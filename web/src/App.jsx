import { useState, useEffect, useRef, useMemo } from "react";
import {
  Flame, Star, ExternalLink, Timer, Play, RotateCcw, ChevronRight, Check,
  Sparkles, LayoutList, CalendarDays, Hash, BookOpen, TrendingUp, ArrowUpDown,
  Quote, Layers, Sun, Moon, MonitorSmartphone, ArrowRight,
} from "lucide-react";

/* ============================================================
   数据层  —  信源条目与主题。接入新内容只改 data.js
   ============================================================ */
const TOPICS = [
  { id: "vocab", label: "词汇", color: "#FFB100" },
  { id: "listening", label: "听力", color: "#3ECFA0" },
  { id: "speaking", label: "口语", color: "#FF7BA6" },
  { id: "reading", label: "阅读", color: "#8A7BFF" },
  { id: "exam", label: "考试", color: "#5AC8FF" },
  { id: "method", label: "方法", color: "#E8626D" },
  { id: "news", label: "资讯", color: "#9AA7FF" },
];

// 跟练流程(带 phases → 详情可跟练)
import { ITEMS } from "./data.js";


/* ============================================================
   主题样式 —— 墨蓝 + 琥珀金,书卷/晚自习气质;支持明暗切换
   ============================================================ */
function ThemeStyle() {
  return (
    <style>{`
    /* 字体:Playfair / Space Grotesk 自托管(见 src/fonts.css),中文走系统字体栈。
       原来这里 @import Google Fonts —— 目标用户在中国大陆根本加载不到,整套视觉静默降级;
       中文字体更不该走 CDN,一个 Noto Sans SC 全量子集是好几 MB。 */
    .ehot{--cn:system-ui,-apple-system,"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif;--bg:#0F1626;--bg2:#0B1120;--panel:#161F33;--panel2:#1B2540;--gold:#FFB100;--paper:#F2EDE4;--mint:#3ECFA0;--muted:#8391A6;--sub:#aeb8c8;--line:rgba(242,237,228,.1);--fill:#F2EDE4;--fill-fg:#0F1626;--topbar:rgba(15,22,38,.92);--shadow:0 8px 30px rgba(0,0,0,.35);
      background:var(--bg);color:var(--paper);font-family:var(--cn);line-height:1.6;min-height:100vh;display:flex;transition:background .2s,color .2s}
    .ehot.light{--bg:#F5F1E8;--bg2:#FFFFFF;--panel:#FFFFFF;--panel2:#FBF6EC;--paper:#1B2233;--muted:#6B7688;--sub:#5A6478;--line:rgba(24,34,54,.1);--fill:#1B2233;--fill-fg:#F5F1E8;--topbar:rgba(245,241,232,.9);--shadow:0 8px 26px rgba(24,34,54,.1)}
    .ehot *{box-sizing:border-box;margin:0;padding:0}
    .ehot ::selection{background:var(--gold);color:#0F1626}
    .ehot .mono{font-family:"Space Grotesk",sans-serif}
    .ehot .serif{font-family:"Playfair Display",serif}
    .ehot a{color:inherit;text-decoration:none}

    /* 侧边导航 */
    .side{width:230px;flex:none;border-right:1px solid var(--line);padding:22px 16px;position:sticky;top:0;height:100vh;overflow-y:auto;background:var(--bg2);display:flex;flex-direction:column}
    .brand{display:flex;align-items:center;gap:9px;font-family:"Playfair Display";font-weight:800;letter-spacing:.02em;font-size:20px;margin-bottom:4px}
    .brand .dot{width:15px;height:22px;background:var(--gold);border-radius:2px 6px 6px 2px;box-shadow:inset 3px 0 0 rgba(15,22,38,.4)}
    .brand small{color:var(--gold)}
    .tagline{font-size:11.5px;color:var(--muted);margin-bottom:22px;padding-left:2px}
    .navgrp{font-family:"Space Grotesk";text-transform:uppercase;letter-spacing:.22em;font-size:10.5px;color:var(--muted);margin:18px 0 8px;padding-left:8px}
    .navitem{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;cursor:pointer;color:var(--muted);font-family:var(--cn);font-size:14.5px;font-weight:500;padding:9px 10px;border-radius:6px;transition:.14s;border-left:2px solid transparent}
    .navitem:hover{color:var(--paper);background:rgba(131,145,166,.12)}
    .navitem.on{color:var(--paper);background:rgba(255,177,0,.14);border-left-color:var(--gold)}
    .navitem .cnt{margin-left:auto;font-family:"Space Grotesk";font-size:12px;color:var(--muted);background:rgba(131,145,166,.15);padding:1px 7px;border-radius:8px}

    /* 主题切换 */
    .themesw{margin-top:auto;padding-top:18px}
    .themesw .lbl{font-family:"Space Grotesk";text-transform:uppercase;letter-spacing:.22em;font-size:10.5px;color:var(--muted);margin-bottom:8px;padding-left:8px}
    .seg{display:flex;gap:3px;background:rgba(131,145,166,.12);border-radius:8px;padding:3px}
    .seg button{flex:1;display:grid;place-items:center;padding:7px 0;border:none;background:none;color:var(--muted);cursor:pointer;border-radius:6px;transition:.14s}
    .seg button:hover{color:var(--paper)}
    .seg button.on{background:var(--panel);color:var(--gold);box-shadow:var(--shadow)}

    /* 主区 */
    .main{flex:1;min-width:0}
    .topbar{position:sticky;top:0;z-index:10;background:var(--topbar);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:18px clamp(18px,4vw,44px);display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
    .topbar h1{font-family:var(--cn);font-weight:900;font-size:clamp(22px,3vw,30px);letter-spacing:.02em;display:flex;align-items:center;gap:10px}
    .topbar h1 .ic{color:var(--gold)}
    .topbar .desc{font-size:12.5px;color:var(--muted);margin-top:3px}
    .sortbtn{display:flex;align-items:center;gap:7px;font-family:"Space Grotesk";text-transform:uppercase;letter-spacing:.1em;font-weight:600;font-size:12.5px;background:var(--panel);border:1px solid var(--line);color:var(--paper);padding:9px 15px;border-radius:8px;cursor:pointer;transition:.14s}
    .sortbtn:hover{border-color:var(--mint);color:var(--mint)}

    .feed{padding:clamp(16px,3vw,30px) clamp(18px,4vw,44px) 60px;max-width:940px}

    /* 今日热点 Hero */
    .hero{position:relative;overflow:hidden;background:linear-gradient(115deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:14px;padding:22px 24px;margin-bottom:24px;cursor:pointer;transition:.16s;box-shadow:var(--shadow)}
    .hero:hover{border-color:rgba(255,177,0,.5);transform:translateY(-2px)}
    .hero::after{content:"";position:absolute;right:-60px;top:-60px;width:220px;height:220px;background:radial-gradient(circle,rgba(255,177,0,.22),transparent 70%);pointer-events:none}
    .hero .cap{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
    .hero .badge{display:inline-flex;align-items:center;gap:6px;font-family:"Space Grotesk";font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:11px;color:#0F1626;background:var(--gold);padding:4px 11px;border-radius:99px}
    .hero .day{font-family:"Space Grotesk";font-size:13px;color:var(--muted)}
    .hero .htop{font-family:"Playfair Display";font-style:italic;font-size:14px;color:var(--gold);margin-left:auto}
    .hero h2{font-family:var(--cn);font-weight:900;font-size:clamp(20px,2.6vw,26px);line-height:1.35;margin-bottom:10px;position:relative;z-index:1}
    .hero p{font-size:14px;color:var(--sub);margin-bottom:14px;max-width:640px;position:relative;z-index:1}
    .hero .foot{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);position:relative;z-index:1}
    .hero .go{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-family:"Space Grotesk";font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:12px;color:var(--gold)}

    /* 多信源徽标 */
    .cluster{display:inline-flex;align-items:center;gap:5px;font-family:"Space Grotesk";font-weight:600;font-size:11.5px;color:var(--mint);background:rgba(62,207,160,.12);border:1px solid rgba(62,207,160,.3);padding:2px 9px;border-radius:99px}

    /* 主题筛选条 */
    .chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}
    .chip{font-family:var(--cn);font-weight:600;font-size:12.5px;background:var(--panel);border:1px solid var(--line);color:var(--muted);padding:6px 14px;border-radius:99px;cursor:pointer;transition:.14s}
    .chip:hover{color:var(--paper)}
    .chip.on{color:#0F1626;font-weight:700}

    /* 条目卡 —— 左侧书脊线 */
    .card{background:var(--panel);border:1px solid var(--line);border-left:3px solid rgba(255,177,0,.35);border-radius:8px;padding:18px 20px;margin-bottom:12px;position:relative;transition:.16s;cursor:pointer;box-shadow:var(--shadow)}
    .card:hover{border-color:rgba(255,177,0,.45);border-left-color:var(--gold);transform:translateX(3px)}
    .card.feat{background:linear-gradient(100deg,var(--panel2),var(--panel))}
    .card .row1{display:flex;align-items:center;gap:10px;margin-bottom:9px;flex-wrap:wrap}
    .heat{display:inline-flex;align-items:center;gap:5px;font-family:"Space Grotesk";font-weight:700;font-size:15px;color:var(--gold)}
    .heat .bars{display:flex;gap:2px;align-items:flex-end;height:14px}
    .heat .bars i{width:3px;background:var(--gold);opacity:.3}
    .heat .bars i.hot{opacity:1}
    .ttag{font-family:var(--cn);font-weight:700;font-size:11px;padding:2px 9px;border:1px solid;border-radius:99px}
    .feat-badge{display:inline-flex;align-items:center;gap:4px;font-family:"Space Grotesk";text-transform:uppercase;letter-spacing:.14em;font-size:10.5px;color:var(--gold)}
    .card .date{margin-left:auto;font-family:"Space Grotesk";font-size:12px;color:var(--muted)}
    .card h3{font-family:var(--cn);font-weight:700;font-size:17px;line-height:1.45;margin-bottom:6px}
    .card p{font-size:13.5px;color:var(--sub);margin-bottom:10px}
    .reason{display:flex;gap:8px;align-items:flex-start;background:rgba(255,177,0,.07);border-left:2px solid var(--gold);border-radius:0 6px 6px 0;padding:8px 12px;margin-bottom:12px;font-size:12.5px;color:var(--sub);line-height:1.55}
    .reason .qic{color:var(--gold);flex:none;margin-top:2px}
    .reason b{color:var(--paper);font-weight:700}
    /* 英文原文导语 —— 对英语学习站来说这是材料,不是"没翻译的噪声" */
    .leaden{border-left:2px solid rgba(131,145,166,.4);padding:2px 0 2px 11px;margin-bottom:11px;font-size:13px;color:var(--sub);line-height:1.6}
    .leaden .tag{display:block;font-family:"Space Grotesk";text-transform:uppercase;letter-spacing:.16em;font-size:9.5px;color:var(--muted);margin-bottom:3px}

    /* 重点表达 —— 站内真正能"带走"的东西 */
    .expr{background:rgba(62,207,160,.06);border:1px solid rgba(62,207,160,.22);border-radius:8px;padding:10px 13px;margin-bottom:12px}
    .expr .eh{display:flex;align-items:center;gap:6px;font-family:"Space Grotesk";text-transform:uppercase;letter-spacing:.14em;font-size:10px;color:var(--mint);margin-bottom:8px}
    .expr .list{display:flex;flex-direction:column;gap:6px}
    .expr .e{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:13px;line-height:1.5}
    .expr .en{font-weight:700;color:var(--paper)}
    .expr .cn{color:var(--sub)}
    .expr .note{width:100%;font-size:11.5px;color:var(--muted);padding-left:1px}
    .expr .more{font-size:11.5px;color:var(--muted);margin-top:7px}

    .card .row2{display:flex;align-items:center;gap:12px;font-size:12px;color:var(--muted);flex-wrap:wrap}
    .card .src{display:inline-flex;align-items:center;gap:5px}
    .card .act{margin-left:auto;display:flex;align-items:center;gap:8px}
    .starbtn{background:none;border:none;cursor:pointer;color:var(--muted);display:grid;place-items:center;padding:4px;transition:.14s}
    .starbtn:hover{color:#f5b02a}
    .starbtn.on{color:#f5b02a}
    .readbtn{display:inline-flex;align-items:center;gap:5px;font-family:"Space Grotesk";text-transform:uppercase;letter-spacing:.08em;font-weight:600;font-size:11.5px;color:var(--mint);border:1px solid rgba(62,207,160,.3);border-radius:6px;padding:5px 11px;transition:.14s}
    .readbtn:hover{background:rgba(62,207,160,.1)}
    .openbtn{display:inline-flex;align-items:center;gap:5px;font-family:"Space Grotesk";text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:11.5px;color:#0F1626;background:var(--gold);border-radius:6px;padding:6px 12px}

    /* 日报分组 */
    .daygrp{margin-bottom:26px}
    .dayhd{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:14px}
    .dayhd .d{font-family:"Space Grotesk";font-weight:700;font-size:20px}
    .dayhd .w{font-family:"Space Grotesk";text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--muted)}
    .dayhd .n{margin-left:auto;font-size:12px;color:var(--muted)}

    /* 主题网格 */
    .tgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
    .tcard{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px 18px;cursor:pointer;transition:.16s;position:relative;overflow:hidden;box-shadow:var(--shadow)}
    .tcard:hover{transform:translateY(-3px);border-color:rgba(255,177,0,.4)}
    .tcard .tt{font-family:var(--cn);font-weight:900;font-size:19px;margin-bottom:4px}
    .tcard .tn{font-family:"Space Grotesk";font-size:13px;color:var(--muted)}
    .tcard .glow{position:absolute;right:-20px;top:-20px;width:70px;height:70px;border-radius:50%;filter:blur(24px);opacity:.5}

    .empty{border:1px dashed var(--line);border-radius:10px;padding:44px 24px;text-align:center;color:var(--muted);font-size:13.5px}
    .empty b{color:var(--paper);display:block;font-size:15px;margin-bottom:6px;font-weight:700}

    /* 详情抽屉 */
    .scrim{position:fixed;inset:0;background:rgba(6,10,20,.72);z-index:40;display:flex;justify-content:flex-end}
    .drawer{width:min(560px,94vw);background:var(--bg);border-left:1px solid var(--line);height:100%;overflow-y:auto;padding:26px clamp(18px,4vw,30px) 40px;animation:slide .28s ease}
    @keyframes slide{from{transform:translateX(30px);opacity:.4}to{transform:none;opacity:1}}
    .drawer .close{float:right;background:none;border:1px solid var(--line);border-radius:6px;color:var(--muted);cursor:pointer;font-size:13px;padding:5px 12px;font-family:"Space Grotesk";letter-spacing:.08em}
    .drawer .close:hover{color:var(--paper);border-color:var(--paper)}
    .drawer h2{font-family:var(--cn);font-weight:900;font-size:24px;margin:4px 0 8px}
    .drawer .lead{font-size:14px;color:var(--sub);margin-bottom:14px}
    .drawer .dreason{display:flex;gap:9px;align-items:flex-start;background:rgba(255,177,0,.08);border-left:3px solid var(--gold);border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:16px;font-size:13.5px;color:var(--sub);line-height:1.6}
    .drawer .dreason .qic{color:var(--gold);flex:none;margin-top:2px}
    .drawer .dreason b{color:var(--paper)}
    .drawer .srcline{font-size:12px;color:var(--muted);margin-bottom:16px}
    .drawer .srcline a{color:var(--mint)}
    .srcbox{background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:13px 15px;margin-bottom:20px}
    .srcbox .sh{display:flex;align-items:center;gap:7px;font-family:"Space Grotesk";font-weight:600;font-size:12.5px;color:var(--mint);margin-bottom:9px}
    .srcbox .slist{display:flex;flex-wrap:wrap;gap:7px}
    .srcbox .stag{font-size:12px;color:var(--sub);background:rgba(131,145,166,.12);border:1px solid var(--line);border-radius:99px;padding:3px 10px}

    .phase{background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin-bottom:10px}
    .phase .top{display:flex;justify-content:space-between;align-items:center}
    .phase .pn{font-weight:700;font-size:15px}
    .phase .en{font-family:"Playfair Display";font-style:italic;letter-spacing:.03em;font-size:12px;color:var(--gold);display:block;margin:1px 0 6px}
    .phase .dur{font-family:"Space Grotesk";font-size:12px;color:var(--mint)}
    .phase ul{list-style:none;margin-top:4px}
    .phase li{position:relative;padding-left:14px;font-size:12.5px;color:var(--sub);margin:4px 0}
    .phase li::before{content:"";position:absolute;left:0;top:8px;width:5px;height:5px;background:var(--gold);border-radius:50%}

    .runner{background:linear-gradient(180deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:10px;padding:20px;margin-top:16px;position:relative}
    .rhead{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
    .rk{font-family:"Space Grotesk";text-transform:uppercase;letter-spacing:.22em;color:var(--gold);font-size:11px}
    .rcur{font-weight:900;font-size:17px;margin-top:2px}
    .rtimer{font-family:"Space Grotesk";font-weight:700;font-size:46px;line-height:1}
    .rtimer.warn{color:var(--gold)}
    .rbar{height:5px;background:rgba(131,145,166,.2);border-radius:99px;margin:14px 0 14px;overflow:hidden}
    .rbar i{display:block;height:100%;background:var(--gold);transition:width .3s linear}
    .checks{display:flex;flex-wrap:wrap;gap:7px}
    .check{cursor:pointer;user-select:none;display:flex;align-items:center;gap:7px;background:rgba(131,145,166,.1);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:12px}
    .check .box{width:14px;height:14px;border:1.5px solid var(--muted);border-radius:3px;display:grid;place-items:center;flex:none;color:transparent}
    .check.on{border-color:var(--mint)}
    .check.on .box{background:var(--mint);border-color:var(--mint);color:#0F1626}
    .check.on .t{text-decoration:line-through;color:var(--muted)}
    .ctrls{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
    .btn{font-family:"Space Grotesk";text-transform:uppercase;letter-spacing:.1em;font-weight:700;font-size:13px;cursor:pointer;border:none;border-radius:8px;padding:10px 18px;color:#0F1626;background:var(--gold);display:inline-flex;align-items:center;gap:6px}
    .btn:hover{background:#ffc233}
    .btn.ghost{background:transparent;color:var(--paper);border:1px solid var(--line)}
    .btn.ghost:hover{border-color:var(--mint);color:var(--mint)}
    .btn:disabled{opacity:.35;cursor:not-allowed}

    @media(max-width:720px){.ehot{flex-direction:column}.side{width:100%;height:auto;position:static;display:flex;flex-wrap:wrap;gap:6px;align-items:center}.side .navgrp{display:none}.tagline{display:none}.navitem{width:auto}.themesw{margin:0 0 0 auto;padding:0}.themesw .lbl{display:none}}
    @media (prefers-reduced-motion:reduce){.ehot *{animation:none!important;transition:none!important}}
  `}</style>
  );
}

/* ============================================================
   小组件
   ============================================================ */
const topicOf = (id) => TOPICS.find((t) => t.id === id) || { id, label: id, color: "#8391A6" };
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const when = (item) => item.captured.slice(5) + (item.time ? ` ${item.time}` : "");

function HeatBar({ heat }) {
  const lvl = Math.round((heat / 100) * 5);
  return (
    <span className="heat" title={`热度 ${heat}`}>
      <Flame size={14} />
      {heat}
      <span className="bars">
        {[6, 9, 12, 10, 14].map((h, i) => <i key={i} className={i < lvl ? "hot" : ""} style={{ height: h }} />)}
      </span>
    </span>
  );
}

/* 重点表达 —— 卡片上只露 3 条(够扫一眼带走),抽屉里给全。
   没有 expressions 的条目直接不渲染:宁可少一块,也不编内容凑数。 */
function Expressions({ list, limit }) {
  if (!list?.length) return null;
  const shown = limit ? list.slice(0, limit) : list;
  const rest = list.length - shown.length;
  return (
    <div className="expr">
      <div className="eh"><BookOpen size={12} /> 带走这 {list.length} 个表达</div>
      <div className="list">
        {shown.map((e, i) => (
          <div className="e" key={i}>
            <span className="en">{e.en}</span>
            <span className="cn">{e.cn}</span>
            {!limit && e.note && <span className="note">{e.note}</span>}
          </div>
        ))}
      </div>
      {rest > 0 && <div className="more">点开还有 {rest} 个 ↓</div>}
    </div>
  );
}

function LeadEn({ text }) {
  if (!text) return null;
  return (
    <div className="leaden">
      <span className="tag">原文导语</span>
      {text}
    </div>
  );
}

function Hero({ item, dateLabel, onOpen }) {
  const tp = topicOf(item.topic);
  const cluster = (item.sources?.length || 0);
  return (
    <div className="hero" onClick={() => onOpen(item)}>
      <div className="cap">
        <span className="badge"><Flame size={12} /> 今日热点</span>
        <span className="day mono">{dateLabel}</span>
        <span className="ttag" style={{ color: tp.color, borderColor: tp.color + "66" }}>{tp.label}</span>
        <span className="htop serif">Top&nbsp;1</span>
      </div>
      <h2>{item.title}</h2>
      <p>{item.reason || item.summary}</p>
      <div className="foot">
        <HeatBar heat={item.heat} />
        <span className="src"><Hash size={12} style={{ verticalAlign: -1 }} /> {item.source}</span>
        {cluster > 1 && <span className="cluster"><Layers size={11} /> {cluster} 个信源报道</span>}
        <span className="go">查看详情 <ArrowRight size={13} /></span>
      </div>
    </div>
  );
}

function FeedCard({ item, starred, onStar, onOpen }) {
  const tp = topicOf(item.topic);
  const cluster = (item.sources?.length || 0);
  return (
    <article className={"card" + (item.featured ? " feat" : "")} onClick={() => onOpen(item)}>
      <div className="row1">
        <HeatBar heat={item.heat} />
        <span className="ttag" style={{ color: tp.color, borderColor: tp.color + "66" }}>{tp.label}</span>
        {item.featured && <span className="feat-badge"><Sparkles size={11} /> 精选</span>}
        <span className="date mono">{when(item)}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      {item.reason && (
        <div className="reason"><Quote className="qic" size={13} /><span><b>推荐理由 · </b>{item.reason}</span></div>
      )}
      <LeadEn text={item.lead_en} />
      <Expressions list={item.expressions} limit={3} />
      <div className="row2">
        <span className="src"><Hash size={12} />{item.source}</span>
        {cluster > 1 && <span className="cluster"><Layers size={11} /> {cluster} 个信源</span>}
        <div className="act" onClick={(e) => e.stopPropagation()}>
          <button className={"starbtn" + (starred ? " on" : "")} onClick={() => onStar(item.id)} title="收藏">
            <Star size={17} fill={starred ? "#f5b02a" : "none"} />
          </button>
          {item.phases
            ? <button className="openbtn" onClick={() => onOpen(item)}><Play size={12} /> 跟练</button>
            : <a className="readbtn" href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> 阅读原文</a>}
        </div>
      </div>
    </article>
  );
}

function PhaseCard({ p }) {
  return (
    <div className="phase">
      <div className="top"><span className="pn">{p.cn}</span><span className="dur mono">{p.dur}</span></div>
      <span className="en">{p.en}</span>
      <ul>{p.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

function Runner({ phases }) {
  const [idx, setIdx] = useState(-1);
  const [rem, setRem] = useState(0);
  const [run, setRun] = useState(false);
  const [chk, setChk] = useState({});
  const ref = useRef(null);
  useEffect(() => {
    if (run && idx >= 0) {
      ref.current = setInterval(() => setRem((r) => (r <= 1 ? (clearInterval(ref.current), 0) : r - 1)), 1000);
      return () => clearInterval(ref.current);
    }
  }, [run, idx]);
  const reset = () => { clearInterval(ref.current); setIdx(-1); setRem(0); setRun(false); setChk({}); };
  const start = () => { setIdx(0); setRem(phases[0].sec); setRun(true); };
  const next = () => { if (idx < phases.length - 1) { const n = idx + 1; setIdx(n); setRem(phases[n].sec); setRun(true); } };
  const cur = idx >= 0 ? phases[idx] : null;
  const pct = cur ? (100 * (cur.sec - rem)) / cur.sec : 0;
  const last = idx === phases.length - 1;
  const done = last && rem === 0;
  let label = "准备就绪";
  if (cur && rem > 0) label = `${cur.cn} · ${cur.en}`;
  else if (cur && rem === 0 && !done) label = "阶段完成 · 点下一阶段";
  else if (done) label = "✓ 练完了 — 今天的英语打卡完成";
  return (
    <div className="runner">
      <div className="rhead">
        <div><div className="rk"><Timer size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Now Running</div><div className="rcur">{label}</div></div>
        <div className={"rtimer" + (rem <= 10 && rem > 0 ? " warn" : "")}>{fmt(Math.max(rem, 0))}</div>
      </div>
      <div className="rbar"><i style={{ width: pct + "%" }} /></div>
      {cur && rem > 0 && (
        <div className="checks">
          {cur.items.map((t, i) => {
            const k = `${idx}-${i}`;
            return <div key={k} className={"check" + (chk[k] ? " on" : "")} onClick={() => setChk((c) => ({ ...c, [k]: !c[k] }))}>
              <span className="box"><Check size={11} /></span><span className="t">{t}</span></div>;
          })}
        </div>
      )}
      <div className="ctrls">
        <button className="btn" onClick={start} disabled={idx >= 0}><Play size={13} />{idx >= 0 ? "进行中…" : "开始跟练"}</button>
        <button className="btn ghost" onClick={next} disabled={idx < 0 || last}>下一阶段 <ChevronRight size={13} /></button>
        <button className="btn ghost" onClick={reset} disabled={idx < 0}><RotateCcw size={13} /> 重置</button>
      </div>
    </div>
  );
}

function Drawer({ item, onClose }) {
  const cluster = item.sources?.length || 0;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>关闭 ✕</button>
        <h2>{item.title}</h2>
        <p className="lead">{item.summary}</p>
        {item.reason && (
          <div className="dreason"><Quote className="qic" size={15} /><span><b>推荐理由 · </b>{item.reason}</span></div>
        )}
        <LeadEn text={item.lead_en} />
        <Expressions list={item.expressions} />
        <p className="srcline">信源 <a href={item.url} target="_blank" rel="noreferrer">{item.source} ↗</a> · {when(item)} · 摘要为聚合整理,版权归原作者</p>
        {cluster > 1 && (
          <div className="srcbox">
            <div className="sh"><Layers size={14} /> {cluster} 个信源同时报道</div>
            <div className="slist">{item.sources.map((s, i) => <span className="stag" key={i}>{s}</span>)}</div>
          </div>
        )}
        {item.phases?.map((p, i) => <PhaseCard key={i} p={p} />)}
        {item.phases && <Runner phases={item.phases} />}
      </div>
    </div>
  );
}

/* ============================================================
   视图
   ============================================================ */
const NAV = [
  { id: "featured", label: "精选", icon: Sparkles, grp: "内容" },
  { id: "all", label: "全部动态", icon: LayoutList, grp: "内容" },
  { id: "daily", label: "日报", icon: CalendarDays, grp: "内容" },
  { id: "topics", label: "主题", icon: Hash, grp: "内容" },
  { id: "starred", label: "收藏", icon: Star, grp: "内容" },
];

const VIEW_META = {
  featured: { icon: Sparkles, h: "精选", d: "AI 帮你筛掉噪声,每天只留真正值得看的几条" },
  all: { icon: LayoutList, h: "全部动态", d: "所有接入信源的完整信息流" },
  daily: { icon: CalendarDays, h: "英语日报", d: "按抓取日期分组,当天热点一目了然" },
  topics: { icon: Hash, h: "主题", d: "词汇 · 听力 · 口语 · 阅读 · 考试,按类型浏览" },
  starred: { icon: Star, h: "我的收藏", d: "标星的条目会留在这里" },
};

const THEMES = [
  { id: "dark", icon: Moon, title: "深色" },
  { id: "auto", icon: MonitorSmartphone, title: "跟随系统" },
  { id: "light", icon: Sun, title: "浅色" },
];

function useTheme() {
  const [pref, setPref] = useState(() => localStorage.getItem("enghot-theme") || "dark");
  const [sysLight, setSysLight] = useState(() => window.matchMedia("(prefers-color-scheme: light)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const on = (e) => setSysLight(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => { localStorage.setItem("enghot-theme", pref); }, [pref]);
  const light = pref === "light" || (pref === "auto" && sysLight);
  return [pref, setPref, light];
}

export default function EnglishHot() {
  const [view, setView] = useState("featured");
  const [topic, setTopic] = useState(null);
  const [sort, setSort] = useState("heat");
  const [starred, setStarred] = useState({});
  const [open, setOpen] = useState(null);
  const [pref, setPref, light] = useTheme();

  const toggleStar = (id) => setStarred((s) => ({ ...s, [id]: !s[id] }));
  const starCount = Object.values(starred).filter(Boolean).length;

  const sorted = useMemo(() => {
    const arr = [...ITEMS];
    arr.sort((a, b) => (sort === "heat" ? b.heat - a.heat : b.captured.localeCompare(a.captured) || b.heat - a.heat));
    return arr;
  }, [sort]);

  const list = useMemo(() => {
    let arr = sorted;
    if (view === "featured") arr = arr.filter((i) => i.featured);
    if (view === "starred") arr = arr.filter((i) => starred[i.id]);
    if (topic) arr = arr.filter((i) => i.topic === topic);
    return arr;
  }, [sorted, view, topic, starred]);

  const meta = VIEW_META[view];
  const showChips = view === "all" || view === "featured" || view === "starred";

  // 今日热点:最新那天里热度最高的一条。
  // 注意条目和日期必须取自同一条 —— 以前 hero 取全站最热、日期取全站最新,
  // 两者不是同一条时会出现「7月20日」配一条 7月18 的内容。
  const [hero, heroDate] = useMemo(() => {
    if (!ITEMS.length) return [null, ""];
    const latest = ITEMS.reduce((m, i) => (i.captured > m ? i.captured : m), ITEMS[0].captured);
    const top = ITEMS.filter((i) => i.captured === latest)
      .reduce((a, b) => (b.heat > a.heat ? b : a));
    const d = new Date(top.captured);
    const wd = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    return [top, `${d.getMonth() + 1}月${d.getDate()}日 · 周${wd}`];
  }, []);
  const showHero = hero && (view === "featured" || view === "all") && !topic;

  const dayGroups = useMemo(() => {
    const g = {};
    sorted.forEach((i) => (g[i.captured] = g[i.captured] || []).push(i));
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sorted]);

  return (
    <div className={"ehot" + (light ? " light" : "")}>
      <ThemeStyle />

      <aside className="side">
        <div className="brand"><span className="dot" />ENG·HOT<small>.</small></div>
        <div className="tagline">英语学习热点聚合 · 每日精选</div>
        <div className="navgrp">内容</div>
        {NAV.map((n) => {
          const Icon = n.icon;
          const cnt = n.id === "starred" ? starCount : n.id === "featured" ? ITEMS.filter((i) => i.featured).length : n.id === "all" ? ITEMS.length : null;
          return (
            <button key={n.id} className={"navitem" + (view === n.id ? " on" : "")} onClick={() => { setView(n.id); setTopic(null); }}>
              <Icon size={16} /> {n.label}
              {cnt != null && <span className="cnt mono">{cnt}</span>}
            </button>
          );
        })}
        <div className="navgrp">更多</div>
        <button className="navitem"><TrendingUp size={16} /> 热度趋势</button>
        <button className="navitem"><BookOpen size={16} /> 生词本</button>

        <div className="themesw">
          <div className="lbl">主题</div>
          <div className="seg">
            {THEMES.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} className={pref === t.id ? "on" : ""} title={t.title} onClick={() => setPref(t.id)}>
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div>
            <h1><meta.icon className="ic" size={24} /> {meta.h}</h1>
            <div className="desc">{meta.d}</div>
          </div>
          {view !== "topics" && (
            <button className="sortbtn" onClick={() => setSort((s) => (s === "heat" ? "new" : "heat"))}>
              <ArrowUpDown size={13} /> {sort === "heat" ? "按热度" : "按时间"}
            </button>
          )}
        </div>

        <div className="feed">
          {showHero && <Hero item={hero} dateLabel={heroDate} onOpen={setOpen} />}

          {showChips && (
            <div className="chips">
              <span className={"chip" + (topic === null ? " on" : "")} style={topic === null ? { background: "var(--fill)", color: "var(--fill-fg)", borderColor: "var(--fill)" } : {}} onClick={() => setTopic(null)}>全部</span>
              {TOPICS.map((t) => (
                <span key={t.id} className={"chip" + (topic === t.id ? " on" : "")} style={topic === t.id ? { background: t.color, borderColor: t.color } : {}} onClick={() => setTopic(topic === t.id ? null : t.id)}>{t.label}</span>
              ))}
            </div>
          )}

          {view === "topics" ? (
            <div className="tgrid">
              {TOPICS.map((t) => {
                const n = ITEMS.filter((i) => i.topic === t.id).length;
                return (
                  <div key={t.id} className="tcard" onClick={() => { setView("all"); setTopic(t.id); }}>
                    <div className="glow" style={{ background: t.color }} />
                    <div className="tt">{t.label}</div>
                    <div className="tn mono">{n > 0 ? `${n} 条内容` : "信源接入中"}</div>
                  </div>
                );
              })}
            </div>
          ) : view === "daily" ? (
            dayGroups.map(([day, items]) => {
              const wd = ["日", "一", "二", "三", "四", "五", "六"][new Date(day).getDay()];
              return (
                <div className="daygrp" key={day}>
                  <div className="dayhd"><span className="d mono">{day.slice(5)}</span><span className="w">周{wd}</span><span className="n">{items.length} 条</span></div>
                  {items.map((i) => <FeedCard key={i.id} item={i} starred={!!starred[i.id]} onStar={toggleStar} onOpen={setOpen} />)}
                </div>
              );
            })
          ) : list.length ? (
            list.map((i) => <FeedCard key={i.id} item={i} starred={!!starred[i.id]} onStar={toggleStar} onOpen={setOpen} />)
          ) : (
            <div className="empty">
              <b>{view === "starred" ? "还没有收藏" : "该主题暂无内容"}</b>
              {view === "starred" ? "点条目右下角的星标,把值得回看的收进来" : "这个主题的信源正在接入,先看看别的"}
            </div>
          )}
        </div>
      </div>

      {open && <Drawer item={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
