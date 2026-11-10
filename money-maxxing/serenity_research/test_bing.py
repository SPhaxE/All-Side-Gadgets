import urllib.request
import urllib.parse
import json
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

query = "aleabitoreddit substrate laser"
url = f"https://www.bing.com/search?q={urllib.parse.quote(query)}"

req = urllib.request.Request(
    url,
    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
)

try:
    with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        print(f"Bing fetched: {len(html)} bytes")
        # find x.com/aleabitoreddit/status
        matches = re.findall(r'https?://(?:x|twitter)\.com/aleabitoreddit/status/(\d+)', html)
        print("Matches:", set(matches))
        # find snippets
        snippets = re.findall(r'<p class="b_lineclamp[^>]*>(.*?)</p>', html)
        for s in snippets[:5]:
            print("Snippet:", re.sub(r'<[^>]+>', '', s))
except Exception as e:
    print("Bing error:", e)
