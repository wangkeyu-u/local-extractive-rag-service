"""Build the fixed synthetic PDF members of benchmark v1."""

from pathlib import Path

from generate_sample_pdf import build_pdf


ROOT = Path(__file__).parents[1] / "benchmark" / "corpus"
DOCUMENTS = {
    "emergency.pdf": [
        "Aurora Emergency Power. The Orion emergency battery provides 18 hours of power. Its replacement cell code is B17.",
        "Aurora Evacuation. Three short alarm pulses signal evacuation. All crew assemble at Blue Station.",
    ],
    "instruments.pdf": [
        "Lumen Instrument Service. Lumen sensors are calibrated every Tuesday. Calibration records use form L44.",
        "Delta Range Procedure. The Delta field sensor has a maximum range of 400 meters. It transmits on channel 7.",
    ],
}


if __name__ == "__main__":
    for filename, pages in DOCUMENTS.items():
        target = ROOT / filename
        target.write_bytes(build_pdf(pages))
        print(target)
