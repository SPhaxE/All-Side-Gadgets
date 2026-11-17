"""把本项目同步到 GitHub：SPhaxE/All-Side-Gadgets 仓库 main 分支的 money-maxxing/ 子目录。

用法（每期归档、grade、lint 完成后运行）：
    python github_sync.py                 # 自动生成提交说明（若远端有他机新提交会拦截提示）
    python github_sync.py -m "第 25 期"   # 自定义提交说明
    python github_sync.py --force -m "..." # 确认已合并后强制镜像推送
    python github_sync.py --pull          # 把远端 money-maxxing/ 拉回本地目录（覆盖前自备备份）

做的事：
1. 本地克隆 D:\\All-Side-Gadgets 拉取最新 main（只允许快进）；
2. 检查远端是否刚拉入其他机器的新提交（防静默覆盖）；
3. 把本目录镜像到克隆的 money-maxxing/（排除 _backup/、__pycache__、*.pyc；源里已删除的文件同步删除）；
4. .md 里的本地绝对链接 file:///d:/money%20maxxing/xxx 改写为相对链接 xxx（GitHub 上可点击；本地原文件不改）；
5. 只提交 money-maxxing/ 子目录，推送到 origin main。
可用环境变量 MM_REPO 覆盖克隆路径。
"""
import argparse
import datetime as dt
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
REPO = Path(os.environ.get("MM_REPO", r"D:\All-Side-Gadgets"))
REMOTE = "https://github.com/SPhaxE/All-Side-Gadgets.git"
SUBDIR = "money-maxxing"
BRANCH = "main"
EXCLUDE_DIRS = {"_backup", "__pycache__", ".git"}
LINK_RE = re.compile(r"file:///d:/money%20maxxing/", re.IGNORECASE)


def git(*args, check=True):
    r = subprocess.run(["git", "-C", str(REPO), *args], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        sys.exit(f"git {' '.join(args)} 失败：\n{r.stdout}{r.stderr}")
    return r.stdout.strip()


def source_files():
    for p in SRC.rglob("*"):
        rel = p.relative_to(SRC)
        if p.is_file() and not (set(rel.parts) & EXCLUDE_DIRS) and p.suffix != ".pyc":
            yield rel


def mirror():
    dst_root = REPO / SUBDIR
    wanted = set(source_files())
    for rel in wanted:
        src, dst = SRC / rel, dst_root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.suffix.lower() == ".md":
            text = src.read_text(encoding="utf-8")
            with open(dst, "w", encoding="utf-8", newline="") as f:
                f.write(LINK_RE.sub("", text))
        else:
            shutil.copy2(src, dst)
    for p in sorted(dst_root.rglob("*"), reverse=True):
        rel = p.relative_to(dst_root)
        if p.is_file() and rel not in wanted:
            p.unlink()
        elif p.is_dir() and not any(p.iterdir()):
            p.rmdir()


def pull_to_src():
    dst_root = REPO / SUBDIR
    for p in dst_root.rglob("*"):
        rel = p.relative_to(dst_root)
        if p.is_file() and not (set(rel.parts) & EXCLUDE_DIRS):
            out = SRC / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, out)
    print(f"已将 {dst_root} 同步至 {SRC}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-m", "--message", default="")
    ap.add_argument("--force", action="store_true", help="即使拉取到他机新提交也继续镜像覆盖")
    ap.add_argument("--pull", action="store_true", help="将远端最新 money-maxxing/ 拉取回本地目录")
    args = ap.parse_args()

    if not (REPO / ".git").exists():
        subprocess.run(["git", "clone", REMOTE, str(REPO)], check=True)
    if git("rev-parse", "--abbrev-ref", "HEAD") != BRANCH:
        git("checkout", BRANCH)
    if git("status", "--porcelain", "--", SUBDIR):
        sys.exit(f"{REPO}\\{SUBDIR} 有未提交改动，请先处理后再同步。")

    before_head = git("rev-parse", "HEAD")
    git("pull", "--ff-only", "origin", BRANCH)
    after_head = git("rev-parse", "HEAD")

    if args.pull:
        pull_to_src()
        return

    if before_head != after_head and not args.force:
        changed = git("diff", "--name-only", before_head, after_head, "--", SUBDIR)
        if changed:
            sys.exit(
                f"警告：远端 origin/{BRANCH} 刚拉入关于 {SUBDIR}/ 的新提交（{before_head[:7]}..{after_head[:7]}），"
                f"直接推送会覆盖他机记录！\n请先运行 `python github_sync.py --pull` 合并最新期数，或确认后加 `--force`。"
            )

    mirror()
    git("add", "-A", "--", SUBDIR)
    if not git("diff", "--cached", "--name-only", "--", SUBDIR):
        print("没有变化，无需推送。")
        return
    cn_now = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).strftime("%Y-%m-%d %H:%M")
    msg = f"money-maxxing: {args.message + ' · ' if args.message else ''}数据同步 {cn_now}"
    git("commit", "-m", msg, "--", SUBDIR)
    git("push", "origin", BRANCH)
    print(git("log", "--oneline", "-1"))
    print(git("show", "--stat", "--format=", "HEAD"))


if __name__ == "__main__":
    main()
