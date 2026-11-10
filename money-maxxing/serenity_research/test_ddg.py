import urllib.request
import urllib.parse
import json
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

query = "site:x.com/aleabitoreddit"
url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"

req = urllib.request.Request(
    url,
    headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
)

try:
    with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
        html = resp.read().decode('utf-8')
        print("Fetched DuckDuckGo html, length:", len(html))
        # Find links and snippets
        # DDG results have class="result__url" and class="result__snippet"
        results = re.findall(r'<a class="result__url"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?<a class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)
        print("Found results:", len(results))
        for r in results[:10]:
            raw_url, title, snippet = r
            clean_snippet = re.sub(r'<[^>]+>', '', snippet).strip()
            print("---")
            print("URL:", raw_url)
            print("Snippet:", clean_snippet)
except Exception as e:
    print("DDG Error:", e)
