#!/usr/bin/env python3
"""macOS ChatGPT 桌面端启动前网络与分流安全核验脚本。"""

import http.client
import json
import os
import re
import socket
import subprocess
import sys
import urllib.parse

UNSUPPORTED_LOCS = {"CN", "HK", "MO", "RU", "BY", "IR", "KP", "SY", "CU", "VE"}
BLOCKED_NODE_RE = re.compile(
    r"(中国|香港|澳门|俄罗斯|白俄罗斯|伊朗|朝鲜|叙利亚|古巴|委内瑞拉|\bCN\b|\bHK\b|\bMO\b|\bRU\b|\bBY\b|\bIR\b|\bKP\b|\bSY\b|\bCU\b|\bVE\b|DIRECT|REJECT)",
    re.IGNORECASE,
)


def load_env_config() -> dict:
    cfg = {}
    env_file = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "local.env")
    )
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    for key in (
        "CHATGPT_ALLOWED_LOCS",
        "CHATGPT_EXPECTED_IP",
        "CHATGPT_REQUIRE_TUN",
        "CHATGPT_ALLOW_IPV6",
        "CHATGPT_PROXY_URL",
        "CHATGPT_MIHOMO_SOCKET",
        "CHATGPT_MIHOMO_API",
        "CHATGPT_MIHOMO_SECRET",
    ):
        if key in os.environ and os.environ[key].strip():
            cfg[key] = os.environ[key].strip()
    return cfg


def is_clash_running() -> bool:
    try:
        res = subprocess.run(
            ["pgrep", "-if", "verge-mihomo|Clash Verge"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        return res.returncode == 0
    except FileNotFoundError:
        return False


def unix_socket_get(sock_path: str, path: str, secret: str = "") -> dict:
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(3.0)
    sock.connect(sock_path)
    try:
        headers = f"GET {path} HTTP/1.0\r\nHost: localhost\r\n"
        if secret:
            headers += f"Authorization: Bearer {secret}\r\n"
        headers += "\r\n"
        sock.sendall(headers.encode("ascii"))
        chunks = []
        while True:
            data = sock.recv(65536)
            if not data:
                break
            chunks.append(data)
        raw = b"".join(chunks).decode("utf-8", errors="replace")
        body = raw.partition("\r\n\r\n")[2]
        return json.loads(body)
    finally:
        sock.close()


def http_api_get(base_url: str, path: str, secret: str = "") -> dict:
    parsed = urllib.parse.urlparse(base_url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    conn_cls = (
        http.client.HTTPSConnection
        if parsed.scheme == "https"
        else http.client.HTTPConnection
    )
    conn = conn_cls(host, port, timeout=3.0)
    try:
        headers = {}
        if secret:
            headers["Authorization"] = f"Bearer {secret}"
        conn.request("GET", path, headers=headers)
        resp = conn.getresponse()
        body = resp.read().decode("utf-8", errors="replace")
        if resp.status >= 400:
            raise RuntimeError(f"Mihomo API HTTP {resp.status}: {body[:200]}")
        return json.loads(body)
    finally:
        conn.close()


def query_mihomo(cfg: dict) -> tuple[dict, dict, str]:
    secret = cfg.get("CHATGPT_MIHOMO_SECRET", "")
    sock_candidates = [
        cfg.get("CHATGPT_MIHOMO_SOCKET", ""),
        "/tmp/verge/verge-mihomo.sock",
    ]
    for sp in sock_candidates:
        if sp and os.path.exists(sp):
            c = unix_socket_get(sp, "/configs", secret)
            p = unix_socket_get(sp, "/proxies", secret).get("proxies", {})
            return c, p, f"unix:{sp}"

    api_url = cfg.get("CHATGPT_MIHOMO_API", "")
    if api_url:
        c = http_api_get(api_url, "/configs", secret)
        p = http_api_get(api_url, "/proxies", secret).get("proxies", {})
        return c, p, api_url

    return {}, {}, ""


def resolve_proxy_chain(proxies: dict, start_group: str) -> list[str]:
    chain = []
    cur = start_group
    seen = set()
    while cur and cur not in seen:
        seen.add(cur)
        info = proxies.get(cur)
        if not isinstance(info, dict):
            break
        nxt = info.get("now")
        if not nxt:
            break
        chain.append(nxt)
        cur = nxt
    return chain


def fetch_cf_trace(url: str, proxy_url: str = "") -> dict:
    cmd = ["curl", "-fsS", "--max-time", "10", "-A", "Mozilla/5.0"]
    if proxy_url:
        cmd.extend(["-x", proxy_url])
    cmd.append(url)
    res = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if res.returncode != 0 or not res.stdout:
        err = res.stderr.strip() or f"curl exit {res.returncode}"
        raise RuntimeError(err)
    kv = {}
    for line in res.stdout.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            kv[k.strip()] = v.strip()
    return kv


def check_stale_proxy_env() -> list[str]:
    warnings = []
    codex_env = os.path.expanduser("~/.codex/.env")
    if os.path.exists(codex_env):
        try:
            with open(codex_env, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            if re.search(r"(?im)^(HTTP_PROXY|HTTPS_PROXY|ALL_PROXY)=", content):
                warnings.append(
                    f"检测到 {codex_env} 中存在代理环境变量，若端口失效会导致 Codex / ChatGPT 桌面端异常。"
                )
        except OSError:
            pass

    if sys.platform == "darwin":
        for var in ("HTTPS_PROXY", "ALL_PROXY"):
            res = subprocess.run(
                ["launchctl", "getenv", var],
                capture_output=True,
                text=True,
                check=False,
            )
            val = res.stdout.strip()
            if val:
                warnings.append(
                    f"launchctl 全局环境变量 {var}={val} 已设置，请确认端口与 Clash Verge 一致（TUN 模式下建议清空）。"
                )
    return warnings


def main() -> int:
    cfg = load_env_config()
    allowed_locs = [
        loc.strip().upper()
        for loc in cfg.get("CHATGPT_ALLOWED_LOCS", "US").split(",")
        if loc.strip()
    ]
    expected_ip = cfg.get("CHATGPT_EXPECTED_IP", "")
    if expected_ip == "REPLACE_WITH_EXPECTED_IP":
        expected_ip = ""

    proxy_url = cfg.get("CHATGPT_PROXY_URL", "")
    require_tun = cfg.get("CHATGPT_REQUIRE_TUN", "1") != "0"
    allow_ipv6 = cfg.get("CHATGPT_ALLOW_IPV6", "0") == "1"

    if not is_clash_running():
        print(
            "[BLOCKED] 未检测到 Clash Verge 或 Mihomo 内核运行，已禁止启动 ChatGPT。",
            file=sys.stderr,
        )
        return 2

    errors = []
    warnings = check_stale_proxy_env()

    mihomo_source = "未连接（未找到 /tmp/verge/verge-mihomo.sock）"
    mode = "unknown"
    tun_on = None
    ipv6_on = None
    chatgpt_chain = []
    ai_now = None
    gemini_now = None
    default_now = None

    try:
        m_cfg, m_proxies, src = query_mihomo(cfg)
        if src:
            mihomo_source = src
            mode = str(m_cfg.get("mode", "")).lower()
            tun_on = bool(m_cfg.get("tun", {}).get("enable"))
            ipv6_on = bool(m_cfg.get("ipv6"))

            if mode != "rule":
                errors.append(f"Clash 当前模式为 '{mode}'，必须切回 'rule'（规则模式）")
            if require_tun and not tun_on:
                errors.append(
                    "Mihomo 内核实际 tun.enable=false（macOS 原生 ChatGPT.app 不完全遵循系统代理，请开启 TUN 模式；若界面显示已开但实际关闭，请先关闭再重开 TUN）"
                )
            if not allow_ipv6 and ipv6_on:
                errors.append("Mihomo IPv6 未关闭（ipv6=true），存在真实 IPv6 或地区泄漏风险")

            chatgpt_chain = resolve_proxy_chain(m_proxies, "💬 ChatGPT")
            ai_now = m_proxies.get("AI", {}).get("now")
            gemini_now = m_proxies.get("🤖 国际AI", {}).get("now")
            default_now = m_proxies.get("默认节点", {}).get("now")

            if not chatgpt_chain:
                errors.append(
                    "未找到 '💬 ChatGPT' 策略组或未选中有效节点（请先在 Clash Verge 订阅扩展脚本中应用四路分流模板）"
                )
            else:
                leaf = chatgpt_chain[-1]
                if BLOCKED_NODE_RE.search(leaf):
                    errors.append(
                        f"'💬 ChatGPT' 当前最终落地为高风险/禁用地区或直连节点: '{leaf}'"
                    )
        else:
            warnings.append(
                "未能读取 Mihomo 控制接口，跳过策略组与 TUN 状态核验（可通过 CHATGPT_MIHOMO_API 指定）。"
            )
    except Exception as e:
        warnings.append(f"读取 Mihomo 控制接口异常（{e}），将依赖实测出口核验。")

    # 实测 chatgpt.com 与 auth.openai.com 出口一致性
    chat_ip = chat_loc = None
    auth_ip = auth_loc = None
    try:
        kv_chat = fetch_cf_trace("https://chatgpt.com/cdn-cgi/trace", proxy_url)
        chat_ip = kv_chat.get("ip")
        chat_loc = (kv_chat.get("loc") or "").upper()
    except Exception as e:
        errors.append(f"探测 https://chatgpt.com/cdn-cgi/trace 失败：{e}")

    try:
        kv_auth = fetch_cf_trace("https://auth.openai.com/cdn-cgi/trace", proxy_url)
        auth_ip = kv_auth.get("ip")
        auth_loc = (kv_auth.get("loc") or "").upper()
    except Exception as e:
        errors.append(f"探测 https://auth.openai.com/cdn-cgi/trace 失败：{e}")

    for label, ip_val, loc_val in (
        ("chatgpt.com", chat_ip, chat_loc),
        ("auth.openai.com", auth_ip, auth_loc),
    ):
        if not loc_val:
            continue
        if loc_val in UNSUPPORTED_LOCS:
            errors.append(
                f"{label} 实测地区为 '{loc_val}'（OpenAI 不支持地区，极易触发封号/风控）"
            )
        elif allowed_locs and loc_val not in allowed_locs:
            errors.append(
                f"{label} 实测地区为 '{loc_val}'，不在允许列表 {allowed_locs} 中"
            )
        if expected_ip and ip_val != expected_ip:
            errors.append(
                f"{label} 实测出口 IP 为 '{ip_val}'（非预期 '{expected_ip}'）"
            )

    if chat_ip and auth_ip and chat_ip != auth_ip:
        errors.append(
            f"chatgpt.com ({chat_ip}/{chat_loc}) 与 auth.openai.com ({auth_ip}/{auth_loc}) 出口不一致，会导致 Cloudflare 验证死循环或风控！"
        )

    print("=== ChatGPT (macOS) 启动前环境安检 ===")
    print(f"  Mihomo 控制源  : {mihomo_source}")
    print(f"  模式/TUN/IPv6  : mode={mode}, tun={tun_on}, ipv6={ipv6_on}")
    print(
        f"  💬 ChatGPT     : {' -> '.join(chatgpt_chain) if chatgpt_chain else '未配置/未读到'}"
    )
    print(f"  AI (Claude)    : {ai_now}")
    print(f"  🤖 国际AI      : {gemini_now}")
    print(f"  默认节点       : {default_now}")
    print(f"  chatgpt.com    : ip={chat_ip}, loc={chat_loc}")
    print(f"  auth.openai.com: ip={auth_ip}, loc={auth_loc}")
    print(
        f"  校验策略       : 允许地区={','.join(allowed_locs)}"
        + (f", 固定IP={expected_ip}" if expected_ip else ", 未锁死固定IP")
    )

    for w in warnings:
        print(f"  [WARN] {w}")

    if errors:
        print("\n[BLOCKED] 安检未通过，已禁止启动 ChatGPT：", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 2

    print("\n[PASS] 网络与四路分流环境全部正常。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
