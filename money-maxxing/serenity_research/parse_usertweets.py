import json

with open("tweets_V7H0Ap3_Hh2FyS75OCDO3Q.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Navigate timeline
instructions = data.get("data", {}).get("user", {}).get("result", {}).get("timeline_v2", {}).get("timeline", {}).get("instructions", [])

tweets_extracted = []

def extract_tweet_info(tweet_result):
    if not tweet_result:
        return None
    # handle TweetWithVisibilityResults
    if tweet_result.get("__typename") == "TweetWithVisibilityResults":
        tweet_result = tweet_result.get("tweet", {})
    legacy = tweet_result.get("legacy", {})
    if not legacy:
        return None
    
    # Check for note_tweet (long-form tweet / thread)
    note_tweet = tweet_result.get("note_tweet", {}).get("note_tweet_results", {}).get("result", {})
    full_text = note_tweet.get("text") or legacy.get("full_text", "")
    
    created_at = legacy.get("created_at")
    id_str = legacy.get("id_str")
    symbols = [s.get("text") for s in legacy.get("entities", {}).get("symbols", [])]
    hashtags = [h.get("text") for h in legacy.get("entities", {}).get("hashtags", [])]
    user_mentions = [u.get("screen_name") for u in legacy.get("entities", {}).get("user_mentions", [])]
    urls = [u.get("expanded_url") for u in legacy.get("entities", {}).get("urls", [])]
    retweet_count = legacy.get("retweet_count")
    favorite_count = legacy.get("favorite_count")
    reply_count = legacy.get("reply_count")
    views = tweet_result.get("views", {}).get("count")
    
    return {
        "id": id_str,
        "created_at": created_at,
        "text": full_text,
        "symbols": symbols,
        "hashtags": hashtags,
        "user_mentions": user_mentions,
        "urls": urls,
        "retweet_count": retweet_count,
        "favorite_count": favorite_count,
        "reply_count": reply_count,
        "views": views
    }

for inst in instructions:
    inst_type = inst.get("type")
    entries = inst.get("entries", [])
    if inst_type == "TimelineAddEntries":
        for entry in entries:
            entry_id = entry.get("entryId", "")
            content = entry.get("content", {})
            # could be TimelineTimelineItem
            item_content = content.get("itemContent", {})
            tweet_results = item_content.get("tweet_results", {}).get("result", {})
            t_info = extract_tweet_info(tweet_results)
            if t_info:
                tweets_extracted.append(t_info)
            # could be TimelineTimelineModule (conversations / threads)
            items = content.get("items", [])
            for sub_item in items:
                sub_tweet_res = sub_item.get("item", {}).get("itemContent", {}).get("tweet_results", {}).get("result", {})
                t_info = extract_tweet_info(sub_tweet_res)
                if t_info:
                    tweets_extracted.append(t_info)

print(f"Total tweets extracted: {len(tweets_extracted)}")
with open("serenity_parsed_tweets.json", "w", encoding="utf-8") as f:
    json.dump(tweets_extracted, f, indent=2, ensure_ascii=False)

for i, t in enumerate(tweets_extracted):
    print(f"\n==================== TWEET {i+1} ====================")
    print(f"ID: {t['id']} | Date: {t['created_at']}")
    print(f"Stats: Views {t['views']} | Likes {t['favorite_count']} | RTs {t['retweet_count']}")
    print(f"Tickers/Symbols: {t['symbols']}")
    print(f"Text:\n{t['text']}")
