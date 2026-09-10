"""Feasibility samples only; preserves the source PDF and production assets.

Run: uv run --with pymupdf python docs/research/illustration-isolation/probe.py
The samples are rendered from PDF objects, without generative reconstruction.
"""
from pathlib import Path
import hashlib
import json

import fitz

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SOURCE = ROOT / "Telencephalon.pdf"


def main():
    before_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    source = fitz.open(SOURCE)
    page = source[11]
    crop = fitz.Rect(146, 176, 545, 686)
    # Extend beyond the crop boundary to avoid antialias seams on scaled PDF reuse.
    excluded = [fitz.Rect(144, 174, 228, 280), fitz.Rect(144, 495, 231, 688)]
    # Verify each retained label at line granularity: PDF blocks can combine labels.
    retained = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            rect = fitz.Rect(line["bbox"])
            text = "".join(span["text"] for span in line["spans"])
            if crop.contains(rect) and not any(rect.intersects(r) for r in excluded):
                retained.append(text)
    original = page.get_pixmap(dpi=216, clip=crop, alpha=False)
    # White PDF vector overlays only cover the unwanted localizer and MRI.
    # This is a disposable in-memory document, never saved over the source.
    for rect in excluded:
        page.draw_rect(rect, color=None, fill=(1, 1, 1), overlay=True)
    isolated = page.get_pixmap(dpi=216, clip=crop, alpha=False)
    isolated.save(OUT / "axial-06-labeled.png")
    changed_outside = 0
    a, b = original.samples, isolated.samples
    for y in range(original.height):
        for x in range(original.width):
            # Allow one rendered pixel of antialiasing at exclusion boundaries.
            point = fitz.Point(crop.x0 + (x + .5) / 3, crop.y0 + (y + .5) / 3)
            if any((r + (-1, -1, 1, 1)).contains(point) for r in excluded):
                continue
            i = (y * original.width + x) * 3
            changed_outside += a[i:i+3] != b[i:i+3]
    assert changed_outside == 0
    labeled = fitz.open()
    target = labeled.new_page(width=crop.width, height=crop.height)
    target.show_pdf_page(target.rect, source, 11, clip=crop)
    labeled.save(OUT / "axial-06-labeled.pdf", garbage=4, deflate=True)

    # The embedded image has no labels or leaders. Use it as a PDF image object.
    original_source = fitz.open(SOURCE)
    info = original_source[11].get_image_info(xrefs=True)[0]
    embedded = original_source.extract_image(info["xref"])
    (OUT / f"axial-06-embedded.{embedded['ext']}").write_bytes(embedded["image"])
    image_document = fitz.open()
    image_page = image_document.new_page(width=612, height=783)
    image_page.insert_image(fitz.Rect(info["bbox"]), stream=embedded["image"])
    art_crop = fitz.Rect(236, 246, 515, 593)
    clean = fitz.open()
    clean_page = clean.new_page(width=279, height=371)
    clean_page.show_pdf_page(fitz.Rect(0, 0, 279, 347), image_document, 0, clip=art_crop)
    # Retain the original vector artist credit below the isolated illustration.
    clean_page.show_pdf_page(fitz.Rect(201, 352, 273, 369), original_source, 11,
                            clip=fitz.Rect(457, 667, 529, 684))
    clean.save(OUT / "axial-06-unlabeled.pdf", garbage=4, deflate=True)
    clean_page.get_pixmap(dpi=216, alpha=False).save(OUT / "axial-06-unlabeled.png")

    comparison = fitz.open()
    comparison_page = comparison.new_page(width=960, height=650)
    comparison_page.insert_text((20, 27), "Figure 13.6A - source-preserving isolation", fontsize=17)
    for i, (title, document, number, clip) in enumerate([
        ("Current full plate", original_source, 11, fitz.Rect(24, 45, 588, 717.004)),
        ("Main illustration + original labels", labeled, 0, labeled[0].rect),
        ("Main illustration only", clean, 0, clean[0].rect),
    ]):
        x = 20 + i * 315
        comparison_page.insert_text((x, 59), title, fontsize=12)
        comparison_page.show_pdf_page(fitz.Rect(x, 78, x + 300, 610), document, number, clip=clip)
    comparison_page.insert_text((20, 634), "Source: Telencephalon.pdf, PDF p.12 / book p.310. Original artist credit retained. Feasibility samples only.", fontsize=9)
    comparison.save(OUT / "comparison.pdf", garbage=4, deflate=True)
    comparison_page.get_pixmap(dpi=120, alpha=False).save(OUT / "comparison.png")

    report = {
        "scope": "Feasibility only, axial-06 / figure 13.6A / PDF page 12 / book page 310",
        "sourceSHA256": before_hash,
        "sourceUnchanged": hashlib.sha256(SOURCE.read_bytes()).hexdigest() == before_hash,
        "labeledCropPoints": list(crop),
        "excludedRectanglesPoints": [list(r) for r in excluded],
        "retainedLabelLines": retained,
        "changedPixelsOutsideExclusions": changed_outside,
        "unlabeledCropPoints": list(art_crop),
        "nativeArtApproxPixels": [round(art_crop.width * info['width'] / fitz.Rect(info['bbox']).width),
                                   round(art_crop.height * info['height'] / fitz.Rect(info['bbox']).height)],
        "productionAssetsModified": False,
    }
    (OUT / "evidence.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
