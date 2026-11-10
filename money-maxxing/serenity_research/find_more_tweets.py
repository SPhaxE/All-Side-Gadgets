import urllib.request
import urllib.parse
import json
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

queries = [
    "site:x.com/aleabitoreddit InP substrate",
    "site:x.com/aleabitoreddit optical CW laser",
    "site:x.com/aleabitoreddit CoWoS packaging TSMC",
    "site:x.com/aleabitoreddit PCB copper CCL",
    "site:x.com/aleabitoreddit TPU BOM"
]

all_found = {}

for q in queries:
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(q)}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            html = resp.read().decode('utf-8')
            results = re.findall(r'<a class="result__url"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?<a class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)
            print(f"Query '{q}': found {len(results)} results")
            for r in results:
                raw_url, title, snippet = r
                clean_snippet = re.sub(r'<[^>]+>', '', snippet).strip()
                # extract status id
                m = re.search(r'status%2F(\d+)', raw_url)
                if m:
                    sid = m.group(1)
                    if sid not in all_found:
                        all_found[sid] = {
                            "sid": sid,
                            "url": f"https://x.com/aleabitoreddit/status/{sid}",
                            "snippet": clean_snippet
                        }
                        print(f"  [New ID {sid}]: {clean_snippet[:120]}...")
    except Exception as e:
        print(f"Error for {q}: {e}")

print(f"\nTotal unique status IDs found: {len(all_found)}")
with open("serenity_additional_sids.json", "w", encoding="utf-8") as f:
    json.dump(all_found, f, indent=2, ensure_ascii=False)
