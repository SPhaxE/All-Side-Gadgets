import sys
sys.stdout.reconfigure(encoding='utf-8')

for sid in ['2063465386960736396', '2030982945264333141']:
    print("*"*60)
    print("STATUS ID:", sid)
    with open(f"tweet_{sid}.txt", "r", encoding="utf-8") as f:
        print(f.read())
