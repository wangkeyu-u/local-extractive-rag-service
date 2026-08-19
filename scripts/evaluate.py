#!/usr/bin/env python
from pathlib import Path
import sys

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))

from app.evaluation import evaluate  # noqa: E402


report = evaluate(ROOT / "benchmark", ROOT / ".rag_data" / "evaluation", ROOT / "artifacts" / "evaluation")
print((ROOT / "artifacts" / "evaluation" / "benchmark-results.json"))
for name, value in report["metrics"].items():
    print(f"{name}={value:.6f} threshold={report['thresholds'][name]:.6f} {'PASS' if report['checks'][name] else 'FAIL'}")
sys.exit(0 if report["gate_passed"] else 1)
