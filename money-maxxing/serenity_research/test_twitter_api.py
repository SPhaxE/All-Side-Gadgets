import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

bearer = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"

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
    guest_token = res.get("guest_token")

print("Acquired Guest Token:", guest_token)

# Test UserByScreenName
features = {
    "hidden_profile_likes_enabled": True,
    "hidden_profile_subscriptions_enabled": True,
    "responsive_web_graphql_exclude_directive_enabled": True,
    "verified_phone_label_enabled": False,
    "subscriptions_verification_info_is_identity_verified_enabled": True,
    "subscriptions_verification_info_verified_since_enabled": True,
    "highlights_tweets_tab_ui_enabled": True,
    "responsive_web_twitter_article_notes_tab_enabled": True,
    "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "responsive_web_graphql_timeline_navigation_enabled": True
}

params = {
    "variables": json.dumps({"screen_name": "aleabitoreddit", "withSafetyModeUserFields": True}),
    "features": json.dumps(features)
}

import urllib.parse
query_str = urllib.parse.urlencode(params)

# Common endpoint for UserByScreenName
url = f"https://twitter.com/i/api/graphql/sLVLhk0bGj3MVFEKTdax1w/UserByScreenName?{query_str}"

req_user = urllib.request.Request(
    url,
    headers={
        "Authorization": bearer,
        "x-guest-token": guest_token,
        "x-twitter-active-user": "yes",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
)

try:
    with urllib.request.urlopen(req_user, timeout=10, context=ctx) as resp:
        user_data = json.loads(resp.read().decode('utf-8'))
        print("User data fetched successfully!")
        print(json.dumps(user_data, indent=2)[:1000])
except Exception as e:
    print("User fetch error:", e)
