# MRI Tutor: data provenance and coverage

2026-09-06. Local educational derivatives. Source NIfTI files and source notices are retained in `assets/`. Korean explanations are authored educational content, not quoted textbook pages. The default workspace contains four individual StudyForrest research participants. The separate reference Atlas retains standard-template MRI. No clinical diagnosis or normality label is assigned to these research scans.

| Source | App use | Coordinates / transformations | Terms and attribution |
|---|---|---|---|
| [CIT168](https://github.com/niivue/niivue-demo-images/tree/main/CIT168), [Pauli, Nili & Tyszka 2018](https://www.nature.com/articles/sdata201863) | Base T1 and original 16 subcortical groups | MNI152 2009c; winner probability ≥64/255 | CC BY 4.0 |
| [AAL3](https://www.oxcns.org/aal3.html), Rolls et al. 2020; [CAT12 distribution](https://github.com/ChristianGaser/cat12/tree/main/templates_MNI152NLin2009cAsym) | Amygdala, hippocampus, ACC/PCC, insula, cortex, thalamus, vermis | CAT12 already nonlinearly registered the original Collins brain labels to MNI152NLin2009cAsym; native 1 mm labels retained | CAT12 GPL distribution notice retained in `assets/extended/CAT12-COPYING.txt`; original author references retained in `aal3.txt` |
| [CoBrALab](https://github.com/CoBrALab/atlases), CAT12 composite | Fornix/fimbria and mammillary bodies | CAT12 registered MNI152NLin2009cAsym; 0.6 mm labels retained | CC BY-NC-SA 4.0; `COBRA-LICENSE.txt`; Winterburn et al. and extra-hippocampal white-matter atlas references in `cobra.txt` |
| [Julich-Brain 3.1](https://search.kg.ebrains.eu/instances/Dataset/2eaa3dc6-a21b-41c1-b703-bf06f82adf25), Amunts et al. 2020 | Ch4 basal forebrain / NBM | CAT12 2009c distribution; IDs 225,226 | CC BY-NC-SA 4.0; `julichbrain3.txt` |
| [Harvard AAN v2](https://doi.org/10.5061/dryad.zw3r228d2), Edlow & Kinney 2023; [CANLab conversion](https://github.com/canlab/Neuroimaging_Pattern_Masks/tree/master/Atlases_and_parcellations/2023_harvard_aan_brainstem_atlas) | LC, PTg/PPTN, PAG, dorsal and median raphe | CANLab transformed to 2009c, assuming original MNI template identity. Boundaries therefore approximate. Masks thresholded ≥0.5. Paired masks separated by world x sign: the supplied PTg_L file contains both hemispheres; only its left half is retained. | CC0; complete conversion caveat and references in `assets/extended/aan/README.md` |
| [Human thalamic nuclei atlas](https://zenodo.org/records/5499504), Saranathan et al. 2021 | Anteroventral thalamic nucleus | Native 2009c 0.5 mm CAT12 cropped distribution | CC BY 4.0; `thalamic_nuclei.txt` |
| [Allen Human Reference Atlas / NiiVue conversion](https://github.com/niivue/niivue-demo-images/tree/main/Allen), Ding et al. 2016 | Claustrum; broader septal region for reference | ICBM2009b nonlinear symmetric, with its **own matching MRI and outer surface**; never overlaid on 2009c. Bilateral labels split by world x sign. | CC BY 4.0; `assets/extended/allen/README.md` |

Each displayed ROI retains a separate cropped NIfTI mask at its source voxel spacing, with unchanged world affine. Its unsmoothed marching-cubes mesh comes from that same mask. Native masks preserve overlaps, including dACC as a subset of ACC. The hidden global picking map is nearest-neighbor resampled to the matched MRI; where structures overlap it chooses the smaller physical ROI. The active selected mask has priority. A picked label is an atlas assignment, not a claim that a boundary is visible in the T1 signal.

## Operational definitions

- dACC: AAL3 supracallosal ACC, not a universal functional dACC boundary.
- dlPFC: AAL3 dorsolateral superior frontal + middle frontal gyri; broad macroanatomical proxy.
- vmPFC: AAL3 medial orbital superior frontal gyrus + rectus; proxy, with study-dependent boundaries.
- OFC: AAL3 medial/anterior/posterior/lateral OFC union.
- IPL: AAL3 inferior parietal + supramarginal + angular union.
- ACC: AAL3 subgenual + pregenual + supracallosal union; PCC separate.
- Striatum is available through caudate, putamen, and ventral-striatal NAcc, not a separate non-overlapping fourth organ.
- Globus pallidus and substantia nigra retain their component subdivisions.
- NBM uses Julich Ch4. It is not caudate nucleus.
- Raphe coverage is dorsal and median raphe only, not all B1–B9 groups.
- Lateral septal nucleus **has no isolated mask here**. Allen's broader septal region is explicitly labeled reference-only and excluded from scored localization. Ch123 is not substituted for the lateral septal nucleus.
- The network controls show major nodes and explanatory relationships. They are not tractography, individual resting-state networks, or complete circuit segmentations.

Some atlas components are subject to non-commercial/share-alike terms. This mixed-source collection is not uniformly CC BY or unrestricted commercial data. Source-specific conditions continue to apply to their derivatives. Unused SUIT/Schaefer files downloaded during source evaluation are retained as source material and are not displayed by the app.

## Installed background MRI quality audit (2026-09-06)

The default CIT168 derivative is a group-average template, not a single-person acquisition: its installed NIfTI is 165 × 198 × 168 voxels, 1 mm isotropic, uint8 (256 stored intensity levels). The Allen-matched ICBM2009b symmetric background is also a template: 318 × 388 × 310 voxels, 0.5 mm grid, uint8. Grid spacing does not establish effective anatomical resolution. Single-plane display preserves the original volume and does not reduce its sampling resolution; zooming or upsampling cannot recover individual anatomy lost through group template construction. The UI now explicitly identifies the background as a group-average template. No higher-resolution or individual MRI was substituted in this audit.


## StudyForrest individual pilot — installed and audited

Four participants (`sub-01`–`sub-04`), with three reserved for learning and one for transfer practice. All eight original T1/T2 NIfTI files were downloaded as real bytes, compared with upstream git-annex size/MD5 identifiers, and SHA-256 recorded. There are no git-annex pointers masquerading as images.

- [Official acquisition description](https://studyforrest.org/data.html): structural scans are **3T**, distinct from the project's 7T fMRI. Acquisition voxel size is reported as 0.7 mm; installed files have approximately **0.667 × 0.667 × 0.700 mm** spacing, 384 × 384 × 274 native matrix, int16 storage. Inspect each case's metadata for exact values. Stored voxel spacing is not a claim about effective spatial resolution.
- [Structural dataset DOI](https://doi.gin.g-node.org/10.12751/g-node.zdwr8e/), [source repository](https://github.com/psychoinformatics-de/studyforrest-data-structural), [annex-advertised public file mirror](https://datapub.fz-juelich.de/studyforrest/studyforrest/structural/). PDDL; full license retained as `assets/cases/structural-LICENSE.txt`.
- [Subject FreeSurfer reconstruction](https://github.com/psychoinformatics-de/studyforrest-data-freesurfer). FreeSurfer 5.3 reconstruction used T1 plus T2; source reports cortical surface QA. That is not equivalent to specialist approval of every voxel label. PDDL; `assets/cases/freesurfer-LICENSE.txt` retained.
- [FreeSurfer label definitions](https://github.com/freesurfer/freesurfer/blob/dev/distribution/FreeSurferColorLUT.txt). Subject `aparc+aseg.mgz` IDs are explicitly recorded in each reference label.

### Spatial and intensity contract

The native T1 is copied byte-for-byte into the app. Native T2 is also preserved. The viewer displays original T1 and a **float32** T2 derivative, with window/level applied only at display time. No MRI is reduced to uint8, sharpened generatively, or synthesized. The uint8 volume is a categorical reference **label** map, not an MRI intensity volume.

A voxel-order comparison of each distributed T1 and that participant's FreeSurfer `rawavg.mgz` found exact matching foreground intensities (correlation 1.0). Their conversion headers differ slightly. The recorded mapping is `canonical_T1.affine × inverse(canonical_rawavg.affine)`; apply it to the original segmentation's scanner RAS affine. This is a same-acquisition header reconciliation, not atlas-to-person warping. The segmentation stays in its conformed 1 mm grid, with the corrected affine and nearest categorical sampling in the viewer. No MNI label is put on a personal MRI.

T2 is rigidly registered to T1 with SimpleITK Euler3D / Mattes mutual information (50 bins), seeded 12% sampling, multiresolution 4/2/1 and the subject brain mask. It is sampled **once from original T2** with linear interpolation onto the original T1 grid. Each `T2-to-T1.tfm` maps fixed T1 LPS physical coordinates to moving T2 LPS sampling coordinates, as required by the resampler; its direction must not be reversed on interpretation. Parameters, stop condition and intensity metadata are preserved. The initial full metric and final sampled metric are not directly comparable quality scores.

### Review and education limits

Native-data hashes, affine round trips, all 80 reference anchors and relative hemispheric order passed automated checks. Three-plane T1/T2 contacts and left/right subject reference outlines were visually inspected by the implementation agent. Review notes and exact reviewed hashes are in each `qc-review.json`; evidence is in `qa/`. This is **developer visual QC**, not radiologist/psychiatrist voxelwise boundary adjudication.

All 44 case/task contracts are observation exercises. Reference-label status is `reference-only`, `scoreable:false`; clinical scoreable task count is zero. No certified absence or visibility answer key is invented from a bounding box. Labels have case/space/source IDs, transformation history, sequence-specific visibility caveats, boundary uncertainty and review logs. Internal capsule has no personal label; its task uses neighboring landmarks. Corpus callosum is the central FreeSurfer CC union. Lateral-ventricle labels omit the separate inferior-lateral-ventricle class and do not certify the entire temporal horn.

The ordinary T1/T2 pilot cannot certify small-nucleus boundaries or functional-network borders. [Wengler et al., neuromelanin-sensitive MRI](https://pmc.ncbi.nlm.nih.gov/articles/PMC11526017/) supports the need for appropriate contrast for SN/LC-related observation. ATAG is a future data candidate, not an installed or tested component. No clinical disease-specific interpretation is attached to these four participants.

Authored anatomical observation prompts refer to [Radiology Assistant brain anatomy](https://radiologyassistant.nl/neuroradiology/brain/anatomy), [UTHealth basal-ganglia anatomy](https://nba.uth.tmc.edu/neuroanatomy/L5/Lab05p20_index.html), and [UTHealth internal capsule](https://nba.uth.tmc.edu/neuroanatomy/L10/Lab10p01_index.html). They are original Korean prompts, not reproduced textbook figures. The user's textbook PDF and extraction results remain local and are excluded from Git.
