# Main illustration extraction

Completed 2026-09-10 for all 10 axial and 10 coronal plates in the user-supplied `Telencephalon.pdf`.

The inspector now uses the isolated labeled illustration. The enlarged dialog offers **라벨 포함**, **삽화만**, and **원본 전체**. Navigation keeps the selected view; opening the dialog again starts with labels. Each variant has its own dimensions for correct fit, zoom and aspect ratio.

Image URLs include their content hash (including a separate thumbnail hash), and manifest loads revalidate the HTTP cache. This fixes existing browser caches retaining a full-plate thumbnail after the file is replaced at the same path. An already open page must reload to load changed application code; the live Chrome session was refreshed when this was diagnosed.

## Files

`trainer/assets/illustrations/telencephalon/` contains:

- `axial-01.webp` through `axial-10.webp`, and `coronal-01.webp` through `coronal-10.webp`: labeled main figures, with small `-thumb.webp` previews.
- Matching `-unlabeled.webp` images: original artwork with no overlaid labels or leaders.
- Matching `-full.webp` images: original plates with localizers, MRI insets and headings.
- `illustrations-labeled.pdf` and `illustrations-unlabeled.pdf`: 20-page collections with figure bookmarks. Original vector annotation quality is retained in the labeled PDF.

Main figures and previews use lossless WebP. Full plates retain the prior 240 dpi / quality 92 rendering settings. Main figures render at 288 dpi; this preserves sharp PDF labels but does not invent detail beyond the embedded raster artwork. Source figure/page metadata remains in `manifest.json`, and original artist lettering is retained in a compact footer.

## Extraction

`scripts/illustration-regions.json` records source-specific rectangles and expected label lines. The source SHA-256 must match before the builder runs.

The builder creates disposable copies of each PDF page. One retains only the original raster image, including its original image transform and rendering settings. A second retains the original annotations, omitting headings and localizer text and moving the artist credit to the footer. The main raster region is placed under those annotations in the original coordinates. No generative reconstruction, inpainting, tracing, anatomical recoloring, or nonuniform scaling is used.

Some PDF text blocks combine unrelated content. In coronal 10, the right-side label “Inferior pole of lateral ventricle” shares a block with the localizer caption. Removal therefore operates on individual bold caption lines, preserving the ordinary anatomical label lines. Main sections with disconnected pieces, including axial 1 and axial 10, are retained together.

Build and verify the set before replacing app assets; source PDFs are never overwritten. Reproduce from the repository root:

```sh
uv run --with-requirements scripts/illustration-requirements.txt python scripts/build_reference_illustrations.py
npm test
node tests/illustration-variants.mjs
node tests/illustrations-browser.mjs
node tests/illustrations-recovery.mjs
```

Browser scripts expect the trainer at `http://127.0.0.1:8091/`.

## Validation

- All 20 labeled and 20 unlabeled outputs visually inspected in the contact sheets, including margins, disconnected pieces and original artist credit.
- All 531 label lines retained; all original dark leader paths retain their exact path geometry and remain inside the crop with margins.
- At 144 dpi, original versus recomposed main-artwork regions have zero RGB channel difference for all 20 figures. The original credit rectangle is excluded from comparison where it intersects the artwork bounding rectangle, since the credit moves to the footer.
- Both PDF collections contain 20 pages. Delivered PDF renders and corresponding WebP dimensions agree; PDF serialization introduces at most 2/255 channel-value difference from in-memory rendering at antialiased edges.
- 37 unit tests pass, including source/asset hashes, all variants and the coronal-10 mixed text-block case.
- Browser tests pass for all 60 figure/view combinations, correct dimensions and fitting, navigation, zoom, image retry, keyboard behavior, both MRI viewers, guided/locked states, and 390px layout.

Evidence and contact sheets: `trainer/qa/illustration-extraction-report.json`, `illustration-variants-report.json`, `illustrations-report.json`, `illustrations-recovery-report.json`, `illustration-contact-sheet.jpg`, and `illustration-unlabeled-contact-sheet.jpg`.
