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

# Let's test several UserTweets query IDs
query_ids = [
    "E3opETHurVhQhflRiOxOOg",
    "WzIR1IRygEQVuQvqlGstcg",
    "V7H0Ap3_Hh2FyS75OCDO3Q",
    "Q6aDgCncrISLTr4-5kMF_A",
    "35tV0noMmupzbLY4tB_lBe",
    "HuTx74BxAIF5Q_2lpXiUiA",
    "28pBvA1A1mRfgVp7y4pB9Q"
]

features = {
    "responsive_web_graphql_exclude_directive_enabled": True,
    "verified_phone_label_enabled": False,
    "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_timeline_navigation_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "c9s_tweet_anatomy_moderator_badge_enabled": True,
    "tweetypie_unmention_optimization_enabled": True,
    "responsive_web_edit_tweet_api_enabled": True,
    "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
    "view_counts_everywhere_api_enabled": True,
    "longform_notetweets_consumption_enabled": True,
    "responsive_web_twitter_article_tweet_consumption_enabled": True,
    "tweet_awards_web_tipping_enabled": False,
    "freedom_of_speech_not_reach_fetch_enabled": True,
    "standardized_nudges_misinfo": True,
    "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
    "rweb_video_timestamps_enabled": True,
    "longform_notetweets_rich_text_read_enabled": True,
    "longform_notetweets_inline_media_enabled": True,
    "responsive_web_enhance_cards_enabled": False
}

user_id = "1940360837547565056"

for qid in query_ids:
    variables = {
        "userId": user_id,
        "count": 20,
        "includePromotedContent": False,
        "withQuickPromoteEligibilityTweetFields": True,
        "withVoice": True,
        "withV2Timeline": True
    }
    params = {
        "variables": json.dumps(variables),
        "features": json.dumps(features)
    }
    url = f"https://twitter.com/i/api/graphql/{qid}/UserTweets?{urllib.parse.urlencode(params)}"
    req_t = urllib.request.Request(
        url,
        headers={
            "Authorization": bearer,
            "x-guest-token": guest_token,
            "x-twitter-active-user": "yes",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
    )
    try:
        with urllib.request.urlopen(req_t, timeout=10, context=ctx) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"SUCCESS with {qid}!")
            with open(f"tweets_{qid}.json", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            break
    except urllib.error.HTTPError as e:
        print(f"Failed {qid}: HTTP {e.code}")
    except Exception as e:
        print(f"Failed {qid}: {e}")
