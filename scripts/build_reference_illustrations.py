"""Extract labeled figures. Run: uv run --with pymupdf --with pillow python scripts/build_reference_illustrations.py"""
from pathlib import Path
import hashlib
import json
import re

import fitz
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Telencephalon.pdf"
DEST = ROOT / "trainer/assets/illustrations/telencephalon"
AXIAL = [
    ("중간 교뇌", -34), ("상부 교뇌", -26), ("중뇌", -18),
    ("상부 중뇌 · 시상하부", -10), ("앞맞교차 · 뒤쪽 시상", -2),
    ("미상핵 머리 · 중간 시상", 6), ("기저핵 · 내포", 14),
    ("등쪽 미상핵 · 뇌량 무릎과 팽대", 24), ("뇌량 몸통", 36), ("반난형중심", 50),
]
CORONAL = [
    ("뇌량 무릎", 30), ("미상핵 머리 · 측좌핵", 22), ("앞맞교차 · 뇌궁 기둥", 12),
    ("편도체 · 내포 앞다리", 4), ("유두체", -4), ("유두시상로 · 흑질 · 앞쪽 해마", -12),
    ("중간 시상", -20), ("무릎체", -28), ("뒤쪽 시상베개 · 위둔덕", -36), ("뇌량 팽대", -44),
]


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(SOURCE)
    figures = []
    previews = []
    for index, (title, coordinate) in enumerate(AXIAL + CORONAL):
        page_number = 2 + 2 * index
        page = doc[page_number - 1]
        plane = "axial" if index < 10 else "coronal"
        level = index % 10 + 1
        figure = f"13.{index + 1}A"
        blocks = page.get_text("blocks")
        caption = next(b for b in blocks if figure in b[4] and "SECTIONS" in b[4])
        clip = fitz.Rect(24, 45, 588, caption[1] - 8)
        pix = page.get_pixmap(dpi=240, clip=clip, alpha=False)
        im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        stem = f"{plane}-{level:02d}"
        im.save(DEST / f"{stem}.webp", quality=92, method=6)
        preview = im.copy()
        preview.thumbnail((600, 700))
        preview.save(DEST / f"{stem}-thumb.webp", quality=87, method=6)
        text = page.get_text(clip=clip)
        # PDF text may use separate blocks for a wrapped level heading.
        heading = re.search(r"Level\s+\d+:\s*([^\n]+)", text)
        figures.append({
            "id": stem, "plane": plane, "level": level, "title": title,
            "sourceHeading": heading.group(0) if heading else f"Level {level}",
            "referenceMm": coordinate, "pdfPage": page_number,
            "printedPage": 298 + page_number, "figure": figure,
            "image": f"assets/illustrations/telencephalon/{stem}.webp",
            "thumbnail": f"assets/illustrations/telencephalon/{stem}-thumb.webp",
            "width": im.width, "height": im.height, "cropPoints": list(clip),
            "sha256": hashlib.sha256((DEST / f"{stem}.webp").read_bytes()).hexdigest(),
        })
        previews.append((stem, preview))
    manifest = {
        "schemaVersion": 1, "source": "Telencephalon.pdf",
        "sourceSHA256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "provenance": "User-supplied Telencephalon chapter, figures 13.1A–13.20A. Original labels, leader lines and artist credit retained.",
        "matching": "Authored approximate anatomical levels; not registered. Subject offset uses bilateral thalamic anchors relative to reference [0, -18, 8] mm. No rotation or scale correction.",
        "figures": figures,
    }
    (DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    qa = ROOT / "trainer/qa"
    qa.mkdir(exist_ok=True)
    sheet = Image.new("RGB", (1500, 1400), "#e9e9e2")
    draw = ImageDraw.Draw(sheet)
    for i, (stem, preview) in enumerate(previews):
        tile = preview.copy()
        tile.thumbnail((286, 314))
        x, y = (i % 5) * 300, (i // 5) * 350
        draw.text((x + 8, y + 8), stem, fill="black")
        sheet.paste(tile, (x + (300 - tile.width) // 2, y + 30))
    sheet.save(qa / "illustration-contact-sheet.jpg", quality=90)
    print(f"Extracted {len(figures)} annotated figures to {DEST}")


if __name__ == "__main__":
    main()
