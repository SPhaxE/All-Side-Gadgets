import urllib.request
import urllib.parse
import json
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

status_ids = [
    "2065289672356745561",
    "2063465386960736396",
    "2025112091967811613",
    "2030982945264333141",
    "2064265545529307560",
    "2033002597955903862"
]

for sid in status_ids:
    url = f"https://r.jina.ai/https://x.com/aleabitoreddit/status/{sid}"
    print(f"\n==================== Fetching Status {sid} ====================")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            content = resp.read().decode('utf-8')
            with open(f"tweet_{sid}.txt", "w", encoding="utf-8") as f:
                f.write(content)
            print(content[:1200])
    except Exception as e:
        print("Error:", e)
