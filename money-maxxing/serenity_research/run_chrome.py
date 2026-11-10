import subprocess

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
cmd = [
    chrome_path,
    "--headless=new",
    "--disable-gpu",
    "--virtual-time-budget=8000",
    "--dump-dom",
    "https://x.com/aleabitoreddit"
]

print("Running Chrome headless...")
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore")
print("Return code:", res.returncode)
print("Stdout length:", len(res.stdout))
print("Stderr length:", len(res.stderr))

with open("serenity_chrome.html", "w", encoding="utf-8") as f:
    f.write(res.stdout)

if len(res.stdout) > 0:
    print("Preview of stdout:")
    print(res.stdout[:500])
