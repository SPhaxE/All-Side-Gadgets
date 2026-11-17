#!/usr/bin/env python3
"""Windows Claude 启动前网络环境硬核验脚本（自动发现本机 Clash Verge Mihomo 管道）。"""

import ctypes
import http.client
import json
import os
import sys


def load_expected_ip() -> str:
    ip = os.environ.get("CLAUDE_EXPECTED_IP", "").strip()
    if ip and ip != "REPLACE_WITH_US_IP":
        return ip
    env_file = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "local.env")
    )
    if os.path.exists(env_file):
        for line in open(env_file, "r", encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == "CLAUDE_EXPECTED_IP":
                v = v.strip().strip('"').strip("'")
                if v and v != "REPLACE_WITH_US_IP":
                    return v
    return ""


def find_mihomo_pipe() -> str:
    try:
        pipes = os.listdir(r"\\.\pipe\\")
    except Exception:
        return ""
    for prefix in ("verge-mihomo-production-", "verge-mihomo-sidecar-"):
        for name in pipes:
            if name.startswith(prefix):
                return rf"\\.\pipe\{name}"
    return ""


def pipe_get(pipe_name: str, path: str, secret: str = "set-your-secret") -> dict:
    GENERIC_READ = 0x80000000
    GENERIC_WRITE = 0x40000000
    OPEN_EXISTING = 3
    k32 = ctypes.windll.kernel32
    h = k32.CreateFileW(
        pipe_name, GENERIC_READ | GENERIC_WRITE, 0, None, OPEN_EXISTING, 0, None
    )
    if h in (-1, 0xFFFFFFFFFFFFFFFF):
        raise RuntimeError(f"无法连接 Mihomo 管道: {pipe_name}")
    try:
        req = (
            f"GET {path} HTTP/1.0\r\nHost: localhost\r\n"
            f"Authorization: Bearer {secret}\r\n\r\n"
        ).encode("ascii")
        w = ctypes.c_ulong(0)
        k32.WriteFile(h, req, len(req), ctypes.byref(w), None)
        chunks = []
        buf = ctypes.create_string_buffer(65536)
        rb = ctypes.c_ulong(0)
        while k32.ReadFile(h, buf, 65536, ctypes.byref(rb), None) and rb.value > 0:
            chunks.append(buf.raw[: rb.value])
        body = b"".join(chunks).decode("utf-8", errors="replace").partition("\r\n\r\n")[2]
        return json.loads(body)
    finally:
        k32.CloseHandle(h)


def main() -> int:
    errors = []
    expected_ip = load_expected_ip()
    pipe_name = find_mihomo_pipe()

    if not pipe_name:
        print("[FAIL] 未检测到运行中的 Clash Verge Mihomo 管道，请先启动 Clash Verge。")
        return 1

    try:
        cfg = pipe_get(pipe_name, "/configs")
        proxies = pipe_get(pipe_name, "/proxies").get("proxies", {})
    except Exception as e:
        print(f"[FAIL] {e}")
        return 1

    mode = str(cfg.get("mode", "")).lower()
    tun_on = bool(cfg.get("tun", {}).get("enable"))
    ipv6 = bool(cfg.get("ipv6"))

    if mode != "rule":
        errors.append(f"当前运行模式为 '{mode}'，必须为 'rule'")
    if not tun_on:
        errors.append("TUN 模式未开启，桌面客户端流量可能绕过分流")
    if ipv6:
        errors.append("IPv6 未关闭，存在泄漏风险")

    ai_now = proxies.get("AI", {}).get("now")
    relay_now = proxies.get("⚡ 中转前置", {}).get("now")
    gemini_now = proxies.get("🤖 国际AI", {}).get("now")
    default_now = proxies.get("默认节点", {}).get("now")

    if ai_now != "🎯 独享美区落地":
        errors.append(f"AI 策略组当前为 '{ai_now}'，应为 '🎯 独享美区落地'")
    if not relay_now:
        errors.append("未找到 '⚡ 中转前置' 策略组或未选定节点")

    trace_ip = None
    trace_loc = None
    try:
        conn = http.client.HTTPSConnection("claude.ai", timeout=10)
        conn.request("GET", "/cdn-cgi/trace", headers={"User-Agent": "Mozilla/5.0"})
        body = conn.getresponse().read().decode("utf-8", errors="replace")
        conn.close()
        kv = dict(line.split("=", 1) for line in body.splitlines() if "=" in line)
        trace_ip = kv.get("ip")
        trace_loc = kv.get("loc")
        if expected_ip and trace_ip != expected_ip:
            errors.append(
                f"claude.ai 实测出口 IP 为 {trace_ip}（非预期 {expected_ip}）"
            )
        if trace_loc != "US":
            errors.append(f"claude.ai 实测地区为 {trace_loc}（非 US）")
    except Exception as e:
        errors.append(f"探测 claude.ai 失败：{e}")

    print("=== Claude (Windows) 启动前环境安检 ===")
    print(f"  模式/TUN/IPv6 : mode={mode}, tun={tun_on}, ipv6={ipv6}")
    print(f"  AI (Claude)   : {ai_now} (前置: {relay_now})")
    print(f"  🤖 国际AI     : {gemini_now}")
    print(f"  默认节点      : {default_now}")
    print(f"  claude.ai实测 : ip={trace_ip}, loc={trace_loc}")
    if not expected_ip:
        print("  [提示] 未配置 local.env 中的 CLAUDE_EXPECTED_IP，当前仅校验证书地区为 US。")

    if errors:
        print("\n[BLOCKED] 安检未通过，已禁止启动 Claude：")
        for err in errors:
            print(f"  - {err}")
        return 2

    print("\n[PASS] 网络与分流环境全部正常。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
