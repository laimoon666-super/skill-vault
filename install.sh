#!/usr/bin/env bash
#
# Skill Vault - 安装程序 (macOS / Linux)
#
# 用法:
#   ./install.sh                        安装到 ~/.claude/skills
#   ./install.sh -t ~/.agents/skills    指定目标目录（DSH 用这个）
#   ./install.sh -f                     覆盖已存在的同名 skill
#   ./install.sh -n                     预览（不写入）
#   ./install.sh -d                     自动 pip 安装 pythonDependencies
#   ./install.sh -h                     查看帮助

set -euo pipefail

TARGET="${HOME}/.claude/skills"
FORCE=0
DRY_RUN=0
INSTALL_DEPS=0

usage() {
    sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
}

while getopts "t:fnhd" opt; do
    case "$opt" in
        t) TARGET="$OPTARG" ;;
        f) FORCE=1 ;;
        n) DRY_RUN=1 ;;
        d) INSTALL_DEPS=1 ;;
        h) usage ;;
        *) usage ;;
    esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_ROOT="${REPO_ROOT}/skills"

if [ ! -d "$SRC_ROOT" ]; then
    echo "错误：找不到 skills 目录：$SRC_ROOT" >&2
    exit 1
fi

# 展开 ~ 前缀
case "$TARGET" in
    "~"/*) TARGET="${HOME}/${TARGET#\~/}" ;;
esac

shopt -s nullglob
SKILL_DIRS=("${SRC_ROOT}"/*/)
shopt -u nullglob

echo ""
echo "Skill Vault - 安装程序"
echo "目标目录 : ${TARGET}"
echo "发现 skill: ${#SKILL_DIRS[@]} 个"
[ "$DRY_RUN" -eq 1 ] && echo "模式     : 预览（不写入）"
echo ""

if [ "${#SKILL_DIRS[@]}" -eq 0 ]; then
    echo "skills/ 目录为空，没有可安装的 skill。"
    echo "提示：把 skill 文件夹放进 skills/ 后重新运行本脚本。"
    exit 0
fi

if [ "$DRY_RUN" -eq 0 ]; then
    mkdir -p "$TARGET"
fi

installed=0
skipped=0

for dir in "${SKILL_DIRS[@]}"; do
    name="$(basename "$dir")"
    dest="${TARGET}/${name}"

    if [ ! -f "${dir}/SKILL.md" ]; then
        echo "  [警告] ${name} 缺少 SKILL.md，已跳过"
        skipped=$((skipped + 1))
        continue
    fi

    if [ -e "$dest" ] && [ "$FORCE" -eq 0 ]; then
        echo "  [跳过] ${name} 已存在（用 -f 覆盖）"
        skipped=$((skipped + 1))
        continue
    fi

    if [ "$DRY_RUN" -eq 1 ]; then
        if [ -e "$dest" ]; then
            echo "  [预览] 将覆盖 ${name}  ->  ${dest}"
        else
            echo "  [预览] 将安装 ${name}  ->  ${dest}"
        fi
        installed=$((installed + 1))
        continue
    fi

    rm -rf "$dest"
    cp -R "$dir" "$dest"
    echo "  [完成] ${name}"
    installed=$((installed + 1))
done

echo ""
echo "安装 ${installed} 个，跳过 ${skipped} 个。"

# ---- 按 skills.json 检查环境变量与 Python 依赖 ----
MANIFEST="${REPO_ROOT}/skills.json"
if [ -f "$MANIFEST" ] && command -v python3 >/dev/null 2>&1; then
    ENV_LINES="$(python3 -c 'import json,sys
d=json.load(open(sys.argv[1],encoding="utf-8"))
for s in d.get("skills",[]):
    for e in (s.get("env") or []):
        if e: print("  %s  ->  %s" % (s["name"], e))' "$MANIFEST" 2>/dev/null || true)"

    DEP_LINES="$(python3 -c 'import json,sys
d=json.load(open(sys.argv[1],encoding="utf-8"))
owners={}
for s in d.get("skills",[]):
    for p in (s.get("pythonDependencies") or []):
        if p: owners.setdefault(p,[]).append(s["name"])
for p in sorted(owners): print("  %s  <-  %s" % (p, ", ".join(owners[p])))' "$MANIFEST" 2>/dev/null || true)"

    DEP_PKGS="$(python3 -c 'import json,sys
d=json.load(open(sys.argv[1],encoding="utf-8"))
print(" ".join(sorted({p for s in d.get("skills",[]) for p in (s.get("pythonDependencies") or []) if p})))' "$MANIFEST" 2>/dev/null || true)"

    if [ -n "$ENV_LINES" ]; then
        echo ""
        echo "以下 skill 需要先配置环境变量才能正常使用："
        echo "$ENV_LINES"
    fi

    if [ -n "$DEP_PKGS" ]; then
        echo ""
        echo "以下 skill 需要 Python 依赖（缺包会直接报错）："
        echo "$DEP_LINES"
        echo ""
        if [ "$INSTALL_DEPS" -eq 1 ] && [ "$DRY_RUN" -eq 0 ]; then
            echo "正在安装 Python 依赖：${DEP_PKGS}"
            if python3 -m pip install $DEP_PKGS; then
                echo "Python 依赖安装完成。"
            else
                echo "pip 安装失败，请手动执行：python3 -m pip install ${DEP_PKGS}" >&2
            fi
        else
            echo "提示：加 -d 可自动安装，或手动执行：python3 -m pip install ${DEP_PKGS}"
        fi
    fi
fi

echo ""
echo "完成。重启 AI Agent 后即可使用新的 skill。"
