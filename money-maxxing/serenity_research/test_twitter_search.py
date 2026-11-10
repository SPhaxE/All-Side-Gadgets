import urllib.request
import urllib.parse
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

bearer = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"

req = urllib.request.Request(
    "https://api.twitter.com/1.1/guest/activate.json",
    data=b"",
    headers={"Authorization": bearer, "User-Agent": "Mozilla/5.0"}
)
with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
    guest_token = json.loads(resp.read().decode('utf-8'))["guest_token"]

# test endpoints
endpoints = [
    f"https://api.twitter.com/1.1/search/tweets.json?q=from%3Aaleabitoreddit&count=50",
    f"https://twitter.com/i/api/2/search/adaptive.json?q=from%3Aaleabitoreddit&count=50",
    f"https://api.twitter.com/2/search/adaptive.json?q=from%3Aaleabitoreddit&count=50"
]

for ep in endpoints:
    print(f"\nTesting: {ep}")
    req_s = urllib.request.Request(
        ep,
        headers={
            "Authorization": bearer,
            "x-guest-token": guest_token,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
    )
    try:
        with urllib.request.urlopen(req_s, timeout=10, context=ctx) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print("SUCCESS! Keys:", list(data.keys()))
            with open("search_results.json", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            break
    except Exception as e:
        print("Failed:", e)
