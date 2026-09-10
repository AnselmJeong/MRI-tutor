"""Extract original PDF artwork and annotation layers using reviewed source geometry.

Run: uv run --with-requirements scripts/illustration-requirements.txt python scripts/build_reference_illustrations.py
"""
from pathlib import Path
import hashlib
import json
import re
import math
import os
import tempfile

import fitz
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Telencephalon.pdf"
DEST = ROOT / "trainer/assets/illustrations/telencephalon"
REGIONS = ROOT / "scripts/illustration-regions.json"
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


def line_records(page, clip):
    return [{"text": "".join(s["text"] for s in line["spans"]).strip(), "bbox": line["bbox"]}
            for block in page.get_text("dict")["blocks"] for line in block.get("lines", [])
            if clip.contains(fitz.Rect(line["bbox"]))]


def isolate(doc, page_number, region):
    """Compose the original raster artwork underneath its original PDF annotations."""
    page = doc[page_number - 1]
    art = fitz.Rect(region["artCropPoints"])
    crop = fitz.Rect(region["labeledCropPoints"])
    credit = fitz.Rect(region["creditCropPoints"])
    images = fitz.open()
    images.insert_pdf(doc, from_page=page_number - 1, to_page=page_number - 1)
    ip = images[0]
    # Retain the original image object, transform and interpolation settings.
    ip.add_redact_annot(ip.rect, fill=False, cross_out=False)
    ip.apply_redactions(images=0, graphics=2, text=0)

    annotation_doc = fitz.open()
    annotation_doc.insert_pdf(doc, from_page=page_number - 1, to_page=page_number - 1)
    ap = annotation_doc[0]
    ap.delete_image(ap.get_image_info(xrefs=True)[0]["xref"])
    # Preserve a raster-free source for the original vector artist credit.
    credits = fitz.open()
    credits.insert_pdf(annotation_doc)
    # Remove only the heading and localizer text. This cannot erase the artwork.
    for block in ap.get_text("dict")["blocks"]:
        text = "".join(s["text"] for line in block.get("lines", []) for s in line["spans"])
        if "Level " in text:
            # Coronal 10 groups ordinary anatomical labels with the bold localizer.
            # Redact individual bold lines, never the containing block rectangle.
            for line in block.get("lines", []):
                if all("Bold" in span["font"] for span in line["spans"]):
                    ap.add_redact_annot(fitz.Rect(line["bbox"]), fill=False, cross_out=False)
    ap.apply_redactions(images=0, graphics=0, text=0)
    # Move the credit to a compact footer, and omit the red localizer section line.
    # Covered-only removes these paths without deleting a crossing leader path.
    ap.add_redact_annot(credit, fill=False, cross_out=False)
    for drawing in ap.get_drawings():
        color = drawing["color"]
        if color and color[0] > .4 and color[1] < .2 and color[2] < .2:
            ap.add_redact_annot(drawing["rect"] + (-6, -6, 6, 6), fill=False, cross_out=False)
    ap.apply_redactions(images=0, graphics=1, text=1)

    actual = [r["text"] for r in line_records(ap, crop) if r["text"]]
    expected = [r["text"] for r in region["labelLines"]]
    assert actual == expected, (page_number, "label mismatch", actual, expected)
    for label in region["labelLines"]:
        assert crop.contains(fitz.Rect(label["bbox"]) + (-3, -3, 3, 3)), label
    # Check actual leader segments (including horizontal/vertical zero-area boxes).
    leaders_before = [d for d in page.get_drawings() if d["color"] and max(d["color"]) < .3]
    leaders_after = [d for d in ap.get_drawings() if d["color"] and max(d["color"]) < .3]
    assert [d["items"] for d in leaders_before] == [d["items"] for d in leaders_after], (page_number, "leader changed")
    for drawing in leaders_after:
        assert crop.contains(drawing["rect"] + (-2, -2, 2, 2))

    ap.show_pdf_page(art, images, 0, clip=art, overlay=False)
    # Compare anatomy and its overlaid leaders at original page coordinates.
    old = page.get_pixmap(dpi=144, clip=art, alpha=False)
    new = ap.get_pixmap(dpi=144, clip=art, alpha=False)
    a = np.frombuffer(old.samples, dtype=np.uint8).reshape(old.height, old.width, 3)
    b = np.frombuffer(new.samples, dtype=np.uint8).reshape(new.height, new.width, 3)
    delta = np.abs(a.astype(np.int16) - b.astype(np.int16))
    # Original artist credit may overlap the rectangular artwork bounding box.
    overlap = art & credit
    if not overlap.is_empty:
        x0, y0 = math.floor((overlap.x0-art.x0)*2), math.floor((overlap.y0-art.y0)*2)
        x1, y1 = math.ceil((overlap.x1-art.x0)*2), math.ceil((overlap.y1-art.y0)*2)
        delta[y0:y1, x0:x1] = 0
    assert delta.max() <= 2, (page_number, "artwork pixels changed", int(delta.max()))

    def compose(source, source_crop):
        result = fitz.open()
        target = result.new_page(width=source_crop.width, height=source_crop.height + 24)
        target.show_pdf_page(fitz.Rect(0, 0, source_crop.width, source_crop.height), source, 0, clip=source_crop)
        target.show_pdf_page(fitz.Rect(source_crop.width-credit.width-6, source_crop.height+3,
                                     source_crop.width-6, source_crop.height+3+credit.height), credits, 0, clip=credit)
        return result

    return compose(annotation_doc, crop), compose(images, art), {
        "labelLines": len(expected), "leaderPaths": len(leaders_after),
        "maxArtworkChannelDifference": int(delta.max()),
        "artCropPoints": list(art), "labeledCropPoints": list(crop),
        "creditCropPoints": list(credit),
    }


def asset(image, stem, dest, *, preview=False, lossless=True):
    path = dest / f"{stem}.webp"
    image.save(path, lossless=lossless, quality=92, method=6)
    result = {"image": f"assets/illustrations/telencephalon/{path.name}",
              "width": image.width, "height": image.height,
              "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    if preview:
        thumb = image.copy()
        thumb.thumbnail((600, 700))
        thumb.save(dest / f"{stem}-thumb.webp", lossless=True, method=6)
        result["thumbnail"] = f"assets/illustrations/telencephalon/{stem}-thumb.webp"
        result["thumbnailSHA256"] = hashlib.sha256((dest / f"{stem}-thumb.webp").read_bytes()).hexdigest()
    return result


def rendered(page, *, dpi=288, clip=None):
    pix = page.get_pixmap(dpi=dpi, clip=clip, alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def contact_sheet(previews, path):
    sheet = Image.new("RGB", (1800, 1800), "#e9e9e2")
    draw = ImageDraw.Draw(sheet)
    for i, (stem, preview) in enumerate(previews):
        tile = preview.copy()
        tile.thumbnail((344, 412))
        x, y = (i % 5) * 360, (i // 5) * 450
        draw.text((x + 8, y + 8), stem, fill="black")
        sheet.paste(tile, (x + (360 - tile.width) // 2, y + 30))
    sheet.save(path, quality=95)


def build(dest, config):
    doc = fitz.open(SOURCE)
    figures, previews, clean_previews, evidence = [], [], [], []
    labeled_collection, clean_collection = fitz.open(), fitz.open()
    for index, (title, coordinate) in enumerate(AXIAL + CORONAL):
        page_number = 2 + 2 * index
        page = doc[page_number - 1]
        plane = "axial" if index < 10 else "coronal"
        level = index % 10 + 1
        figure = f"13.{index + 1}A"
        blocks = page.get_text("blocks")
        caption = next(b for b in blocks if figure in b[4] and "SECTIONS" in b[4])
        clip = fitz.Rect(24, 45, 588, caption[1] - 8)
        stem = f"{plane}-{level:02d}"
        labeled, clean, verification = isolate(doc, page_number, config["figures"][stem])
        labeled_collection.insert_pdf(labeled)
        clean_collection.insert_pdf(clean)
        im, clean_im = rendered(labeled[0]), rendered(clean[0])
        main_asset = asset(im, stem, dest, preview=True)
        clean_asset = asset(clean_im, f"{stem}-unlabeled", dest)
        full_asset = asset(rendered(page, dpi=240, clip=clip), f"{stem}-full", dest, lossless=False)
        text = page.get_text(clip=clip)
        # PDF text may use separate blocks for a wrapped level heading.
        heading = re.search(r"Level\s+\d+:\s*([^\n]+)", text)
        figures.append({
            "id": stem, "plane": plane, "level": level, "title": title,
            "sourceHeading": heading.group(0) if heading else f"Level {level}",
            "referenceMm": coordinate, "pdfPage": page_number,
            "printedPage": 298 + page_number, "figure": figure,
            **main_asset, "cropPoints": verification["labeledCropPoints"],
            "unlabeled": clean_asset, "fullPlate": {**full_asset, "cropPoints": list(clip)},
        })
        previews.append((stem, im))
        clean_previews.append((stem, clean_im))
        evidence.append({"id": stem, **verification})
        print(f"Extracted {stem}: {verification['labelLines']} label lines, {verification['leaderPaths']} leader paths", flush=True)
    manifest = {
        "schemaVersion": 1, "source": "Telencephalon.pdf",
        "sourceSHA256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "provenance": "User-supplied Telencephalon chapter, figures 13.1A–13.20A. Main artwork and original annotation layers extracted without reconstruction. Artist credit moved to a compact footer. Full plates retained separately.",
        "extractionVersion": 2, "renderDpi": 288,
        "matching": "Authored approximate anatomical levels; not registered. Subject offset uses bilateral thalamic anchors relative to reference [0, -18, 8] mm. No rotation or scale correction.",
        "figures": figures,
    }
    (dest / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    toc = [[1, f"{f['plane'].title()} {f['level']:02d} - {f['sourceHeading']} (Fig. {f['figure']})", i + 1]
           for i, f in enumerate(figures)]
    labeled_collection.set_toc(toc)
    clean_collection.set_toc(toc)
    labeled_collection.save(dest / "illustrations-labeled.pdf", garbage=4, deflate=True)
    clean_collection.save(dest / "illustrations-unlabeled.pdf", garbage=4, deflate=True)
    qa = ROOT / "trainer/qa"
    qa.mkdir(exist_ok=True)
    contact_sheet(previews, qa / "illustration-contact-sheet.jpg")
    contact_sheet(clean_previews, qa / "illustration-unlabeled-contact-sheet.jpg")
    (qa / "illustration-extraction-report.json").write_text(json.dumps({
        "sourceSHA256": manifest["sourceSHA256"], "figures": evidence,
    }, ensure_ascii=False, indent=2) + "\n")


def main():
    config = json.loads(REGIONS.read_text())
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == config["sourceSHA256"], "Source PDF changed: re-review extraction geometry"
    DEST.mkdir(parents=True, exist_ok=True)
    # Complete and validate the set on the same volume before replacing app assets.
    with tempfile.TemporaryDirectory(prefix=".illustrations-", dir=DEST.parent) as temp:
        staged = Path(temp)
        build(staged, config)
        assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == config["sourceSHA256"]
        for path in staged.iterdir():
            if path.name != "manifest.json":
                os.replace(path, DEST / path.name)
        os.replace(staged / "manifest.json", DEST / "manifest.json")
    print(f"Extracted 20 labeled, unlabeled and full plates to {DEST}")


if __name__ == "__main__":
    main()
