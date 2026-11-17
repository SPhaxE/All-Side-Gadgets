#!/usr/bin/env python3
"""跨平台美区 IP 纯净度与代理出口体检工具（支持 macOS 与 Windows）。"""

import argparse
import json
import os
import platform
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request


def default_mihomo_exe() -> str:
    sys_name = platform.system()
    if sys_name == "Windows":
        return r"C:\Program Files\Clash Verge\verge-mihomo-alpha.exe"
    if sys_name == "Darwin":
        for p in (
            "/Applications/Clash Verge.app/Contents/MacOS/verge-mihomo-alpha",
            "/Applications/Clash Verge.app/Contents/MacOS/verge-mihomo",
        ):
            if os.path.exists(p):
                return p
    return shutil.which("mihomo") or ""


def check_ip_reputation(ip: str) -> dict:
    report = {"ip": ip}

    try:
        report["rdns"] = socket.gethostbyaddr(ip)[0]
    except Exception as e:
        report["rdns"] = f"NONE ({e})"

    try:
        url = (
            f"http://ip-api.com/json/{ip}"
            "?fields=status,countryCode,regionName,city,isp,org,as,hosting,proxy,mobile,query"
        )
        with urllib.request.urlopen(url, timeout=8) as r:
            report["ip_api"] = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        report["ip_api_error"] = str(e)

    try:
        req = urllib.request.Request(
            f"https://ipinfo.io/{ip}/json", headers={"User-Agent": "curl/8.0"}
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            report["ipinfo"] = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        report["ipinfo_error"] = str(e)

    for base in (
        f"https://rdap.arin.net/registry/ip/{ip}",
        f"https://rdap.db.ripe.net/ip/{ip}",
    ):
        try:
            req = urllib.request.Request(base, headers={"User-Agent": "curl/8.0"})
            with urllib.request.urlopen(req, timeout=8) as r:
                final_url = r.geturl()
                d = json.loads(r.read().decode("utf-8"))
            report["rdap"] = {
                "source": final_url,
                "handle": d.get("handle"),
                "name": d.get("name"),
                "country": d.get("country"),
                "type": d.get("type"),
            }
            break
        except Exception:
            continue

    return report


def probe_proxy_exit(
    mihomo_exe: str,
    proxy_type: str,
    server: str,
    port: int,
    username: str = "",
    password: str = "",
    uuid: str = "",
    public_key: str = "",
    short_id: str = "",
    servername: str = "www.apple.com",
    interface_name: str = "",
) -> str:
    if not mihomo_exe or not os.path.exists(mihomo_exe):
        raise FileNotFoundError(f"未找到 Mihomo 内核: {mihomo_exe}")

    scratch = tempfile.mkdtemp(prefix="mihomo_probe_")
    listen_port = 28991

    if proxy_type in ("socks5", "http"):
        auth = ""
        if username:
            auth += f"\n    username: {json.dumps(username)}"
        if password:
            auth += f"\n    password: {json.dumps(password)}"
        proxy_yaml = f"""
  - name: "TARGET"
    type: {proxy_type}
    server: {server}
    port: {port}
    udp: true{auth}"""
    elif proxy_type == "vless":
        proxy_yaml = f"""
  - name: "TARGET"
    type: vless
    server: {server}
    port: {port}
    uuid: {uuid}
    tls: true
    udp: true
    flow: xtls-rprx-vision
    servername: {servername}
    client-fingerprint: chrome
    skip-cert-verify: false
    reality-opts:
      public-key: {public_key}
      short-id: {short_id}"""
    else:
        raise ValueError(f"不支持的类型: {proxy_type}")

    iface_line = f"\ninterface-name: {interface_name}" if interface_name else ""
    cfg = f"""
mode: rule
log-level: warning
ipv6: false{iface_line}
proxies:{proxy_yaml}
listeners:
  - name: probe
    type: http
    port: {listen_port}
    listen: 127.0.0.1
    proxy: TARGET
rules:
  - MATCH,DIRECT
"""
    cfg_path = os.path.join(scratch, "config.yaml")
    with open(cfg_path, "w", encoding="utf-8") as f:
        f.write(cfg)

    proc = subprocess.Popen(
        [mihomo_exe, "-d", scratch, "-f", cfg_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    try:
        time.sleep(2.0)
        opener = urllib.request.build_opener(
            urllib.request.ProxyHandler(
                {
                    "http": f"http://127.0.0.1:{listen_port}",
                    "https": f"http://127.0.0.1:{listen_port}",
                }
            )
        )
        with opener.open("http://ip-api.com/json/?fields=query", timeout=10) as r:
            return json.loads(r.read().decode("utf-8"))["query"]
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except Exception:
            proc.kill()
        shutil.rmtree(scratch, ignore_errors=True)


def print_verdict(report: dict):
    print(json.dumps(report, ensure_ascii=False, indent=2))
    ip_api = report.get("ip_api", {})
    flags = []
    if ip_api.get("countryCode") != "US":
        flags.append(f"非美国IP ({ip_api.get('countryCode')})")
    if ip_api.get("proxy"):
        flags.append("ip-api 已标 proxy=True（高风险）")
    if ip_api.get("hosting"):
        flags.append("ip-api 标 hosting=True（机房属性，注意独享与洁净度）")
    if str(report.get("rdns", "")).startswith("NONE"):
        flags.append("无 rDNS/PTR 反向解析")
    rdap = report.get("rdap", {})
    if rdap.get("country") not in (None, "US"):
        flags.append(
            f"疑似跨洲广播段：RDAP 注册国家为 {rdap.get('country')} ({rdap.get('name')})"
        )

    print("\n=== 体检结论 ===")
    if not flags:
        print("PASS: 未见明显代理/跨洲广播标记，建议再核查 Scamalytics/ipapi.is 后使用。")
    else:
        for f in flags:
            print(f"WARN: {f}")


def main():
    parser = argparse.ArgumentParser(description="跨平台美区落地 IP 纯净度体检工具")
    parser.add_argument("--ip", help="直接体检指定 IP（无需启动代理）")
    parser.add_argument("--type", choices=["socks5", "http", "vless"], help="通过代理探测真实出口 IP")
    parser.add_argument("--server", help="代理服务器 IP/域名")
    parser.add_argument("--port", type=int, help="代理端口")
    parser.add_argument("--user", default="", help="SOCKS5/HTTP 用户名")
    parser.add_argument("--password", default="", help="SOCKS5/HTTP 密码")
    parser.add_argument("--uuid", default="", help="VLESS UUID")
    parser.add_argument("--pubkey", default="", help="Reality public-key")
    parser.add_argument("--shortid", default="", help="Reality short-id")
    parser.add_argument("--mihomo", default="", help="指定 mihomo 可执行文件路径")
    parser.add_argument("--iface", default="", help="可选：绑定出站网卡名")
    args = parser.parse_args()

    if args.ip:
        print_verdict(check_ip_reputation(args.ip))
        return

    if args.type and args.server and args.port:
        exe = args.mihomo or default_mihomo_exe()
        exit_ip = probe_proxy_exit(
            mihomo_exe=exe,
            proxy_type=args.type,
            server=args.server,
            port=args.port,
            username=args.user,
            password=args.password,
            uuid=args.uuid,
            public_key=args.pubkey,
            short_id=args.shortid,
            interface_name=args.iface,
        )
        print(f"探测到真实出口 IP: {exit_ip}\n")
        print_verdict(check_ip_reputation(exit_ip))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
