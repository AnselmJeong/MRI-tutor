"""Fetch intact public StudyForrest files; verify git-annex hashes before publishing."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib, re, urllib.request, json, time
ROOT = Path(__file__).resolve().parents[1] / 'trainer/assets/cases/source'
BASE = 'https://datapub.fz-juelich.de/studyforrest/studyforrest/'

def fetch(job):
    repo, rel = job
    target = ROOT / repo / rel
    pointer_url = f'https://raw.githubusercontent.com/psychoinformatics-de/studyforrest-data-{repo}/master/{rel}'
    pointer = urllib.request.urlopen(pointer_url, timeout=45).read().decode()
    match = re.search(r'(MD5E|SHA256E)-s(\d+)--([a-f0-9]+)', pointer)
    if not match: raise ValueError(f'No annex hash: {rel}')
    kind, size, digest = match.groups()
    algorithm = 'md5' if kind == 'MD5E' else 'sha256'
    def valid(path): return path.exists() and path.stat().st_size == int(size) and hashlib.new(algorithm, path.read_bytes()).hexdigest() == digest
    target.parent.mkdir(parents=True, exist_ok=True)
    url = BASE + repo + '/' + rel
    if not valid(target):
        temp = target.with_suffix(target.suffix + '.part')
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=90) as response, temp.open('wb') as out:
                    while block := response.read(1024*1024): out.write(block)
                if not valid(temp): raise ValueError(f'Checksum failed: {rel}')
                temp.replace(target)
                break
            except Exception:
                if attempt == 2: raise
                time.sleep(2)
    sha = hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_name(target.name + '.provenance.json').write_text(json.dumps({'url':url,'pointer_url':pointer_url,'annex_hash':digest,'annex_algorithm':algorithm,'bytes':int(size),'sha256':sha},indent=2))
    print(f'Verified {repo}/{rel} {size} bytes', flush=True)

if __name__ == '__main__':
    jobs=[]
    for sid in ['sub-01','sub-02','sub-03','sub-04']:
        jobs += [('structural',f'{sid}/anat/{sid}_{seq}.{ext}') for seq in ['T1w','T2w'] for ext in ['nii.gz','json']]
        jobs += [('freesurfer',f'{sid}/mri/{name}.mgz') for name in ['aparc+aseg','rawavg']]
    with ThreadPoolExecutor(max_workers=4) as pool: list(pool.map(fetch, jobs))
    for repo in ['structural','freesurfer']:
        for name in ['LICENSE','README.md']:
            (ROOT/repo/name).write_bytes(urllib.request.urlopen(f'https://raw.githubusercontent.com/psychoinformatics-de/studyforrest-data-{repo}/master/{name}', timeout=30).read())
