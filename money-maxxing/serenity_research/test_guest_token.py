import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

bearer = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"

try:
    req = urllib.request.Request(
        "https://api.twitter.com/1.1/guest/activate.json",
        data=b"",
        headers={
            "Authorization": bearer,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    )
    with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print("Guest token response:", res)
        guest_token = res.get("guest_token")
except Exception as e:
    print("Guest token error:", e)
