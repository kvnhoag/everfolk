"""One-profile external repeat and provenance-boundary validation."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[3]
CARD = PROJECT / "artwork/cards/alexander-fixed-pose-v8"
SCRIPT = PROJECT / "artwork/skills/everfolk-asset-workflow/scripts/pixelate_regions.py"
SOURCE = CARD / "source/alexander-blade-only.png"
BASE = CARD / "assets/alexander-card-pixel.png"
BASE_QA = CARD / "qa/portrait-pixel.json"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(output, qa=BASE_QA):
    return subprocess.run([sys.executable, str(SCRIPT), "--input", str(SOURCE), "--base", str(BASE),
                           "--base-qa", str(qa), "--config", str(ROOT / "profile.json"),
                           "--runtime", str(PROJECT / "artifacts/pixeloe-runtime/site-packages"),
                           "--output", str(output)], capture_output=True, text=True)


def main():
    before = {str(path): sha(path) for path in (SOURCE, BASE, BASE_QA)}
    repeat_output = ROOT / "regional-repeat.png"
    repeat = run(repeat_output)
    assert repeat.returncode == 0, repeat.stderr
    assert sha(repeat_output) == sha(ROOT / "regional-pixel.png")
    wrong_source_qa = ROOT / "wrong-source-base-qa.json"
    record = json.loads(BASE_QA.read_text(encoding="utf-8"))
    record["sourceSha256"] = "0" * 64
    wrong_source_qa.write_text(json.dumps(record), encoding="utf-8")
    rejected_output = ROOT / "must-not-be-written.png"
    rejected = run(rejected_output, wrong_source_qa)
    assert rejected.returncode == 1
    assert "sourceSha256 does not match" in rejected.stderr
    assert not rejected_output.exists()
    assert all(sha(Path(path)) == digest for path, digest in before.items())
    qa = json.loads((ROOT / "regional-qa.json").read_text(encoding="utf-8"))
    assert qa["outsideMaskChangedPixels"] == qa["selectedDetailDifferingPixels"] == 0
    assert all(item["detailCoverage"] == 1 for item in qa["criticalCoverage"])
    summary = {"externalRepeatExact": True, "wrongSourceMetadataRejected": True,
               "rejectionWroteNoOutput": True, "protectedV8FilesUnchanged": True,
               "outsideMaskChangedPixels": 0, "selectedDetailDifferingPixels": 0,
               "criticalBoxesFullFine": True, "affectedPixels": qa["affectedPixels"],
               "outputSha256": sha(ROOT / "regional-pixel.png"),
               "rejectionError": rejected.stderr.strip()}
    (ROOT / "validation-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
