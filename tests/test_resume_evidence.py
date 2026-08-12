import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).parents[1]


def test_resume_evidence_is_generated_and_statuses_are_closed_set():
    subprocess.run([str(ROOT / ".venv" / "bin" / "python"), "scripts/build_resume_evidence.py"], cwd=ROOT, check=True)
    ledger = json.loads((ROOT / "docs" / "resume-evidence.json").read_text(encoding="utf-8"))
    assert len(ledger["entries"]) == 5
    assert {entry["status"] for entry in ledger["entries"]} <= {"verified", "implemented_unverified", "unsupported"}
    perfect = next(entry for entry in ledger["entries"] if entry["id"] == "rag-5-perfect-benchmark")
    assert perfect["status"] == "unsupported"
    assert perfect["computed_fixture_metrics"] == ledger["benchmark"]["metrics"]
    assert ledger["benchmark"]["fixture"] is True
