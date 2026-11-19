#!/usr/bin/env python3
import argparse
from datetime import date
from html import escape
import json
import os
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
import unicodedata
from urllib.parse import parse_qsl, urlencode, urlsplit

SECTIONS = {
    "models": ("模型", "Models"),
    "evaluations": ("评测", "Evaluations"),
    "products": ("新产品", "Products"),
    "architecture": ("技术架构", "Architecture"),
}
TITLE = "全球技术视野"
ASSETS = Path(__file__).resolve().parents[1] / "assets"


def require_text(data, field):
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} 缺少有效文本")
    return value


def require_list(data, field):
    value = data.get(field)
    if not isinstance(value, list):
        raise ValueError(f"{field} 应为数组")
    return value


def read_date(data, field):
    value = require_text(data, field)
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError(f"{field} 应为 YYYY-MM-DD")
    return date.fromisoformat(value)


def source_key(value):
    url = urlsplit(value)
    if (url.scheme not in {"http", "https"} or not url.hostname or url.username
            or url.password or re.search(r"\s", value)):
        raise ValueError(f"无效来源链接 {value}")
    host = url.hostname.lower().removeprefix("www.")
    port = url.port
    if port and (url.scheme, port) not in {("http", 80), ("https", 443)}:
        host = f"{host}:{port}"
    query = urlencode(sorted(
        (key, val) for key, val in parse_qsl(url.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in {"fbclid", "gclid", "_bhlid"}
    ))
    return host, url.path.rstrip("/"), query, url.fragment.split(":~:text=", 1)[0]


def validate(file, issue, seen):
    end = read_date(issue, "date")
    start = read_date(issue, "windowStart")
    if file.stem != end.isoformat() or start > end:
        raise ValueError("日期与文件名不一致，或观察窗口起始过晚")
    for field in ("headline", "opening", "insight", "coverage"):
        require_text(issue, field)
    for entry in require_list(issue, "watch"):
        require_text({"watch": entry}, "watch")
    sections = issue.get("sections")
    if not isinstance(sections, dict) or sections.keys() != SECTIONS.keys():
        raise ValueError("sections 必须提供四个约定栏目")

    for category in SECTIONS:
        for item in require_list(sections, category):
            fields = ("id", "title", "region", "status", "fact", "impact", "check")
            for field in fields:
                require_text(item, field)
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", item["id"]):
                raise ValueError(f"事件 ID 应使用小写英文字母、数字和短横线（{item['id']}）")
            sources = require_list(item, "sources")
            if not sources:
                raise ValueError(f"{item['id']} 缺少来源")
            keys = []
            for source in sources:
                for field in ("name", "kind"):
                    require_text(source, field)
                if read_date(source, "date") > end:
                    raise ValueError(f"{item['id']} 的来源晚于本期截止日")
                keys.append(source_key(require_text(source, "url")))
            clean_title = "".join(
                char for char in unicodedata.normalize("NFKC", item["title"]).casefold()
                if char.isalnum()
            )
            if not clean_title:
                raise ValueError(f"{item['id']} 缺少可识别标题")
            for key in (("ID", item["id"]), ("标题", clean_title), ("主来源", keys[0])):
                previous = seen.get(key)
                if previous:
                    raise ValueError(f"{item['id']} 的{key[0]}重复，已见于 {previous}")
                seen[key] = f"{file.stem} / {item['id']}"


def load_issues(folder):
    folder.mkdir(parents=True, exist_ok=True)
    seen = {}
    issues = []
    for file in sorted(folder.glob("*.json")):
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", file.stem):
            continue
        try:
            issue = json.loads(file.read_text(encoding="utf-8"))
            validate(file, issue, seen)
        except (AttributeError, KeyError, TypeError, ValueError) as error:
            raise ValueError(f"{file.name} · {error}") from error
        issues.append(issue)
    return list(reversed(issues))


def page(title, home, css, body):
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)}</title>
<style>{css}</style>
</head>
<body>
<main>
<header class="masthead">
  <div><a class="brand" href="{home}">{TITLE}</a><span class="subtitle" lang="en">Global Technology Brief</span></div>
  <a class="archive-link" href="{home}">往期</a>
</header>
{body}
</main>
</body>
</html>
"""


def render_source(source, start):
    older = " · 窗口外参考" if source["date"] < start else ""
    href = escape(source["url"], quote=True)
    return (
        f'<li><a href="{href}">{escape(source["name"])} ↗</a> '
        f'<span>{escape(source["date"])} · {escape(source["kind"])}{older}</span></li>'
    )


def render_signal(item, start):
    sources = "".join(render_source(source, start) for source in item["sources"])
    return f"""<article class="signal" id="{item['id']}">
  <p class="meta">{escape(item['region'])} · {escape(item['status'])}</p>
  <h3>{escape(item['title'])}</h3>
  <p>{escape(item['fact'])}</p>
  <p><strong>影响</strong> {escape(item['impact'])}</p>
  <p class="check"><strong>验证与限制</strong> {escape(item['check'])}</p>
  <ul class="sources">{sources}</ul>
</article>"""


def render_issue(issue, css):
    start, end = issue["windowStart"], issue["date"]
    columns = []
    for key, (label, english) in SECTIONS.items():
        signals = "\n".join(render_signal(item, start) for item in issue["sections"][key])
        if not signals:
            signals = '<p class="check">本期暂无通过核验的更新。</p>'
        columns.append(
            f'<section id="{key}"><h2>{label}<span lang="en">{english}</span></h2>{signals}</section>'
        )
    watch = "".join(f"<li>{escape(entry)}</li>" for entry in issue["watch"])
    watch_html = f'<h2>接下来验证</h2><ul>{watch}</ul>' if watch else ""
    body = f"""<header class="lead">
  <p class="meta"><time datetime="{end}">{end}</time> · 观察窗口 {start} 至 {end} · 北京时间</p>
  <h1>{escape(issue['headline'])}</h1>
  <p>{escape(issue['opening'])}</p>
</header>
<nav class="section-nav" aria-label="栏目">
  {''.join(f'<a href="#{key}">{label}</a>' for key, (label, _) in SECTIONS.items())}
</nav>
<div class="columns">{''.join(columns)}</div>
<section class="editorial">
  <h2>编辑判断</h2>
  <p>{escape(issue['insight'])}</p>
  {watch_html}
  <p class="coverage"><strong>覆盖说明</strong> {escape(issue['coverage'])}</p>
</section>"""
    return page(f"{issue['headline']} | {TITLE}", "../index.html", css, body)


def render_index(issues, css):
    entries = "".join(
        f'<li><a href="briefs/{item["date"]}.html">'
        f'<time datetime="{item["date"]}">{item["date"]}</time>'
        f'<strong>{escape(item["headline"])}</strong></a></li>'
        for item in issues
    )
    summary = '<p>暂无期刊。</p>'
    if issues:
        latest = issues[0]
        summary = f"""<p class="meta">{latest['date']} · 最新一期</p>
  <h1>{escape(latest['headline'])}</h1>
  <p>{escape(latest['opening'])}</p>
  <a class="read" href="briefs/{latest['date']}.html">阅读最新一期 ↗</a>"""
    return page(TITLE, "#archive", css, f"""<header class="lead">{summary}</header>
<section id="archive"><h2>往期</h2><ul class="issues">{entries}</ul></section>""")


def write_page(path, content):
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(content)
            stream.close()
            os.chmod(temporary, 0o644)
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="核验并构建全球技术视野")
    parser.add_argument("--root", type=Path, default=Path("global-tech-radar"))
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        issues = load_issues(args.root / "brief-data")
        if not args.check:
            css = (ASSETS / "edition.css").read_text(encoding="utf-8")
            destination = args.root / "briefs"
            destination.mkdir(parents=True, exist_ok=True)
            for issue in issues:
                write_page(destination / f"{issue['date']}.html", render_issue(issue, css))
            write_page(args.root / "index.html", render_index(issues, css))
    except (OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")
    print(f"通过数据与去重检查，共 {len(issues)} 期" + ("" if args.check else "，已重建 HTML"))


if __name__ == "__main__":
    main()
