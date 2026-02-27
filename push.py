#!/usr/bin/env python3
"""
Git Changes를 zip으로 압축하는 스크립트
"""

import os
import subprocess
import zipfile
from pathlib import Path
from datetime import datetime


def get_changed_files(repo_root):
    """ Git Changes(staged + unstaged)에 있는 파일 목록 반환 """
    result = subprocess.run(
        ['git', 'status', '--porcelain'],
        capture_output=True,
        text=True,
        encoding='utf-8',
        cwd=repo_root,
    )
    if result.returncode != 0:
        raise RuntimeError(f'git status 실패: {result.stderr}')

    files = []
    for line in result.stdout.strip().splitlines():
        if not line:
            continue
        status = line[:2].strip()
        path = line[2:].lstrip()  # status 2자 뒤 공백 건너뛰고 경로 추출 (M / 와  M 형식 모두 대응)
        if ' -> ' in path:
            path = path.split(' -> ', 1)[1].strip()
        if status.startswith('D'):
            continue
        path = path.replace('\\', '/').strip()
        if not path:
            continue
        full_path = Path(repo_root) / path
        if full_path.is_file():
            files.append(str(full_path))
    return files


def create_zip(changed_files, zip_path, repo_root):
    """ 변경된 파일들을 폴더 구조 유지하여 zip 생성 """
    repo_root = Path(repo_root)
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for filepath in changed_files:
            p = Path(filepath)
            arcname = str(p.relative_to(repo_root)).replace('\\', '/')
            zf.write(filepath, arcname)


def main():
    repo_root = Path(__file__).resolve().parent
    os.chdir(repo_root)

    project_name = repo_root.name
    changed_files = get_changed_files(repo_root)
    if not changed_files:
        print('변경된 파일이 없습니다.')
        return

    print(f'압축 대상 파일: {len(changed_files)}개')
    for f in changed_files:
        print(f'  - {f}')

    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    zip_filename = f'{project_name}_{timestamp}.zip'
    zip_path = repo_root / zip_filename

    create_zip(changed_files, zip_path, repo_root)
    print(f'\nzip 생성: {zip_path}')


if __name__ == '__main__':
    main()
