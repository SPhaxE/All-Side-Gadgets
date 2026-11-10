import re
import json

with open('serenity_syndication.html', 'r', encoding='utf-8') as f:
    html = f.read()

m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
if m:
    data = json.loads(m.group(1))
    print("Found NEXT_DATA")
    with open('serenity_syndication.json', 'w', encoding='utf-8') as out:
        json.dump(data, out, indent=2, ensure_ascii=False)
    props = data.get('props', {}).get('pageProps', {})
    print("pageProps keys:", list(props.keys()))
    timeline = props.get('timeline', {})
    entries = timeline.get('entries', [])
    print(f"Timeline entries: {len(entries)}")
    for e in entries:
        t = e.get('content', {}).get('tweet', {})
        if t:
            print('--- TWEET ---')
            print('ID:', t.get('id_str'))
            print('Created at:', t.get('created_at'))
            print('Text:', t.get('text'))
            print('Entities:', t.get('entities', {}).get('symbols'))
else:
    print("No match. HTML snippet:")
    print(html[:1000])
