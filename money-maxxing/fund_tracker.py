import argparse
import hashlib
import json
import re
import sqlite3
import statistics
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "portfolio_db.sqlite"
SNAPSHOT_JSON_PATH = BASE_DIR / "portfolio_latest.json"
REPORTS_PATH = BASE_DIR / "reports.json"
PREDICTIONS_PATH = BASE_DIR / "predictions.json"
SCORECARD_PATH = BASE_DIR / "prediction_scorecard.md"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "http://fundf10.eastmoney.com/",
}

DIRECT_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
CN_TZ = timezone(timedelta(hours=8))

API_ENDPOINTS = [
    (
        "eastmoney_fund_lsjz",
        "http://api.fund.eastmoney.com/f10/lsjz?fundCode={code}&pageIndex=1&pageSize={size}",
        "http://fundf10.eastmoney.com/",
        "天天基金官方历史净值JSON接口（返回DWJZ单位净值、LJJZ累计净值、JZZZL日涨跌幅）",
    ),
    (
        "tencent_market_quote",
        "http://qt.gtimg.cn/q=sh000001,sz399001,sh000300,sz399006,sh000688,sh000832,sh510310,sz159819,sh515120,sh511260,sz300308,sz300502,sh688256,sh688041,sh688521,sz002230,sz000977,sh688111,sh603259,sh600276,sh688235,sz300759",
        "http://gu.qq.com/",
        "腾讯财经A股核心指数(含深成指算两市总成交额)+底层ETF(含十年国债ETF)+12只AI/医药核心重仓股实时行情接口",
    ),
    (
        "tencent_us_global_quote",
        "http://qt.gtimg.cn/q=usIXIC,usINX,usDJI,usSOXX,usNVDA,usAMD,usSMCI,usMRVL,usLITE,usLLY",
        "http://gu.qq.com/",
        "腾讯财经隔夜美股三大指数+半导体ETF(SOXX)+海外AI算力与医药龙头实时/收盘行情接口",
    ),
    (
        "eastmoney_stock_announcements",
        "https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=20&page_index=1&ann_type=A&stock_list=300308,300502,688256,688041,688521,002230,000977,688111,603259,600276,688235,300759",
        "https://data.eastmoney.com/",
        "东方财富重仓股官方公告中心接口（自动抓取财报、回购、订单澄清、投资者关系活动记录并入库）",
    ),
    (
        "sina_7x24_macro_telegraph",
        "https://zhibo.sina.com.cn/api/zhibo/feed?page=1&page_size=40&zhibo_id=152",
        "https://finance.sina.com.cn/",
        "新浪财经7x24小时全球宏观与市场实时电报接口（自动过滤央行、财政、人大、美债、美联储、AI、医药快讯并入库）",
    ),
    (
        "eastmoney_fund_pingzhongdata",
        "http://fund.eastmoney.com/pingzhongdata/{code}.js",
        "http://fund.eastmoney.com/",
        "天天基金品种全景数据JS接口（含全部历史净值，用于波动基准、条件胜率回测与预测打分）",
    ),
    (
        "eastmoney_index_kline",
        "http://push2his.eastmoney.com/api/qt/stock/kline/get?secid={secid}&fields1=f1,f2,f3&fields2=f51,f53&klt=101&fqt=0&beg={beg}&end={end}",
        "http://quote.eastmoney.com/",
        "东方财富指数日K收盘价接口（指数类预测打分用）",
    ),
]

# 可作为预测标的的指数（代码 -> 东方财富 secid）
INDEX_SECIDS = {
    "000001": "1.000001",  # 上证指数
    "399001": "0.399001",  # 深证成指
    "000300": "1.000300",  # 沪深300
    "399006": "0.399006",  # 创业板指
    "000688": "1.000688",  # 科创50
    "000832": "1.000832",  # 中证转债
}

PORTFOLIO_CONFIG = [
    {
        "code": "014437",
        "name": "鹏华中证同业存单AAA指数7天持有期",
        "category": "低风险现金管理（同业存单指数，非无风险）",
        "realized_profit": 3.38,
        "trigger_rule": "平时锁死不动；仅当110020亏超-1000元时赎回4000元抄底",
    },
    {
        "code": "110020",
        "name": "易方达沪深300ETF联接A",
        "category": "核心大盘宽基",
        "realized_profit": 0.0,
        "trigger_rule": "亏超-1000元从014437转4000元抄底；回本(+0元以上)减仓2500元",
    },
    {
        "code": "110027",
        "name": "易方达安心回报债券A",
        "category": "二级债基/固收+（2026Q3季报：股票15.70%、债券116.04%含杠杆）",
        "realized_profit": 0.0,
        "trigger_rule": "11月12日满30天(0.1%费率)后，亏损缩至-50元内卖出3000元转014437",
    },
    {
        "code": "012733",
        "name": "易方达人工智能ETF联接A",
        "category": "科技成长进攻",
        "realized_profit": 0.0,
        "trigger_rule": "11月12日满30天(0.10%费率，满180天才为0)后，红字盈利达+150元(+6%)卖出1000元落袋",
    },
    {
        "code": "012737",
        "name": "广发创新药产业ETF联接A",
        "category": "医药底部进攻",
        "realized_profit": 0.0,
        "trigger_rule": "11月12日满30天(0费率)后，红字盈利达+75元(+6%)卖出500元落袋",
    },
    {
        "code": "024430",
        "name": "东方红核心价值混合C",
        "category": "主动价值偏股(周云管理)",
        "realized_profit": 0.0,
        "trigger_rule": "长期核心底仓保留，满30天0赎回费，盈利超+375元(+15%)再考虑分批止盈",
    },
]
FUND_CODES = [item["code"] for item in PORTFOLIO_CONFIG]

# 持仓账本：每笔申购一行，份额以支付宝“确认份额”为准（新交易追加在这里，不要再用金额反推份额）。
# nav_date = 成交净值日（15:00后或非交易日下单顺延到下一交易日），confirm_date = 份额确认日，持有天数从这天算。
LOTS = [
    {"code": "014437", "ordered_at": "2026-08-28 19:26", "nav_date": "2026-08-31", "confirm_date": "2026-09-01",
     "amount": 7503.42, "nav": 1.1026, "shares": 6805.21,
     "note": "原买入15000元(13604.21份)，9/25赎回6799份到账7503.38元；余额按支付宝持有成本7503.42元记"},
    {"code": "110020", "ordered_at": "2026-08-28 19:00", "nav_date": "2026-08-31", "confirm_date": "2026-09-01",
     "amount": 7500.00, "nav": 1.8936, "shares": 3955.96},
    {"code": "110027", "ordered_at": "2026-08-28 19:02", "nav_date": "2026-08-31", "confirm_date": "2026-09-01",
     "amount": 2500.00, "nav": 2.2971, "shares": 1087.47, "note": "按申购费0.08%推算，两笔合计与支付宝2000.18份一致"},
    {"code": "024430", "ordered_at": "2026-10-10 17:57", "nav_date": "2026-10-12", "confirm_date": "2026-10-13",
     "amount": 2500.00, "nav": 1.1290, "shares": 2214.35, "note": "原计划022430(华夏中证A500)，误输为024430"},
    {"code": "012733", "ordered_at": "2026-10-10 17:58", "nav_date": "2026-10-12", "confirm_date": "2026-10-13",
     "amount": 2500.00, "nav": 1.8091, "shares": 1381.07},
    {"code": "012737", "ordered_at": "2026-10-10 17:59", "nav_date": "2026-10-12", "confirm_date": "2026-10-13",
     "amount": 1250.00, "nav": 0.5920, "shares": 2108.96},
    {"code": "110027", "ordered_at": "2026-10-10 17:59", "nav_date": "2026-10-12", "confirm_date": "2026-10-13",
     "amount": 2000.00, "nav": 2.1895, "shares": 912.71},
]

# 官方赎回费率（天天基金 jjfl 页，2026-10-31 核对）：(持有天数下限, 上限(含), 费率%)，赎回按先进先出逐笔计。
REDEMPTION_FEES = {
    "014437": [(0, None, 0.0)],
    "110020": [(0, 6, 1.5), (7, 364, 0.5), (365, 729, 0.25), (730, None, 0.0)],
    "110027": [(0, 6, 1.5), (7, 29, 0.75), (30, 364, 0.10), (365, 729, 0.05), (730, None, 0.0)],
    "012733": [(0, 6, 1.5), (7, 29, 0.5), (30, 179, 0.10), (180, None, 0.0)],
    "012737": [(0, 6, 1.5), (7, 29, 0.5), (30, None, 0.0)],
    "024430": [(0, 6, 1.5), (7, 29, 0.5), (30, None, 0.0)],
}

# 只用于提醒复核的措辞规则（lint 子命令）。硬性 = 确定性/自评命中类表述，出现即返回非零退出码。
HARD_PATTERNS = [
    (r"必(然|将|定|迎|涨|跌|会)", "确定性措辞"),
    (r"一定(会|能)|肯定(会|能)|绝对(会|不会)|毫无悬念|板上钉钉", "确定性措辞"),
    (r"100%\s*(命中|准确|确定|胜率|成功|把握)|百分之百", "宣称百分之百"),
    (r"(完全|精准)命中|一字不差", "自评命中"),
    (r"稳赚|稳赢|躺赚", "收益承诺"),
    (r"无风险(?!利率|收益率)|零风险", "把有风险资产称为无风险"),
    (r"铁底|底部已?(确认|探明)|底(已)?探明|见底了", "确定性底部判断"),
]
SOFT_PATTERNS = [
    (r"暴涨|暴跌|暴降|狂飙|闪崩|血洗|崩盘", "夸张涨跌词：用具体数字，偏离历史常态时再用形容词"),
    (r"至暗|惊魂|最靓|左轮手枪|救命|外科手术|断腕|止血|割肉|抄底良机", "戏剧化比喻"),
    (r"千万不要|立刻|马上|立即|赶紧|务必", "制造紧迫感"),
    (r"[🔥🚀💥‼]|！！", "渲染符号"),
]
FORECAST_HINT = r"预计|预测|有望|料将|或将|将会|大概率|看好|看涨|看跌"


def fetch_text(url: str, referer: str = "http://fundf10.eastmoney.com/", encoding: str = "utf-8") -> str:
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": HEADERS["User-Agent"], "Referer": referer},
            )
            with DIRECT_OPENER.open(req, timeout=8) as resp:
                return resp.read().decode(encoding, errors="replace")
        except Exception:
            if attempt == 2:
                raise
            time.sleep(0.5)
    return ""


def fetch_json(url: str, referer: str = "http://fundf10.eastmoney.com/") -> dict:
    return json.loads(fetch_text(url, referer=referer, encoding="utf-8"))


def load_json_list(path: Path) -> list:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def init_db(conn: sqlite3.Connection):
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS api_registry (
            key TEXT PRIMARY KEY,
            url_template TEXT,
            referer TEXT,
            description TEXT,
            updated_at TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS holdings (
            code TEXT PRIMARY KEY,
            name TEXT,
            category TEXT,
            principal REAL,
            shares REAL,
            cost_nav REAL,
            realized_profit REAL,
            trigger_rule TEXT,
            updated_at TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fund_nav_history (
            code TEXT,
            nav_date TEXT,
            dwjz REAL,
            ljjz REAL,
            daily_return_pct REAL,
            PRIMARY KEY (code, nav_date)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS index_history (
            secid TEXT,
            name TEXT,
            trade_date TEXT,
            close_price REAL,
            daily_return_pct REAL,
            volume_amount REAL,
            PRIMARY KEY (secid, trade_date)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS intelligence_reports (
            report_id TEXT PRIMARY KEY,
            report_date TEXT,
            total_principal REAL,
            total_amount REAL,
            total_profit REAL,
            return_pct REAL,
            key_events TEXT,
            short_term_forecast TEXT,
            mid_term_forecast TEXT,
            long_term_forecast TEXT,
            verification_notes TEXT,
            updated_at TEXT
        )
    """)
    report_cols = [r[1] for r in cur.execute("PRAGMA table_info(intelligence_reports)")]
    if "review_notes" not in report_cols:
        cur.execute("ALTER TABLE intelligence_reports ADD COLUMN review_notes TEXT")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS prediction_registry (
            id TEXT PRIMARY KEY,
            fingerprint TEXT,
            first_seen_at TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS prediction_results (
            id TEXT PRIMARY KEY,
            status TEXT,
            outcome INTEGER,
            actual REAL,
            resolved_on TEXT,
            brier REAL,
            graded_at TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS global_market_history (
            symbol TEXT,
            name TEXT,
            trade_date TEXT,
            close_price REAL,
            daily_return_pct REAL,
            updated_at TEXT,
            PRIMARY KEY (symbol, trade_date)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS stock_announcements (
            ann_id TEXT PRIMARY KEY,
            stock_code TEXT,
            stock_name TEXT,
            notice_date TEXT,
            title TEXT,
            fetched_at TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS macro_news_archive (
            news_id TEXT PRIMARY KEY,
            pub_time TEXT,
            content TEXT,
            fetched_at TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS asset_kline_history (
            symbol TEXT,
            asset_type TEXT,
            name TEXT,
            trade_date TEXT,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            daily_return_pct REAL,
            volume REAL,
            amount REAL,
            updated_at TEXT,
            PRIMARY KEY (symbol, trade_date)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fund_est_tracking (
            code TEXT,
            trade_date TEXT,
            est_time TEXT,
            est_pct REAL,
            est_nav REAL,
            settled_dwjz REAL,
            settled_pct REAL,
            error_bps REAL,
            updated_at TEXT,
            PRIMARY KEY (code, trade_date)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fund_top_holdings (
            fund_code TEXT,
            stock_code TEXT,
            stock_name TEXT,
            weight_pct REAL,
            report_period TEXT,
            PRIMARY KEY (fund_code, stock_code, report_period)
        )
    """)
    top_holdings_seed = [
        ("012733", "300308", "中际旭创", 10.2, "2026Q3"),
        ("012733", "300502", "新易盛", 8.5, "2026Q3"),
        ("012733", "688256", "寒武纪", 9.1, "2026Q3"),
        ("012733", "688041", "海光信息", 8.4, "2026Q3"),
        ("012733", "002230", "科大讯飞", 6.2, "2026Q3"),
        ("012733", "000977", "浪潮信息", 5.1, "2026Q3"),
        ("012733", "688111", "金山办公", 4.8, "2026Q3"),
        ("012733", "688521", "芯原股份", 3.5, "2026Q3"),
        ("012737", "603259", "药明康德", 10.1, "2026Q3"),
        ("012737", "600276", "恒瑞医药", 9.8, "2026Q3"),
        ("012737", "688235", "百济神州", 7.6, "2026Q3"),
        ("012737", "300759", "康龙化成", 4.5, "2026Q3"),
    ]
    cur.executemany(
        "INSERT OR REPLACE INTO fund_top_holdings VALUES (?, ?, ?, ?, ?)",
        top_holdings_seed,
    )
    now_str = datetime.now().isoformat(timespec="seconds")
    # 线报正文由 Gemini 写在 reports.json；review_notes 由侧评审填写
    for rep in load_json_list(REPORTS_PATH):
        cur.execute(
            """INSERT OR REPLACE INTO intelligence_reports
               (report_id, report_date, total_principal, total_amount, total_profit, return_pct, key_events,
                short_term_forecast, mid_term_forecast, long_term_forecast, verification_notes, updated_at, review_notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                rep["report_id"], rep["report_date"], rep.get("total_principal"), rep.get("total_amount"),
                rep.get("total_profit"), rep.get("return_pct"), rep.get("key_events"), rep.get("short_term_forecast"),
                rep.get("mid_term_forecast"), rep.get("long_term_forecast"), rep.get("verification_notes"),
                now_str, rep.get("review_notes", ""),
            ),
        )
    for key, url_t, ref, desc in API_ENDPOINTS:
        cur.execute(
            "INSERT OR REPLACE INTO api_registry VALUES (?, ?, ?, ?, ?)",
            (key, url_t, ref, desc, now_str),
        )
    conn.commit()


def cn_date(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, CN_TZ).strftime("%Y-%m-%d")


def sync_full_history(cur, code: str) -> int:
    js = fetch_text(f"http://fund.eastmoney.com/pingzhongdata/{code}.js", referer="http://fund.eastmoney.com/")
    trend = json.loads(re.search(r"Data_netWorthTrend\s*=\s*(\[.*?\]);", js, re.S).group(1))
    ac = {}
    ac_match = re.search(r"Data_ACWorthTrend\s*=\s*(\[.*?\]);", js, re.S)
    if ac_match:
        for x, y in json.loads(ac_match.group(1)):
            ac[cn_date(x)] = y
    for p in trend:
        d = cn_date(p["x"])
        cur.execute(
            "INSERT OR REPLACE INTO fund_nav_history VALUES (?, ?, ?, ?, ?)",
            (code, d, p["y"], ac.get(d) or p["y"], float(p.get("equityReturn") or 0.0)),
        )
    return len(trend)


def nav_series(cur, code: str) -> dict:
    return dict(cur.execute(
        "SELECT nav_date, dwjz FROM fund_nav_history WHERE code = ? ORDER BY nav_date", (code,)
    ).fetchall())


def next_weekday(d: date) -> date:
    d += timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def redemption_fee_pct(code: str, days_held: int) -> float:
    for lo, hi, pct in REDEMPTION_FEES[code]:
        if days_held >= lo and (hi is None or days_held <= hi):
            return pct
    return 0.0


def lot_fee_rows(latest_nav: dict, redeem_day: date) -> list:
    """按先进先出逐笔计算：假设在 redeem_day 全部赎回的费率、费用，以及下一次费率变化日。"""
    rows = []
    for lot in LOTS:
        code = lot["code"]
        confirm = date.fromisoformat(lot["confirm_date"])
        days_held = (redeem_day - confirm).days
        pct = redemption_fee_pct(code, days_held)
        value = round(lot["shares"] * latest_nav[code], 2)
        next_change = None
        for lo, _hi, new_pct in REDEMPTION_FEES[code]:
            if lo > days_held:
                next_change = {"date": (confirm + timedelta(days=lo)).isoformat(), "days_held": lo, "fee_pct": new_pct}
                break
        rows.append({
            "code": code,
            "nav_date": lot["nav_date"],
            "confirm_date": lot["confirm_date"],
            "shares": lot["shares"],
            "principal": lot["amount"],
            "value": value,
            "days_held": days_held,
            "fee_pct": pct,
            "fee_yuan": round(value * pct / 100, 2),
            "next_fee_change": next_change,
        })
    return rows


def quantiles(values: list, qs=(0.1, 0.5, 0.9)) -> list:
    s = sorted(values)
    return [s[int(q * (len(s) - 1))] for q in qs]


def risk_context(cur, amounts: dict, horizons=(1, 5, 8, 20), lookback=250) -> dict:
    """历史波动基准：用近 lookback 个交易日的日涨跌幅，给出各基金与当前组合在不同持有期的常见涨跌区间。"""
    returns = {}
    for code in amounts:
        rows = cur.execute(
            "SELECT nav_date, daily_return_pct FROM fund_nav_history WHERE code = ? ORDER BY nav_date DESC LIMIT ?",
            (code, lookback + 1),
        ).fetchall()
        returns[code] = {d: (r or 0.0) / 100 for d, r in rows}
    funds = {}
    for code, series in returns.items():
        rs = [series[d] for d in sorted(series)][-lookback:]
        if len(rs) < 30:
            continue
        item = {"days": len(rs), "daily_sd_pct": round(statistics.pstdev(rs) * 100, 2)}
        for h in horizons:
            window = []
            for i in range(len(rs) - h + 1):
                v = 1.0
                for r in rs[i:i + h]:
                    v *= 1 + r
                window.append((v - 1) * 100)
            item[f"{h}d_p10_p50_p90_pct"] = [round(x, 2) for x in quantiles(window)]
        funds[code] = item
    common = sorted(set.intersection(*[set(s) for s in returns.values()]))[-lookback:]
    daily_yuan = [sum(amounts[c] * returns[c][d] for c in amounts) for d in common]
    portfolio = {"days": len(daily_yuan), "basis": "当前各基金持有金额 × 历史日涨跌幅（不含未来调仓）"}
    if len(daily_yuan) >= 30:
        portfolio["daily_sd_yuan"] = round(statistics.pstdev(daily_yuan), 0)
        for h in horizons:
            sums = [sum(daily_yuan[i:i + h]) for i in range(len(daily_yuan) - h + 1)]
            p10, p50, p90 = quantiles(sums)
            portfolio[f"{h}d_yuan"] = {"p10": round(p10), "p50": round(p50), "p90": round(p90),
                                       "worst": round(min(sums)), "best": round(max(sums))}
    return {"lookback_trading_days": lookback, "funds": funds, "portfolio": portfolio}


def index_closes(cur, code: str, beg: str, end: str) -> dict:
    url = (
        f"http://push2his.eastmoney.com/api/qt/stock/kline/get?secid={INDEX_SECIDS[code]}"
        f"&fields1=f1,f2,f3&fields2=f51,f53&klt=101&fqt=0&beg={beg.replace('-', '')}&end={end.replace('-', '')}"
    )
    data = fetch_json(url, referer="http://quote.eastmoney.com/").get("data") or {}
    out = {}
    for line in data.get("klines") or []:
        d, close = line.split(",")[:2]
        out[d] = float(close)
        cur.execute(
            "INSERT OR IGNORE INTO index_history (secid, name, trade_date, close_price) VALUES (?, ?, ?, ?)",
            (code, data.get("name"), d, float(close)),
        )
    return out


OPS = {">": lambda a, b: a > b, ">=": lambda a, b: a >= b, "<": lambda a, b: a < b, "<=": lambda a, b: a <= b}
METRICS = ("return", "nav", "close", "profit")


def validate_prediction(p: dict) -> list:
    problems = []
    for key in ("id", "target", "metric", "op", "value", "base_date", "eval_date", "statement"):
        if p.get(key) in (None, ""):
            problems.append(f"缺少字段 {key}")
    target = p.get("target")
    if target not in FUND_CODES and target not in INDEX_SECIDS and target != "PORTFOLIO":
        problems.append(f"未知标的 {target}")
    if p.get("metric") not in METRICS:
        problems.append(f"未知指标 {p.get('metric')}")
    if p.get("metric") == "profit" and target in INDEX_SECIDS:
        problems.append("指数没有持有收益，profit 只能用于基金或 PORTFOLIO")
    if p.get("op") not in OPS:
        problems.append(f"未知比较符 {p.get('op')}")
    if p.get("mode", "at") not in ("at", "any"):
        problems.append("mode 只能是 at 或 any")
    if p.get("base_date") and p.get("eval_date") and p["base_date"] >= p["eval_date"]:
        problems.append("eval_date 必须晚于 base_date")
    prob = p.get("probability")
    if prob is None:
        if not str(p.get("source", "")).startswith("legacy"):
            problems.append("缺少概率（新预测必须给出 0.05~0.95 的概率）")
    elif not 0.05 <= prob <= 0.95:
        problems.append(f"概率 {prob} 超出 0.05~0.95（不允许宣称近乎确定）")
    return problems


def grade_predictions(conn: sqlite3.Connection) -> dict:
    cur = conn.cursor()
    preds = load_json_list(PREDICTIONS_PATH)
    now_str = datetime.now().isoformat(timespec="seconds")
    today = datetime.now(CN_TZ).date().isoformat()
    shares = {}
    principal = {}
    for lot in LOTS:
        shares[lot["code"]] = shares.get(lot["code"], 0.0) + lot["shares"]
        principal[lot["code"]] = principal.get(lot["code"], 0.0) + lot["amount"]
    fund_series = {code: nav_series(cur, code) for code in FUND_CODES}
    common = set.intersection(*[set(s) for s in fund_series.values()])
    portfolio_series = {d: sum(shares[c] * fund_series[c][d] for c in FUND_CODES) for d in common}

    results, issues = [], []
    seen_ids = set()
    for p in preds:
        pid = p.get("id", "?")
        if pid in seen_ids:
            issues.append(f"{pid}：ID 重复")
        seen_ids.add(pid)
        problems = validate_prediction(p)
        fingerprint = hashlib.sha1(json.dumps(p, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
        known = cur.execute("SELECT fingerprint FROM prediction_registry WHERE id = ?", (pid,)).fetchone()
        if known is None:
            cur.execute("INSERT INTO prediction_registry VALUES (?, ?, ?)", (pid, fingerprint, now_str))
        elif known[0] != fingerprint:
            problems.append("登记后内容被修改（预测只能新增，不能改）")
        issues.extend(f"{pid}：{msg}" for msg in problems)
        row = {"id": pid, "target": p.get("target"), "condition": f"{p.get('metric')} {p.get('op')} {p.get('value')}",
               "window": f"{p.get('base_date')} → {p.get('eval_date')} ({p.get('mode', 'at')})",
               "probability": p.get("probability"), "status": "pending", "outcome": None, "actual": None,
               "resolved_on": None, "brier": None}
        if any(msg.startswith(("缺少字段", "未知", "指数没有", "mode", "eval_date")) for msg in problems):
            row["status"] = "invalid"
            results.append(row)
            continue

        target, metric = p["target"], p["metric"]
        try:
            if target == "PORTFOLIO":
                series = portfolio_series
            elif target in FUND_CODES:
                series = fund_series[target]
            else:
                series = index_closes(cur, target, p["base_date"], p["eval_date"])
        except Exception as e:
            row["status"] = f"no_data ({e})"
            results.append(row)
            continue
        dates = sorted(series)
        base_days = [d for d in dates if d <= p["base_date"]]
        if not base_days:
            row["status"] = "no_data (缺少基准日数据)"
            results.append(row)
            continue
        base_val = series[base_days[-1]]

        def measure(d):
            v = series[d]
            if metric == "return":
                return (v / base_val - 1) * 100
            if metric == "profit":
                if target == "PORTFOLIO":
                    return v - sum(principal.values())
                return v * shares[target] - principal[target]
            return v

        window = [d for d in dates if p["base_date"] < d <= p["eval_date"]]
        eval_passed = bool(dates) and (dates[-1] >= p["eval_date"] or (
            today > p["eval_date"] and date.fromisoformat(p["eval_date"]).weekday() >= 5))
        check = OPS[p["op"]]
        if p.get("mode", "at") == "any":
            hit_day = next((d for d in window if check(measure(d), p["value"])), None)
            if hit_day:
                row.update(status="resolved", outcome=1, actual=round(measure(hit_day), 4), resolved_on=hit_day)
            elif eval_passed and window:
                row.update(status="resolved", outcome=0, actual=round(measure(window[-1]), 4), resolved_on=window[-1])
        elif eval_passed and window:
            day = window[-1]
            row.update(status="resolved", outcome=int(check(measure(day), p["value"])),
                       actual=round(measure(day), 4), resolved_on=day)
        if row["status"] == "pending" and window:
            row["actual"] = round(measure(window[-1]), 4)
        if row["outcome"] is not None and p.get("probability") is not None:
            row["brier"] = round((p["probability"] - row["outcome"]) ** 2, 4)
        cur.execute(
            "INSERT OR REPLACE INTO prediction_results VALUES (?, ?, ?, ?, ?, ?, ?)",
            (pid, row["status"], row["outcome"], row["actual"], row["resolved_on"], row["brier"], now_str),
        )
        results.append(row)
    conn.commit()

    resolved = [r for r in results if r["status"] == "resolved"]
    with_prob = [r for r in resolved if r["brier"] is not None]
    summary = {
        "registered": len(results),
        "resolved": len(resolved),
        "hits": sum(r["outcome"] for r in resolved),
        "hit_rate_pct": round(100 * sum(r["outcome"] for r in resolved) / len(resolved), 1) if resolved else None,
        "with_probability_resolved": len(with_prob),
        "mean_brier": round(statistics.mean(r["brier"] for r in with_prob), 4) if with_prob else None,
        "mean_stated_probability_pct": round(100 * statistics.mean(r["probability"] for r in with_prob), 1) if with_prob else None,
        "pending": sum(1 for r in results if r["status"] == "pending"),
        "issues": issues,
    }
    write_scorecard(summary, results, preds)
    return summary


def write_scorecard(summary: dict, results: list, preds: list):
    by_id = {p.get("id"): p for p in preds}
    lines = [
        "# 预测记分卡（由 `python fund_tracker.py grade` 按收盘数据自动生成，请勿手改）",
        "",
        f"> 生成时间：{datetime.now().isoformat(timespec='seconds')}｜判定口径：基金用单位净值，指数用日收盘价，盘中数据不参与判定。",
        "",
        "## 汇总",
        "",
        "| 项目 | 数值 |",
        "| :--- | :--- |",
        f"| 已登记预测 | {summary['registered']} |",
        f"| 已判定 | {summary['resolved']}（命中 {summary['hits']}，命中率 {summary['hit_rate_pct'] if summary['hit_rate_pct'] is not None else '—'}%） |",
        f"| 带概率的已判定 | {summary['with_probability_resolved']}，平均 Brier {summary['mean_brier'] if summary['mean_brier'] is not None else '—'}（0 最好；每次都说 50% 的得分是 0.25） |",
        f"| 声称概率均值 vs 实际命中率 | {summary['mean_stated_probability_pct'] if summary['mean_stated_probability_pct'] is not None else '—'}% vs {summary['hit_rate_pct'] if summary['hit_rate_pct'] is not None else '—'}% |",
        f"| 待判定 | {summary['pending']} |",
        "",
        "## 问题",
        "",
    ]
    lines += [f"- {msg}" for msg in summary["issues"]] or ["- 无"]
    lines += ["", "## 明细", "", "| ID | 标的 | 条件 | 窗口 | 概率 | 状态 | 实际值 | 判定日 | Brier | 原文 |",
              "| :--- | :--- | :--- | :--- | :---: | :--- | ---: | :--- | ---: | :--- |"]
    for r in results:
        outcome = {1: "✅ 命中", 0: "❌ 未中"}.get(r["outcome"], r["status"])
        stmt = str(by_id.get(r["id"], {}).get("statement", "")).replace("|", "/")
        lines.append(
            f"| {r['id']} | {r['target']} | {r['condition']} | {r['window']} | {r['probability'] if r['probability'] is not None else '未给'} "
            f"| {outcome} | {r['actual'] if r['actual'] is not None else '—'} | {r['resolved_on'] or '—'} "
            f"| {r['brier'] if r['brier'] is not None else '—'} | {stmt} |"
        )
    SCORECARD_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def lint_text(path: Path, section: str = None) -> int:
    lines = path.read_text(encoding="utf-8").splitlines()
    start, end = 0, len(lines)
    if section:
        start = next((i for i, line in enumerate(lines) if section in line), None)
        if start is None:
            print(f"未找到包含“{section}”的行")
            return 2
        level = len(lines[start]) - len(lines[start].lstrip("#"))
        if level:
            end = next((i for i in range(start + 1, len(lines))
                        if lines[i].startswith("#") and len(lines[i]) - len(lines[i].lstrip("#")) <= level), len(lines))
    hard = soft = 0
    for i in range(start, end):
        # 〔侧评审…〕注释和删除线里的文字是评审引用的原话，不计入
        line = re.sub(r"〔侧评审[^〕]*〕|~~.*?~~", "", lines[i])
        for pattern, label in HARD_PATTERNS:
            for m in re.finditer(pattern, line):
                hard += 1
                print(f"L{i + 1} [硬] {label}：{m.group(0)} ｜ {line.strip()[:80]}")
        for pattern, label in SOFT_PATTERNS:
            for m in re.finditer(pattern, line):
                soft += 1
                print(f"L{i + 1} [软] {label}：{m.group(0)} ｜ {line.strip()[:80]}")
        if re.search(FORECAST_HINT, line) and not re.search(r"概率|可能性|置信", line):
            soft += 1
            print(f"L{i + 1} [软] 预测未给概率 ｜ {line.strip()[:80]}")
    print(f"\n共 {hard} 处硬性问题、{soft} 处待复核措辞（{path.name}{' / ' + section if section else ''}）")
    return 1 if hard else 0


KLINE_TARGETS = [
    ("000001", "1.000001", "INDEX", "上证指数"),
    ("399001", "0.399001", "INDEX", "深证成指"),
    ("000300", "1.000300", "INDEX", "沪深300"),
    ("399006", "0.399006", "INDEX", "创业板指"),
    ("000688", "1.000688", "INDEX", "科创50"),
    ("000832", "1.000832", "INDEX", "中证转债"),
    ("510310", "1.510310", "ETF", "沪深300ETF易方达"),
    ("159819", "0.159819", "ETF", "人工智能ETF易方达"),
    ("515120", "1.515120", "ETF", "创新药ETF广发"),
    ("511260", "1.511260", "ETF", "十年国债ETF国泰"),
    ("300308", "0.300308", "STOCK", "中际旭创"),
    ("300502", "0.300502", "STOCK", "新易盛"),
    ("688256", "1.688256", "STOCK", "寒武纪"),
    ("688041", "1.688041", "STOCK", "海光信息"),
    ("688521", "1.688521", "STOCK", "芯原股份"),
    ("603259", "1.603259", "STOCK", "药明康德"),
    ("600276", "1.600276", "STOCK", "恒瑞医药"),
    ("688235", "1.688235", "STOCK", "百济神州"),
]

US_KLINE_TARGETS = [
    (".IXIC", "us.IXIC", "US_INDEX", "纳斯达克"),
    (".INX", "us.INX", "US_INDEX", "标普500"),
    ("SOXX.OQ", "usSOXX.OQ", "US_ETF", "费城半导体ETF"),
    ("NVDA.OQ", "usNVDA.OQ", "US_STOCK", "英伟达"),
]


def sync_kline_history(cur, full: bool = False):
    """自动回补近 250 个交易日的指数、底层 ETF、核心重仓股与美股日 K 线。"""
    now_str = datetime.now().isoformat(timespec="seconds")
    for sym, secid, atype, name in KLINE_TARGETS:
        cnt = cur.execute("SELECT COUNT(*) FROM asset_kline_history WHERE symbol=?", (sym,)).fetchone()[0]
        limit = 260 if (full or cnt < 200) else 10
        url = (
            f"http://push2his.eastmoney.com/api/qt/stock/kline/get?secid={secid}"
            f"&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59&klt=101&fqt=1&end=20500101&lmt={limit}"
        )
        try:
            data = fetch_json(url, referer="http://quote.eastmoney.com/").get("data") or {}
            for line in data.get("klines") or []:
                parts = line.split(",")
                if len(parts) < 9:
                    continue
                t_date, o, c, h, l, vol, amt, _amp, pct = (
                    parts[0], float(parts[1]), float(parts[2]), float(parts[3]),
                    float(parts[4]), float(parts[5]), float(parts[6]), parts[7], float(parts[8])
                )
                cur.execute(
                    "INSERT OR REPLACE INTO asset_kline_history VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (sym, atype, name, t_date, o, h, l, c, pct, vol, amt, now_str),
                )
                if atype == "INDEX":
                    cur.execute(
                        "INSERT OR REPLACE INTO index_history VALUES (?, ?, ?, ?, ?, ?)",
                        (sym, name, t_date, c, pct, amt),
                    )
        except Exception:
            pass

    for sym, qparam, atype, name in US_KLINE_TARGETS:
        cnt = cur.execute("SELECT COUNT(*) FROM asset_kline_history WHERE symbol=?", (sym,)).fetchone()[0]
        limit = 250 if (full or cnt < 180) else 10
        url = f"http://web.ifzq.gtimg.cn/appstock/app/usfqkline/get?_var=kline_day&param={qparam},day,,,{limit},qfq"
        try:
            raw = fetch_text(url, referer="http://gu.qq.com/")
            m = re.search(r"kline_day=(\{.*\})", raw)
            if not m:
                continue
            d_obj = json.loads(m.group(1)).get("data", {}).get(qparam, {})
            klines = d_obj.get("qfqday") or d_obj.get("day") or []
            prev_c = None
            for row in klines:
                if len(row) < 6:
                    continue
                t_date, o, c, h, l, vol = row[0], float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5])
                pct = round((c / prev_c - 1) * 100, 2) if prev_c else 0.0
                prev_c = c
                cur.execute(
                    "INSERT OR REPLACE INTO asset_kline_history VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (sym, atype, name, t_date, o, h, l, c, pct, vol, 0.0, now_str),
                )
                cur.execute(
                    "INSERT OR REPLACE INTO global_market_history VALUES (?, ?, ?, ?, ?, ?)",
                    (sym, name, t_date, c, pct, now_str),
                )
        except Exception:
            pass


def compute_dynamic_ols_est_map(cur, qt_map: dict) -> tuple:
    """利用 SQLite 中近 60 个交易日的真实历史数据做多元线性最小二乘拟合，动态校准盘中预估系数。"""
    def series_pct(sym_or_code, is_fund=False):
        if is_fund:
            rows = cur.execute(
                "SELECT nav_date, daily_return_pct FROM fund_nav_history WHERE code=? ORDER BY nav_date DESC LIMIT 90",
                (sym_or_code,),
            ).fetchall()
        else:
            rows = cur.execute(
                "SELECT trade_date, daily_return_pct FROM asset_kline_history WHERE symbol=? ORDER BY trade_date DESC LIMIT 90",
                (sym_or_code,),
            ).fetchall()
        return {d: float(r or 0.0) for d, r in rows}

    # 简单网格/坐标下降求解非负约束 OLS 系数，防止过拟合
    def fit_weights(fund_code, proxy_syms, default_weights):
        y_map = series_pct(fund_code, is_fund=True)
        x_maps = [series_pct(s, is_fund=False) for s in proxy_syms]
        common_dates = sorted(set(y_map).intersection(*[set(xm) for xm in x_maps]))[-60:]
        if len(common_dates) < 25:
            return default_weights, None
        weights = list(default_weights)
        for _ in range(40):
            for j in range(len(weights)):
                num, den = 0.0, 0.0
                for d in common_dates:
                    pred_other = sum(weights[k] * x_maps[k][d] for k in range(len(weights)) if k != j)
                    res = y_map[d] - pred_other
                    xj = x_maps[j][d]
                    num += res * xj
                    den += xj * xj
                if den > 1e-6:
                    weights[j] = max(0.0, min(1.2, num / den))
        errs = [
            abs(y_map[d] - sum(weights[k] * x_maps[k][d] for k in range(len(weights)))) * 100
            for d in common_dates
        ]
        mae_bps = round(statistics.mean(errs), 1)
        return [round(w, 3) for w in weights], mae_bps

    w_110027, mae_110027 = fit_weights("110027", ["511260", "000832", "000300", "159819"], [0.85, 0.12, 0.08, 0.10])
    w_024430, mae_024430 = fit_weights("024430", ["000300", "600276", "603259"], [0.68, 0.08, 0.05])

    est_110027 = round(
        w_110027[0] * qt_map.get("511260", {}).get("pct", 0.0)
        + w_110027[1] * qt_map.get("000832", {}).get("pct", 0.0)
        + w_110027[2] * qt_map.get("000300", {}).get("pct", 0.0)
        + w_110027[3] * qt_map.get("159819", {}).get("pct", 0.0),
        2,
    )
    est_024430 = round(
        w_024430[0] * qt_map.get("000300", {}).get("pct", 0.0)
        + w_024430[1] * qt_map.get("600276", {}).get("pct", 0.0)
        + w_024430[2] * qt_map.get("603259", {}).get("pct", 0.0),
        2,
    )
    est_map = {
        "014437": 0.01,
        "110020": round(qt_map.get("000300", {}).get("pct", 0.0) * 0.95, 2),
        "012733": round(qt_map.get("159819", {}).get("pct", 0.0) * 0.95, 2),
        "012737": round(qt_map.get("515120", {}).get("pct", 0.0) * 0.95, 2),
        "110027": est_110027,
        "024430": est_024430,
    }
    ols_meta = {
        "110027": {"proxies": ["511260(十年国债)", "000832(转债)", "000300(沪深300)", "159819(AI)"], "weights": w_110027, "mae_bps_60d": mae_110027},
        "024430": {"proxies": ["000300(沪深300)", "600276(恒瑞)", "603259(药明)"], "weights": w_024430, "mae_bps_60d": mae_024430},
    }
    return est_map, ols_meta


def compute_forecast_signals(cur, portfolio_summary: list, qt_map: dict, us_map: dict, ols_meta: dict) -> dict:
    """三维状态机（趋势乖离 × 两市量能比 × 外盘与重仓股分化 + 公告事件打分），计算高胜率条件分布。"""
    sh_amt = qt_map.get("000001", {}).get("amount_yi", 0.0)
    sz_amt = qt_map.get("399001", {}).get("amount_yi", 0.0)
    total_turnover_yi = round(sh_amt + sz_amt, 2)
    sh_hist = dict(cur.execute(
        "SELECT trade_date, amount FROM asset_kline_history WHERE symbol='000001' ORDER BY trade_date DESC LIMIT 25"
    ).fetchall())
    sz_hist = dict(cur.execute(
        "SELECT trade_date, amount FROM asset_kline_history WHERE symbol='399001' ORDER BY trade_date DESC LIMIT 25"
    ).fetchall())
    common_t_dates = sorted(set(sh_hist).intersection(sz_hist), reverse=True)
    latest_mkt_date = qt_map.get("000001", {}).get("trade_date", "")
    prev_Dates = [d for d in common_t_dates if d < latest_mkt_date]
    prev_turnover_yi = round((sh_hist[prev_Dates[0]] + sz_hist[prev_Dates[0]]) / 1e8, 2) if prev_Dates else None
    ma20_turnover_yi = (
        round(statistics.mean([(sh_hist[d] + sz_hist[d]) / 1e8 for d in prev_Dates[:20]]), 2)
        if len(prev_Dates) >= 5 else None
    )
    vol_ratio_vs_ma20 = round(total_turnover_yi / ma20_turnover_yi, 2) if ma20_turnover_yi else None

    def avg_pct(codes):
        vals = [qt_map[c]["pct"] for c in codes if c in qt_map]
        return round(statistics.mean(vals), 2) if vals else 0.0

    cpo_avg = avg_pct(["300308", "300502"])
    chip_soft_avg = avg_pct(["688256", "688041", "688521", "002230", "000977", "688111"])
    cxo_avg = avg_pct(["603259", "300759"])
    innov_pharma_avg = avg_pct(["600276", "688235"])

    # 计算重仓股近期公告事件冲击分 (Event Impact Score)
    pos_re = re.compile(r"回购|增持|获批|受理|合同|中标|分红")
    neg_re = re.compile(r"减持|警示|处罚|终止|亏损|诉讼")
    recent_anns = cur.execute(
        "SELECT stock_code, title FROM stock_announcements ORDER BY notice_date DESC LIMIT 30"
    ).fetchall()
    event_scores = {}
    for f_code in ("012733", "012737"):
        weights = dict(cur.execute(
            "SELECT stock_code, weight_pct FROM fund_top_holdings WHERE fund_code=?", (f_code,)
        ).fetchall())
        score = 0.0
        for s_code, title in recent_anns:
            if s_code in weights:
                if pos_re.search(title):
                    score += weights[s_code] * 1.0
                elif neg_re.search(title):
                    score -= weights[s_code] * 1.0
        event_scores[f_code] = round(score, 2)

    fund_signals = {}
    for h in portfolio_summary:
        code = h["code"]
        rows = cur.execute(
            "SELECT nav_date, dwjz, daily_return_pct FROM fund_nav_history WHERE code=? ORDER BY nav_date ASC",
            (code,),
        ).fetchall()[-250:]
        if len(rows) < 35:
            continue
        navs = [r[1] for r in rows]
        rets = [r[2] or 0.0 for r in rows]
        last_nav = navs[-1]
        ma20 = statistics.mean(navs[-20:])
        ma20_gap = round((last_nav / ma20 - 1) * 100, 2)
        p10, _p50, p90 = quantiles(rets)
        sd = statistics.pstdev(rets)
        last_1d = rets[-1]
        if last_1d > p90:
            regime_1d = "surge_gt_p90"
        elif last_1d < p10:
            regime_1d = "drop_lt_p10"
        else:
            regime_1d = "normal_p10_p90"

        trend_zone = "oversold_below_ma20" if ma20_gap < -1.5 else ("overbought_above_ma20" if ma20_gap > 1.5 else "near_ma20")

        # 双因子联合回测（MA20 位置 + 单日动量状态），若样本不足 10 则回退到单日动量状态
        def backtest_slice(require_trend: bool):
            c_up, c_non_pos, c_buf, c_any5 = [], [], [], []
            for i in range(20, len(navs) - 5):
                r1 = rets[i]
                m_1d = (
                    (regime_1d == "surge_gt_p90" and r1 > p90)
                    or (regime_1d == "drop_lt_p10" and r1 < p10)
                    or (regime_1d == "normal_p10_p90" and p10 <= r1 <= p90)
                )
                if not m_1d:
                    continue
                if require_trend:
                    hist_ma20 = statistics.mean(navs[i - 19:i + 1])
                    hist_gap = (navs[i] / hist_ma20 - 1) * 100
                    hist_zone = "oversold_below_ma20" if hist_gap < -1.5 else ("overbought_above_ma20" if hist_gap > 1.5 else "near_ma20")
                    if hist_zone != trend_zone:
                        continue
                r3_pct = (navs[i + 3] / navs[i] - 1) * 100
                c_up.append(1 if r3_pct > 0 else 0)
                c_non_pos.append(1 if r3_pct <= 0 else 0)
                c_buf.append(1 if r3_pct > -1.5 * sd else 0)
                any_5d_up = any((navs[i + k] / navs[i] - 1) * 100 >= 0.5 for k in range(1, 6))
                c_any5.append(1 if any_5d_up else 0)
            return c_up, c_non_pos, c_buf, c_any5

        c_up, c_non_pos, c_buf, c_any5 = backtest_slice(require_trend=True)
        if len(c_up) < 8:
            c_up, c_non_pos, c_buf, c_any5 = backtest_slice(require_trend=False)

        def rate(lst):
            return round(100 * sum(lst) / len(lst), 1) if lst else None

        fund_signals[code] = {
            "latest_settled_1d_pct": round(last_1d, 2),
            "5d_settled_pct": round((navs[-1] / navs[-6] - 1) * 100, 2) if len(navs) >= 6 else 0.0,
            "20d_settled_pct": round((navs[-1] / navs[-21] - 1) * 100, 2) if len(navs) >= 21 else 0.0,
            "ma20_gap_pct": ma20_gap,
            "trend_zone": trend_zone,
            "regime_on_last_settled": regime_1d,
            "sample_count": len(c_up),
            "cond_3d_at_up_winrate_pct": rate(c_up),
            "cond_3d_at_flat_or_down_winrate_pct": rate(c_non_pos),
            "cond_3d_hold_above_minus_1_5sd_winrate_pct": rate(c_buf),
            "cond_5d_any_plus_0_5pct_winrate_pct": rate(c_any5),
            "event_impact_score": event_scores.get(code),
        }

    return {
        "a_share_turnover": {
            "sh_amount_yi": sh_amt,
            "sz_amount_yi": sz_amt,
            "total_amount_yi": total_turnover_yi,
            "prev_day_total_yi": prev_turnover_yi,
            "ma20_total_yi": ma20_turnover_yi,
            "volume_ratio_vs_ma20": vol_ratio_vs_ma20,
        },
        "sector_thermometer": {
            "ai_cpo_avg_pct": cpo_avg,
            "ai_chip_soft_avg_pct": chip_soft_avg,
            "ai_internal_divergence_pct": round(chip_soft_avg - cpo_avg, 2),
            "pharma_cxo_avg_pct": cxo_avg,
            "pharma_innov_avg_pct": innov_pharma_avg,
            "bond_10y_etf_pct": qt_map.get("511260", {}).get("pct", 0.0),
            "convertible_bond_index_pct": qt_map.get("000832", {}).get("pct", 0.0),
            "us_soxx_pct": us_map.get("SOXX.OQ", {}).get("pct"),
            "us_ixic_pct": us_map.get(".IXIC", {}).get("pct"),
        },
        "ols_valuation_calibration": ols_meta,
        "fund_signals": fund_signals,
    }


def sync_all(full: bool = False):
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)
    cur = conn.cursor()
    now_str = datetime.now().isoformat(timespec="seconds")

    # 1. Fetch Tencent real-time quotes for indices, underlying ETFs, and 12 key heavyweight stocks
    qt_map = {}
    index_summary = []
    stock_etf_summary = []
    try:
        raw_qt = fetch_text(
            "http://qt.gtimg.cn/q=sh000001,sz399001,sh000300,sz399006,sh000688,sh000832,sh510310,sz159819,sh515120,sh511260,sz300308,sz300502,sh688256,sh688041,sh688521,sz002230,sz000977,sh688111,sh603259,sh600276,sh688235,sz300759",
            referer="http://gu.qq.com/",
            encoding="gbk",
        )
        for line in raw_qt.strip().split(";"):
            if "~" not in line:
                continue
            parts = line.split("~")
            name = parts[1]
            code = parts[2]
            close_p = float(parts[3])
            pct = float(parts[32])
            amt_wan = float(parts[37]) if parts[37] else 0.0
            t_date = parts[30][:8]
            t_date_fmt = f"{t_date[:4]}-{t_date[4:6]}-{t_date[6:8]}"
            qt_map[code] = {
                "name": name,
                "trade_date": t_date_fmt,
                "close": close_p,
                "pct": pct,
                "amount_yi": round(amt_wan / 10000, 2),
            }
            if code in ("000001", "399001", "000300", "399006", "000688", "000832"):
                cur.execute(
                    "INSERT OR REPLACE INTO index_history VALUES (?, ?, ?, ?, ?, ?)",
                    (code, name, t_date_fmt, close_p, pct, amt_wan * 10000),
                )
                index_summary.append(qt_map[code])
            else:
                stock_etf_summary.append({"code": code, **qt_map[code]})
    except Exception as e:
        index_summary.append({"error": str(e)})

    # 1b. Fetch overnight US indices & AI/Pharma bellwethers
    us_map = {}
    us_summary = []
    try:
        raw_us = fetch_text(
            "http://qt.gtimg.cn/q=usIXIC,usINX,usDJI,usSOXX,usNVDA,usAMD,usSMCI,usMRVL,usLITE,usLLY",
            referer="http://gu.qq.com/",
            encoding="gbk",
        )
        for line in raw_us.strip().split(";"):
            if "~" not in line:
                continue
            parts = line.split("~")
            name = parts[1]
            sym = parts[2]
            close_p = float(parts[3]) if parts[3] else 0.0
            pct = float(parts[32]) if parts[32] else 0.0
            t_date = str(parts[30])[:10]
            item_us = {"symbol": sym, "name": name, "trade_date": t_date, "close": close_p, "pct": pct}
            us_map[sym] = item_us
            us_summary.append(item_us)
            cur.execute(
                "INSERT OR REPLACE INTO global_market_history VALUES (?, ?, ?, ?, ?, ?)",
                (sym, name, t_date, close_p, pct, now_str),
            )
    except Exception as e:
        us_summary.append({"error": str(e)})

    # 1c. Fetch Eastmoney official corporate announcements for core heavyweight stocks
    latest_announcements = []
    try:
        ann_url = (
            "https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=15&page_index=1"
            "&ann_type=A&stock_list=300308,300502,688256,688041,688521,002230,000977,688111,603259,600276,688235,300759"
        )
        ann_data = fetch_json(ann_url, referer="https://data.eastmoney.com/")
        for item_ann in (ann_data.get("data") or {}).get("list") or []:
            art_code = str(item_ann.get("art_code", ""))
            codes_info = (item_ann.get("codes") or [{}])[0]
            s_code = codes_info.get("stock_code", "")
            s_name = codes_info.get("short_name", "")
            n_date = str(item_ann.get("notice_date", ""))[:10]
            title = item_ann.get("title", "")
            if art_code and title:
                cur.execute(
                    "INSERT OR REPLACE INTO stock_announcements VALUES (?, ?, ?, ?, ?, ?)",
                    (art_code, s_code, s_name, n_date, title, now_str),
                )
                latest_announcements.append({"date": n_date, "code": s_code, "name": s_name, "title": title})
    except Exception as e:
        latest_announcements.append({"error": str(e)})

    # 1d. Fetch Sina 7x24 live macro & market telegraph
    macro_telegraph = []
    try:
        sina_url = "https://zhibo.sina.com.cn/api/zhibo/feed?page=1&page_size=35&zhibo_id=152"
        sina_data = fetch_json(sina_url, referer="https://finance.sina.com.cn/")
        feed_list = (((sina_data.get("result") or {}).get("data") or {}).get("feed") or {}).get("list") or []
        kw_re = re.compile(r"央行|逆回购|财政|人大|国债|美债|美联储|利率|汇率|人民币|A股|沪指|成交额|算力|芯片|半导体|光模块|人工智能|英伟达|创新药|医保|药明|百济|恒瑞|寒武纪|海光|旭创|新易盛")
        for item_f in feed_list:
            nid = str(item_f.get("id", ""))
            ctime = item_f.get("create_time", "")
            rtext = re.sub(r"<[^>]+>", "", item_f.get("rich_text", "")).strip()
            if nid and rtext and kw_re.search(rtext):
                cur.execute(
                    "INSERT OR REPLACE INTO macro_news_archive VALUES (?, ?, ?, ?)",
                    (nid, ctime, rtext[:300], now_str),
                )
                macro_telegraph.append({"time": ctime, "text": rtext[:200]})
    except Exception as e:
        macro_telegraph.append({"error": str(e)})

    # 2. Fetch fund NAV history from Eastmoney（库里不足一年时先补全历史，供波动基准与预测打分使用）
    fund_nav_map = {}
    for item in PORTFOLIO_CONFIG:
        code = item["code"]
        have = cur.execute("SELECT COUNT(*) FROM fund_nav_history WHERE code = ?", (code,)).fetchone()[0]
        if full or have < 300:
            sync_full_history(cur, code)
        url = f"http://api.fund.eastmoney.com/f10/lsjz?fundCode={code}&pageIndex=1&pageSize=20"
        data = fetch_json(url)
        rows = data.get("Data", {}).get("LSJZList", [])
        for r in rows:
            nav_date = r["FSRQ"]
            dwjz = float(r["DWJZ"]) if r.get("DWJZ") else 0.0
            ljjz = float(r["LJJZ"]) if r.get("LJJZ") else dwjz
            pct = float(r["JZZZL"]) if r.get("JZZZL") not in (None, "") else 0.0
            cur.execute(
                "INSERT OR REPLACE INTO fund_nav_history VALUES (?, ?, ?, ?, ?)",
                (code, nav_date, dwjz, ljjz, pct),
            )
        fund_nav_map[code] = {
            d: (dwjz, ljjz, pct)
            for d, dwjz, ljjz, pct in cur.execute(
                "SELECT nav_date, dwjz, ljjz, daily_return_pct FROM fund_nav_history WHERE code = ? ORDER BY nav_date DESC LIMIT 20",
                (code,),
            )
        }
    latest_nav_date = max(max(h) for h in fund_nav_map.values())
    latest_market_date = qt_map.get("000001", {}).get("trade_date", latest_nav_date)

    # 2b. Backfill 250-day daily k-lines for indices, ETFs, heavyweight stocks, and US market
    sync_kline_history(cur, full=full)

    # 3. Compute exact settled holdings + 60-day OLS dynamically calibrated intraday estimation
    est_pct_map, ols_meta = compute_dynamic_ols_est_map(cur, qt_map)

    portfolio_summary = []
    total_principal = 0.0
    total_settled_amount = 0.0
    total_settled_profit = 0.0
    total_est_amount = 0.0
    total_est_profit = 0.0
    total_est_daily_change = 0.0
    latest_nav = {}

    for item in PORTFOLIO_CONFIG:
        code = item["code"]
        history = fund_nav_map.get(code, {})
        sorted_dates = sorted(history.keys(), reverse=True)
        latest_date = sorted_dates[0] if sorted_dates else "N/A"
        prev_date = sorted_dates[1] if len(sorted_dates) > 1 else latest_date
        latest_dwjz, latest_ljjz, latest_pct = history.get(latest_date, (1.0, 1.0, 0.0))
        prev_dwjz = history.get(prev_date, (latest_dwjz, 1.0, 0.0))[0]
        latest_nav[code] = latest_dwjz

        # 回填历史盘中预估与实际收盘净值的误差
        prev_est_row = cur.execute(
            "SELECT est_pct FROM fund_est_tracking WHERE code=? AND trade_date=?",
            (code, latest_date),
        ).fetchone()
        if prev_est_row and prev_est_row[0] is not None:
            err_bps = round((prev_est_row[0] - latest_pct) * 100, 1)
            cur.execute(
                "UPDATE fund_est_tracking SET settled_dwjz=?, settled_pct=?, error_bps=?, updated_at=? WHERE code=? AND trade_date=?",
                (latest_dwjz, latest_pct, err_bps, now_str, code, latest_date),
            )

        lots = [lot for lot in LOTS if lot["code"] == code]
        shares = round(sum(lot["shares"] for lot in lots), 2)
        principal = round(sum(lot["amount"] for lot in lots), 2)
        cost_nav = round(principal / shares, 4) if shares else 0.0
        settled_amount = round(shares * latest_dwjz, 2)
        settled_profit = round(settled_amount - principal, 2)
        settled_return_pct = round((settled_profit / principal) * 100, 2)

        if latest_date < latest_market_date:
            est_pct = est_pct_map.get(code, 0.0)
            est_nav = round(latest_dwjz * (1.0 + est_pct / 100.0), 4)
            est_amount = round(shares * est_nav, 2)
            est_profit = round(est_amount - principal, 2)
            est_return_pct = round((est_profit / principal) * 100, 2)
            est_daily_change = round(est_amount - settled_amount, 2)
            cur.execute(
                "INSERT OR REPLACE INTO fund_est_tracking VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?)",
                (code, latest_market_date, now_str[-8:], est_pct, est_nav, now_str),
            )
        else:
            est_pct = latest_pct
            est_nav = latest_dwjz
            est_amount = settled_amount
            est_profit = settled_profit
            est_return_pct = settled_return_pct
            est_daily_change = round(shares * (latest_dwjz - prev_dwjz), 2)

        cur.execute(
            "INSERT OR REPLACE INTO holdings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                code,
                item["name"],
                item["category"],
                principal,
                shares,
                cost_nav,
                item["realized_profit"],
                item["trigger_rule"],
                now_str,
            ),
        )

        total_principal += principal
        total_settled_amount += settled_amount
        total_settled_profit += settled_profit
        total_est_amount += est_amount
        total_est_profit += est_profit
        total_est_daily_change += est_daily_change

        portfolio_summary.append({
            "code": code,
            "name": item["name"],
            "category": item["category"],
            "principal": principal,
            "shares": shares,
            "cost_nav": cost_nav,
            "settled_date": latest_date,
            "settled_nav": latest_dwjz,
            "settled_amount": settled_amount,
            "settled_profit": settled_profit,
            "settled_return_pct": settled_return_pct,
            "est_date": latest_market_date,
            "est_daily_pct": est_pct,
            "est_nav": est_nav,
            "est_daily_profit": est_daily_change,
            "est_amount": est_amount,
            "est_profit": est_profit,
            "est_return_pct": est_return_pct,
            "trigger_rule": item["trigger_rule"],
        })

    conn.commit()

    redeem_day = next_weekday(date.fromisoformat(latest_nav_date))
    lot_rows = lot_fee_rows(latest_nav, redeem_day)
    fee_calendar = sorted(
        ({"date": r["next_fee_change"]["date"], "code": r["code"], "lot_confirm_date": r["confirm_date"],
          "from_pct": r["fee_pct"], "to_pct": r["next_fee_change"]["fee_pct"]}
         for r in lot_rows if r["next_fee_change"]),
        key=lambda e: e["date"],
    )
    amounts = {h["code"]: h["settled_amount"] for h in portfolio_summary}
    track_record = grade_predictions(conn)
    context = risk_context(cur, amounts)
    signals = compute_forecast_signals(cur, portfolio_summary, qt_map, us_map, ols_meta)
    conn.commit()
    conn.close()

    snapshot = {
        "updated_at": now_str,
        "latest_market_date": latest_market_date,
        "totals": {
            "total_principal": round(total_principal, 2),
            "settled_total_amount": round(total_settled_amount, 2),
            "settled_total_profit": round(total_settled_profit, 2),
            "est_today_profit": round(total_est_daily_change, 2),
            "est_total_amount": round(total_est_amount, 2),
            "est_total_profit": round(total_est_profit, 2),
            "est_total_return_pct": round((total_est_profit / total_principal) * 100, 2),
        },
        "indices": index_summary,
        "etfs_and_heavyweights": stock_etf_summary,
        "overnight_us_market": us_summary,
        "latest_announcements": latest_announcements[:10],
        "macro_telegraph": macro_telegraph[:10],
        "forecast_signals": signals,
        "holdings": portfolio_summary,
        "lots_if_redeemed": {
            "redeem_day": redeem_day.isoformat(),
            "note": "按先进先出逐笔计；持有天数=赎回日-份额确认日，未计节假日，实际费率以支付宝卖出页为准",
            "total_fee_yuan": round(sum(r["fee_yuan"] for r in lot_rows), 2),
            "lots": lot_rows,
        },
        "fee_calendar": fee_calendar,
        "risk_context": context,
        "track_record": track_record,
    }
    SNAPSHOT_JSON_PATH.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(snapshot, ensure_ascii=False, indent=2))


def print_fees(on_date: str = None):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    latest_nav, latest_date = {}, ""
    for code in FUND_CODES:
        d, v = cur.execute(
            "SELECT nav_date, dwjz FROM fund_nav_history WHERE code = ? ORDER BY nav_date DESC LIMIT 1", (code,)
        ).fetchone()
        latest_nav[code] = v
        latest_date = max(latest_date, d)
    conn.close()
    redeem_day = date.fromisoformat(on_date) if on_date else next_weekday(date.fromisoformat(latest_date))
    print(f"假设 {redeem_day} 全部赎回（净值取 {latest_date}，先进先出逐笔计，以支付宝卖出页为准）")
    total = 0.0
    for r in lot_fee_rows(latest_nav, redeem_day):
        nxt = r["next_fee_change"]
        nxt_text = f"{nxt['date']} 起 {nxt['fee_pct']}%" if nxt else "—"
        total += r["fee_yuan"]
        print(f"{r['code']} 确认{r['confirm_date']} {r['shares']:>9.2f}份 {r['value']:>9.2f}元 "
              f"持有{r['days_held']:>3}天 费率{r['fee_pct']:.2f}% 费用{r['fee_yuan']:>6.2f}元 下次变化：{nxt_text}")
    print(f"合计赎回费 {total:.2f} 元")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="持仓同步 / 预测打分 / 措辞检查")
    sub = parser.add_subparsers(dest="cmd")
    p_sync = sub.add_parser("sync", help="同步行情与净值，生成 portfolio_latest.json（默认命令）")
    p_sync.add_argument("--full", action="store_true", help="重新拉取全部历史净值")
    sub.add_parser("grade", help="按收盘数据给 predictions.json 打分，生成 prediction_scorecard.md")
    p_lint = sub.add_parser("lint", help="检查报告里的确定性/夸张措辞")
    p_lint.add_argument("file")
    p_lint.add_argument("--section", help="只检查包含该文字的标题下的这一节")
    p_fees = sub.add_parser("fees", help="逐笔赎回费与费率变化日")
    p_fees.add_argument("--date", help="假设的赎回日 YYYY-MM-DD")
    args = parser.parse_args()

    if args.cmd in (None, "sync"):
        sync_all(full=getattr(args, "full", False))
    elif args.cmd == "grade":
        conn = sqlite3.connect(DB_PATH)
        init_db(conn)
        summary = grade_predictions(conn)
        conn.close()
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        print(f"记分卡已写入 {SCORECARD_PATH.name}")
    elif args.cmd == "lint":
        sys.exit(lint_text(Path(args.file), args.section))
    elif args.cmd == "fees":
        print_fees(args.date)


if __name__ == "__main__":
    main()
