#!/usr/bin/env bash
#
# Skill Vault - 安装程序 (macOS / Linux)
#
# 用法:
#   ./install.sh                        安装到 ~/.claude/skills
#   ./install.sh -t ~/.codex/skills     指定目标目录
#   ./install.sh -f                     覆盖已存在的同名 skill
#   ./install.sh -n                     预览（不写入）
#   ./install.sh -h                     查看帮助

set -euo pipefail

TARGET="${HOME}/.claude/skills"
FORCE=0
DRY_RUN=0

usage() {
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
}

while getopts "t:fnh" opt; do
    case "$opt" in
        t) TARGET="$OPTARG" ;;
        f) FORCE=1 ;;
        n) DRY_RUN=1 ;;
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
echo ""
echo "完成。重启 AI Agent 后即可使用新的 skill。"
