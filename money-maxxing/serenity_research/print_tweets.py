import json
import sys

# Set stdout encoding
sys.stdout.reconfigure(encoding='utf-8')

with open("tweets_V7H0Ap3_Hh2FyS75OCDO3Q.json", "r", encoding="utf-8") as f:
    data = json.load(f)

instructions = data.get("data", {}).get("user", {}).get("result", {}).get("timeline_v2", {}).get("timeline", {}).get("instructions", [])

cursors = []
for inst in instructions:
    if inst.get("type") == "TimelineAddEntries":
        for entry in inst.get("entries", []):
            if entry.get("entryId", "").startswith("cursor-"):
                cursors.append(entry)

print("Found cursors:")
for c in cursors:
    print(c["entryId"], c["content"].get("value"), c["content"].get("cursorType"))

with open("serenity_parsed_tweets.json", "r", encoding="utf-8") as f:
    tweets = json.load(f)

for i, t in enumerate(tweets):
    print(f"\n==================== TWEET {i+1} ====================")
    print(f"ID: {t['id']} | Date: {t['created_at']}")
    print(f"Stats: Views {t['views']} | Likes {t['favorite_count']} | RTs {t['retweet_count']}")
    print(f"Tickers/Symbols: {t['symbols']}")
    print(f"Text:\n{t['text']}")
