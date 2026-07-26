#!/bin/bash

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "[Overlay Studio] 未检测到 Node.js。"
  echo "请安装 Node.js LTS 后重新双击此文件：https://nodejs.org/"
  echo
  read -r -p "按回车键退出..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo
  echo "[Overlay Studio] 未检测到 npm，请重新安装 Node.js LTS。"
  echo
  read -r -p "按回车键退出..."
  exit 1
fi

node "scripts/start-overlay-studio.mjs"
status=$?

if [ "$status" -ne 0 ]; then
  echo
  echo "[Overlay Studio] 启动未完成，请查看上方错误信息。"
  echo
  read -r -p "按回车键退出..."
fi

exit "$status"
