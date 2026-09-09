"""Build immutable, hash-bound subject GLBs; never modify source images or masks.

uv run --with-requirements scripts/subject-mesh-requirements.txt python scripts/build_subject_meshes.py
GLB positions use meters (glTF); the viewer explicitly converts them to RAS mm.
No template registration, header correction, smoothing or decimation is repeated.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import tempfile

import nibabel as nib
import numpy as np
import scipy
from scipy import ndimage
import skimage
from skimage.measure import marching_cubes

ROOT = Path(__file__).resolve().parents[1]
TRAINER = ROOT / 'trainer'
PACKS = TRAINER / 'assets/packs/subject-core'
CORE = {'hippocampus', 'amygdala', 'caudate', 'putamen', 'thalamus',
        'pallidum', 'ventricle', 'third-ventricle', 'temporal-horn', 'fourth-ventricle'}
NAMES = {'hippocampus': ('해마', 'Hippocampus'), 'amygdala': ('편도체', 'Amygdala'),
         'caudate': ('꼬리핵', 'Caudate'), 'putamen': ('조가비핵', 'Putamen'),
         'thalamus': ('시상', 'Thalamus'), 'pallidum': ('담창구', 'Pallidum'),
         'ventricle': ('측뇌실', 'Lateral ventricle'), 'third-ventricle': ('제3뇌실', 'Third ventricle'),
         'temporal-horn': ('측두각', 'Temporal horn'), 'fourth-ventricle': ('제4뇌실', 'Fourth ventricle')}


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n')


def glb(vertices_mm, faces, extras):
    positions = np.asarray(vertices_mm / 1000, dtype='<f4')
    indices = np.asarray(faces, dtype='<u4')
    binary = positions.tobytes() + indices.tobytes()
    doc = {'asset': {'version': '2.0', 'generator': 'MRI-Tutor subject-core/1'},
           'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'extras': extras}],
           'meshes': [{'primitives': [{'attributes': {'POSITION': 0}, 'indices': 1, 'mode': 4}]}],
           'buffers': [{'byteLength': len(binary)}],
           'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': positions.nbytes, 'target': 34962},
                           {'buffer': 0, 'byteOffset': positions.nbytes, 'byteLength': indices.nbytes, 'target': 34963}],
           'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': len(positions), 'type': 'VEC3',
                          'min': positions.min(0).tolist(), 'max': positions.max(0).tolist()},
                         {'bufferView': 1, 'componentType': 5125, 'count': indices.size, 'type': 'SCALAR'}]}
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    return struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(binary)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary


def build_case(c, folder, version):
    source_files = {TRAINER / c['segmentation']['url']: c['segmentation']['sha256']}
    for s in c['sequences'].values():
        source_files[TRAINER / s['url']] = s['sha256']
    native_t2 = TRAINER / f"assets/cases/{c['id']}/T2w-native.nii.gz"
    source_files[native_t2] = c['sequences']['T2w']['native']['sha256']
    for path, expected in source_files.items():
        if sha(path) != expected:
            raise ValueError(f'Source hash mismatch: {path}')
    source = nib.load(TRAINER / c['segmentation']['url'])
    labels = np.asarray(source.dataobj)
    space = f"subject:{c['id']}:T1-native-RAS-mm"
    volumes = []
    for seq, s in c['sequences'].items():
        img = nib.load(TRAINER / s['url'])
        volumes.append({'id': seq, 'spaceId': space, 'shape': s['shape'], 'voxelToWorld': img.affine.tolist(),
                        'dtype': str(img.get_data_dtype()), 'slope': img.dataobj.slope, 'intercept': img.dataobj.inter,
                        'sourceHash': s['sha256'], 'acquisitionSpacing': s['acquisition_voxel_size']})
    pack = {'schemaVersion': 2, 'id': 'subject-core', 'version': version, 'caseId': c['id'],
            'space': {'id': space, 'unit': 'mm', 'axisConvention': 'RAS', 'referenceImageHash': c['sequences']['T1w']['sha256']},
            'volumes': volumes, 'structures': [], 'representations': [], 'transforms': [], 'reviews': [],
            'provenance': {'source': c['source_url'], 'sourceVersion': 'StudyForrest FreeSurfer 5.3',
                           'license': 'PDDL', 'licenseFiles': ['structural-LICENSE.txt', 'freesurfer-LICENSE.txt'],
                           'tools': {'nibabel': nib.__version__, 'numpy': np.__version__, 'scipy': scipy.__version__, 'scikit-image': skimage.__version__},
                           'changes': ['Cropped each label; marching cubes at 0.5; existing label affine applied once; meters in GLB. No smoothing or decimation.']}}
    dest = folder / c['id']
    dest.mkdir()
    for label in c['segmentation']['labels']:
        if label['structure'] not in CORE:
            continue
        voxels = np.argwhere(labels == label['id'])
        if len(voxels) != label['voxel_count']:
            raise ValueError('Label membership changed')
        anchor_vox = np.rint(nib.affines.apply_affine(np.linalg.inv(source.affine), label['anchor'])).astype(int)
        if np.any(anchor_vox < 0) or np.any(anchor_vox >= labels.shape) or labels[tuple(anchor_vox)] != label['id']:
            raise ValueError('Anchor outside reference mask')
        lo, hi = voxels.min(0), voxels.max(0) + 1
        crop = labels[tuple(slice(a, b) for a, b in zip(lo, hi))] == label['id']
        verts, faces, _, _ = marching_cubes(np.pad(crop, 1).astype(np.float32), level=.5, allow_degenerate=False)
        verts = nib.affines.apply_affine(source.affine, verts + lo - 1)
        # Outward winding, including reflected input affines. Marching cubes default
        # winding is not assumed to survive a negative-determinant world transform.
        signed_volume = np.einsum('ij,ij->i', verts[faces[:, 0]], np.cross(verts[faces[:, 1]], verts[faces[:, 2]])).sum() / 6
        if signed_volume < 0:
            faces = faces[:, [0, 2, 1]]
        concept = f"anatomy:{label['structure']}:{label['side']}"
        representation = f"{c['id']}:freesurfer-5.3:{label['id']}"
        metadata = {'structureId': concept, 'representationId': representation, 'caseId': c['id'], 'spaceId': space, 'unit': 'm'}
        path = dest / f"{label['structure']}-{label['side']}.glb"
        path.write_bytes(glb(verts, faces, metadata))
        decoded = np.asarray(verts / 1000, dtype=np.float32).astype(float) * 1000
        error = float(np.linalg.norm(decoded - verts, axis=1).max())
        if error > .001:
            raise ValueError('GLB precision gate failed')
        mesh = {'url': f'assets/packs/subject-core/{version}/{c["id"]}/{path.name}', 'sha256': sha(path), 'bytes': path.stat().st_size, 'unit': 'm'}
        ko, en = NAMES[label['structure']]
        pack['structures'].append({'id': concept, 'topicId': label['structure'], 'ko': ko, 'en': en,
                                    'synonyms': ['미상핵'] if label['structure'] == 'caudate' else [], 'side': label['side'],
                                    'definition': 'Concept link; boundary is the named FreeSurfer label, not other atlas definitions.', 'version': 1})
        pack['representations'].append({**metadata, 'id': representation, 'kind': 'subject-segmentation',
            'labelId': label['id'], 'sourceLabelIds': label['source_ids'], 'reviewStatus': 'unreviewed', 'assessmentUse': 'reference-only',
            'referenceMask': {'url': c['segmentation']['url'], 'sha256': c['segmentation']['sha256'], 'voxelToWorld': source.affine.tolist()},
            'mesh': mesh, 'referenceSurface': mesh, 'lod': [], 'bounds': [decoded.min(0).tolist(), decoded.max(0).tolist()],
            'interiorAnchor': label['anchor'], 'qa': {'anchorInsideMask': True, 'voxelCount': len(voxels),
                'components': ndimage.label(crop)[1], 'vertices': len(verts), 'triangles': len(faces), 'outwardWinding': True,
                'displayVsReferenceMaxMm': error, 'displayVsReferenceVolumeChange': 0,
                'referenceSurfaceVolumeMm3': abs(float(signed_volume)), 'smoothing': 'none', 'decimation': 'none'}})
    for path, expected in source_files.items():
        if sha(path) != expected:
            raise ValueError(f'Source changed during generation: {path}')
    write_json(dest / 'manifest.json', pack)
    return {'caseId': c['id'], 'url': f'assets/packs/subject-core/{version}/{c["id"]}/manifest.json',
            'sha256': sha(dest / 'manifest.json'), 'representations': len(pack['representations'])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', default='1')
    args = parser.parse_args()
    if not args.version.replace('-', '').isalnum():
        parser.error('Version must be a single alphanumeric path component')
    PACKS.mkdir(parents=True, exist_ok=True)
    final = PACKS / args.version
    if final.exists():
        raise SystemExit('Immutable version exists; choose a new --version.')
    stage = Path(tempfile.mkdtemp(prefix='.staging-', dir=PACKS))
    try:
        cases = json.loads((TRAINER / 'assets/cases/manifest.json').read_text())['cases']
        entries = []
        for c in cases:
            entries.append(build_case(c, stage, args.version))
            print(c['id'], entries[-1]['representations'], 'verified GLBs', flush=True)
        for name in ['structural-LICENSE.txt', 'freesurfer-LICENSE.txt']:
            shutil.copyfile(TRAINER / 'assets/cases' / name, stage / name)
        os.replace(stage, final)
        # Publish only after every case and preserved source has passed.
        temp_index = PACKS / '.current.json.tmp'
        write_json(temp_index, {'schemaVersion': 2, 'packId': 'subject-core', 'version': args.version, 'cases': entries})
        os.replace(temp_index, PACKS / 'current.json')
    finally:
        if stage.exists():
            shutil.rmtree(stage)


if __name__ == '__main__':
    main()
