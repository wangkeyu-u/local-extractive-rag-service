#!/usr/bin/env bash
set -euo pipefail

api="${RAG_API_URL:-http://127.0.0.1:8000}"

echo "1/4 Index PDF and text corpus"
curl --fail --silent --show-error -X POST "$api/index"
echo

echo "2/4 Ask a multi-part question and inspect rewrite, RRF and citations"
curl --fail --silent --show-error -X POST "$api/ask" \
  -H 'Content-Type: application/json' \
  -d '{"question":"Explain refunds and compare shipping","top_k":5}'
echo

echo "3/4 Generate grounded study cards"
curl --fail --silent --show-error -X POST "$api/quiz" \
  -H 'Content-Type: application/json' \
  -d '{"topic":"refund","count":2}'
echo

echo "4/4 Confirm graph data"
curl --fail --silent --show-error "$api/graph"
echo
