"""下载 Playfair Display / Space Grotesk 的 latin 子集 woff2 到 web/src/fonts/,
并生成 web/src/fonts.css。目标用户在中国访问不了 fonts.googleapis.com,必须自托管。"""
import hashlib, os, re, requests

WEB = r"C:\Users\江振宇\Desktop\val-hot_1\eng-hot\web"
OUT = os.path.join(WEB, "src", "fonts")
os.makedirs(OUT, exist_ok=True)

CSS_URL = ("https://fonts.googleapis.com/css2?"
           "family=Playfair+Display:ital,wght@0,600;0,800;1,600"
           "&family=Space+Grotesk:wght@500;600;700&display=swap")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

css = requests.get(CSS_URL, headers=UA, timeout=30).text

# 只保留 /* latin */ 那一档 —— 站内这两个字体只用来排英文,其余子集是纯浪费
blocks = re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*\{.*?\})", css, re.S)
out_css = ["/* 自托管字体 —— 不要改回 Google Fonts CDN:目标用户在中国访问不到,",
           "   会导致整套 Playfair / Space Grotesk 视觉静默降级。",
           "   只取 latin 子集(这两个字体站内只排英文),由 scripts/fetch_fonts.py 生成。 */", ""]
n = 0
by_hash = {}     # 内容 md5 → 已落盘的文件名(可变字体多个字重共用一份)
for subset, block in blocks:
    if subset != "latin":
        continue
    fam = re.search(r"font-family:\s*'([^']+)'", block).group(1)
    style = re.search(r"font-style:\s*(\w+)", block).group(1)
    weight = re.search(r"font-weight:\s*(\d+)", block).group(1)
    url = re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1)

    data = requests.get(url, headers=UA, timeout=30).content
    # 这两个都是可变字体:Playfair 600/800、Space Grotesk 500/600/700 各自共用同一个
    # 文件。按内容去重,多个 @font-face 指向同一份,别把同一份字节存三遍。
    digest = hashlib.md5(data).hexdigest()
    if digest in by_hash:
        name = by_hash[digest]
        print(f"  {fam} {weight}{'i' if style == 'italic' else ''} → 复用 {name}")
    else:
        name = f"{fam.lower().replace(' ', '-')}{'-italic' if style == 'italic' else ''}.woff2"
        by_hash[digest] = name
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(data)
        print(f"  {name}  {len(data)/1024:.1f} KB")
    n += 1

    out_css.append("@font-face {")
    out_css.append(f"  font-family: '{fam}';")
    out_css.append(f"  font-style: {style};")
    out_css.append(f"  font-weight: {weight};")
    out_css.append("  font-display: swap;")
    out_css.append(f"  src: url('./fonts/{name}') format('woff2');")
    out_css.append("  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, "
                   "U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, "
                   "U+2193, U+2212, U+2215, U+FEFF, U+FFFD;")
    out_css.append("}")
    out_css.append("")

with open(os.path.join(WEB, "src", "fonts.css"), "w", encoding="utf-8") as f:
    f.write("\n".join(out_css))

total = sum(os.path.getsize(os.path.join(OUT, x)) for x in os.listdir(OUT))
print(f"\n{n} 个字重 / {len(by_hash)} 个文件,合计 {total/1024:.1f} KB → web/src/fonts/")
print("已生成 web/src/fonts.css")
