# Telencephalon reference illustrations

User-authorized scope (2026-09-09): add the supplied PDF's 10 axial and 10 coronal illustrations to the right inspector. Approximate section correspondence is sufficient. This supersedes the historical PLAN.md exclusion of PDF extraction for this feature.

- Render figure regions including labels, leader lines, localizers and artist credit; exclude running headers and body text. Preserve the source PDF. Produce small previews and larger images with page/figure provenance and a reproducible builder.
- Select by approximate anatomical level, not by claimed registration. Atlas uses authored approximate RAS coordinates. Individual MRI uses the bilateral thalamic anchor midpoint to offset the reference levels; no rotation, scaling or anatomical registration is claimed. Missing anchors must not silently use native coordinates as MNI.
- Offer axial/coronal cards, manual previous/next and return to automatic selection. Multiplanar view offers both orientations; sagittal view explains coverage.
- Click opens a keyboard-accessible central dialog with zoom and scrolling. Keep manual browsing inside the dialog stable. Reset on subject, plane, mode or question change. Do not expose labeled images during locked assessment; optional practice hints are recorded.
- Check all 20 crops visually, asset integrity and matching edge cases, then verify the actual browser: both viewers/orientations, automatic/manual selection, dialog, sequence/subject changes, hint locks, loading failures and mobile overflow.

## Delivered

All 20 figure crops and their previews are in `trainer/assets/illustrations/telencephalon/` (about 5.4 MB total). The reusable inspector/dialog lives in `trainer/illustrations.js` and `trainer/illustrations.css`; the pure approximation function lives in `trainer/illustration-matching.js`. Atlas and case controllers provide state, keeping matching separate from MRI rendering and assessment. The source PDF and prior worktree changes are preserved.

Validation: all 20 crops inspected in the contact sheet; asset hashes verified; 36 unit tests pass. `tests/illustrations-browser.mjs` verifies real Atlas and individual MRI controls, both orientations, three native origins, sequence changes, manual/automatic browsing, keyboard modal behavior, hint resets/transfer locks and 390px layout with no page errors. `tests/illustrations-recovery.mjs` exercises the production component with failed manifest/images, delayed plate loading, busy/missing-landmark/locked states and retry recovery. Screenshots and reports are in `trainer/qa/illustration*`. Position correspondence is deliberately approximate and has not undergone anatomical registration validation.

## Illustration isolation (2026-09-10)

User authorized processing all 20 illustrations after the axial-06 feasibility sample.

- Extract the main illustration with original anatomical labels and leaders as the default app asset. Remove the localizer, MRI inset, heading and unnecessary outer margins through explicit per-figure source coordinates. Keep source provenance and artist credit.
- Also extract the original label-free artwork, and retain the full plate as an optional contextual view. Add a compact view selector in the existing dialog.
- Preserve the source PDF and approximate MRI matching. Store reproducible geometry and record label-boundary / raster-exclusion validation. Visually inspect all 20 labeled and unlabeled results.
- Validate asset integrity and browser behavior, including variant changes, navigation, zoom, loading recovery and mobile layout. No commit or push requested.

Delivered: all 20 plates now have isolated labeled and unlabeled artwork plus original full-plate variants. Original artist credits sit in compact footers. The dialog supports all three views. All 531 label lines and original leader path geometry are retained, and source-coordinate artwork comparisons show zero pixel difference at 144 dpi. Both 20-page PDF collections and visual contact sheets are included. All 37 unit tests and the three illustration browser suites pass. See `docs/ILLUSTRATION-ISOLATION.md` for files, reproduction and verification details. This supersedes the original full-plate default and the earlier 5.4 MB asset-size note.
