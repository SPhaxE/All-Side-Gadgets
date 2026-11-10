import json

with open("tweets_V7H0Ap3_Hh2FyS75OCDO3Q.json", "r", encoding="utf-8") as f:
    d = json.load(f)

insts = d["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"]
for i, inst in enumerate(insts):
    print(f"Instruction {i}: {inst.get('type')}")
    entries = inst.get("entries", [])
    print(f"  Entries count: {len(entries)}")
    for j, e in enumerate(entries):
        print(f"    Entry {j}: id={e.get('entryId')}, type={e.get('content', {}).get('entryType')}")
