#!/bin/bash
# ----------------------------------------------------------
# OpenAPI → TypeScript 类型同步脚本
#
# 前提：
#   1. 后端 FastAPI 正在运行（默认 http://localhost:8000）
#   2. 已安装 npx（Node.js 自带）
#
# 用法：
#   ./scripts/sync-api-types.sh
#   ./scripts/sync-api-types.sh http://localhost:9000  # 自定义地址
# ----------------------------------------------------------

set -euo pipefail

BACKEND_URL="${1:-http://localhost:8000}"
OPENAPI_URL="${BACKEND_URL}/openapi.json"
OUTPUT_FILE="frontend/src/lib/api-types.ts"

echo "⏳ Fetching OpenAPI spec from ${OPENAPI_URL}..."
curl -sf "${OPENAPI_URL}" -o /tmp/openapi.json || {
    echo "❌ Failed to fetch OpenAPI spec. Is your backend running?"
    exit 1
}

echo "⏳ Generating TypeScript types..."
npx openapi-typescript /tmp/openapi.json -o "${OUTPUT_FILE}"

echo "✅ Types written to ${OUTPUT_FILE}"
echo "   $(wc -l < "${OUTPUT_FILE}") lines generated"
