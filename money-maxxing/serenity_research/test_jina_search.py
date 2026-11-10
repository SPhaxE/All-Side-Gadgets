import urllib.request
import urllib.parse
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Let's test jina search: https://s.jina.ai/site:x.com/aleabitoreddit
queries = [
    "https://s.jina.ai/site:x.com/aleabitoreddit optical laser",
    "https://s.jina.ai/site:x.com/aleabitoreddit CoWoS packaging",
    "https://s.jina.ai/site:x.com/aleabitoreddit supply chain choke points",
    "https://s.jina.ai/site:x.com/aleabitoreddit PCB copper CCL"
]

for q in queries:
    print(f"\n--- Searching: {q} ---")
    try:
        req = urllib.request.Request(q, headers={
            "User-Agent": "Mozilla/5.0"
        })
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            content = resp.read().decode('utf-8')
            print(f"Length: {len(content)}")
            print(content[:1500])
    except Exception as e:
        print("Error:", e)
