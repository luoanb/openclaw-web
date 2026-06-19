#!/usr/bin/env bash
set -e

echo "=== 启动 Dev Gateway (port 19001) ==="
cd /home/lab/workspace/openclaw
node scripts/run-node.mjs --dev gateway run --port 19001 --bind lan &
DEV_PID=$!
echo "Dev Gateway PID: $DEV_PID"
sleep 3

echo ""
echo "=== 启动 Claw Manager (port 5177) ==="
cd /home/lab/workspace/openclaw-web/apps/claw_manager
npx tsx server.ts &
CM_PID=$!
echo "Claw Manager PID: $CM_PID"
sleep 2

echo ""
echo "=== 状态 ==="
echo "Dev Gateway:  https://192.168.1.2:19001/"
echo "Claw Manager: https://192.168.1.2:5177/"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $DEV_PID $CM_PID 2>/dev/null; exit" SIGINT SIGTERM
wait