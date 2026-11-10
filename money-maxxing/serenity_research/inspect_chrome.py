import os
import re

size = os.path.getsize('serenity_chrome.html')
print(f"File size: {size} bytes")

with open('serenity_chrome.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

print(f"Text length: {len(text)} chars")

# Check if there is login wall or tweets
if "Sign in to X" in text or "Log in to X" in text:
    print("Detected Sign in / Login prompt in DOM")

tweets = re.findall(r'data-testid="tweetText"[^>]*>(.*?)</div>', text, re.DOTALL)
print(f"Tweets found via data-testid='tweetText': {len(tweets)}")
for idx, tw in enumerate(tweets):
    clean = re.sub(r'<[^>]+>', ' ', tw).strip()
    print(f"\n--- TWEET {idx+1} ---")
    print(clean)

# Look for text content or article tags
articles = re.findall(r'<article[^>]*>(.*?)</article>', text, re.DOTALL)
print(f"\nArticles found: {len(articles)}")
for idx, art in enumerate(articles[:5]):
    clean = re.sub(r'<[^>]+>', ' ', art).strip()
    print(f"Article {idx+1}: {clean[:300]}")
