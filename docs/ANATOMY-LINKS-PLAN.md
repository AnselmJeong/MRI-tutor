# Bilingual anatomy links in the inspector

- Annotate authored Atlas and individual-MRI inspector text with Korean (English), using a shared, curated glossary. Preserve user-entered and stored observations.
- Keep compound terms intact, expand ambiguous shorthand, and preserve existing English parentheticals.
- Make named structures actionable. Resolve only masks belonging to the displayed MRI space and current hemisphere; never substitute a parent structure for a named subpart.
- Prefer an interior point on the current native slice. If absent, move to a validated mask anchor in the same viewer. Keep the explanatory topic and selected overlay unchanged.
- Show a yellow ring that follows zoom/pan/resize and never projects onto an unrelated slice, case, or template. Only terms with registered masks in the current MRI space are links; unsupported terms remain bilingual plain text. Pre-answer exercises cannot reveal locations through links.
- Direct clicks without a registered label clear the inspector and old highlight; scrolling retains the deliberate learning target. A subsequent valid click restores selection.
- Verify text matching, anatomical mask membership, native-plane geometry, stale requests, and browser interactions including the insula relationship chain.

Known source limits: external/extreme capsule masks are absent; claustrum is available only in the matched Allen/ICBM2009b symmetric space. No unregistered points or invented capsule coordinates will be displayed.


Implementation: shared `trainer/anatomy-terms.js`, mask lookup in `anatomy-location.js`, and reprojected overlay in `anatomy-marker.js`; integrated with both Atlas and native individual-MRI viewers. Existing user observations and source image/label files are unchanged.

Validation: 33 unit tests pass. Browser checks exercise the insula/putamen chain, mask membership, preserved crosshair and teaching topic, zoom/resize alignment, absent/wrong-space masks, cleared unregistered selection, off-slice anchors, individual-mask hemisphere, case changes and pre-answer locks. Existing full browser workflow passes, including persisted reading notes, T1/T2 switching, held-out cases and 390px layout. Screenshots: `/tmp/mri-anatomy-linked.png` and `/tmp/mri-unregistered.png`.
