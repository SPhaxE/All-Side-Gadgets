import urllib.request
import urllib.parse
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

queries = [
    "site:x.com/aleabitoreddit optical laser",
    "site:x.com/aleabitoreddit CoWoS packaging",
    "site:x.com/aleabitoreddit supply chain",
    "site:x.com/aleabitoreddit Neocloud",
    "\"aleabitoreddit\" \"supply chain\""
]

for q in queries:
    url = f"https://s.jina.ai/{urllib.parse.quote(q)}"
    print(f"\n--- Searching: {url} ---")
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0"
        })
        with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
            content = resp.read().decode('utf-8')
            print(f"Length: {len(content)}")
            # save to file
            safe_name = q.replace(":", "_").replace("/", "_").replace("\"", "").replace(" ", "_")
            with open(f"jina_search_{safe_name}.txt", "w", encoding="utf-8") as f:
                f.write(content)
            print(content[:1000])
    except Exception as e:
        print("Error:", e)
