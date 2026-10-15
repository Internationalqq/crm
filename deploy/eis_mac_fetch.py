"""Fetch public EIS documents on the existing Mac, with verified HTTPS and a cache."""
import hashlib
import json
import ssl
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

ROOT_URL = 'https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt'
ROOT_SHA256 = 'd26d2d0231b7c39f92cc738512ba54103519e4405d68b5bd703e9788ca8ecf31'
MAX_FILE = 128 * 1024 * 1024
MAX_TOTAL = 512 * 1024 * 1024


def validate_url(url):
    parsed = urlsplit(url)
    host = (parsed.hostname or '').lower()
    if (parsed.scheme != 'https' or host != 'zakupki.gov.ru'
            or parsed.username or parsed.password or parsed.port not in (None, 443)
            or not parsed.path.startswith(('/epz/', '/44fz/filestore/public/'))):
        raise ValueError('Only public HTTPS EIS URLs are accepted')
    return url


class EISRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def verified_opener(certificate):
    pem = Path(certificate).read_text(encoding='ascii')
    der = ssl.PEM_cert_to_DER_cert(pem)
    digest = hashlib.sha256(der).hexdigest()
    if digest != ROOT_SHA256:
        raise ValueError('Unexpected official CA certificate')
    context = ssl.create_default_context()
    context.load_verify_locations(cadata=ssl.DER_cert_to_PEM_cert(der))
    return urllib.request.build_opener(EISRedirect(), urllib.request.HTTPSHandler(context=context))


def atomic_json(path, value):
    staged = path.with_suffix('.tmp')
    staged.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    staged.replace(path)


def _download_one(url, staged, certificate, limit):
    opener = verified_opener(certificate)
    request = urllib.request.Request(validate_url(url), headers={'User-Agent': 'Mozilla/5.0'})
    size, digest = 0, hashlib.sha256()
    with opener.open(request, timeout=60) as response, Path(staged).open('wb') as output:
        validate_url(response.url)
        if response.status != 200:
            raise ValueError('Expected a whole document, HTTP 200')
        declared = response.headers.get('Content-Length')
        if declared and not 0 <= int(declared) <= limit:
            raise ValueError('Document exceeds byte limit')
        headers = {key: response.headers.get(key, '') for key in
                   ('content-type', 'content-disposition', 'content-length')}
        while chunk := response.read(65536):
            size += len(chunk)
            if size > limit:
                raise ValueError('Document exceeds byte limit')
            digest.update(chunk)
            output.write(chunk)
        if not size or (declared and size != int(declared)):
            raise ValueError('Empty or incomplete source document')
    return {'headers': headers, 'size_bytes': size, 'sha256': digest.hexdigest()}


def _run_download(url, staged, certificate, remaining, limit):
    # A child deadline also stops peers that trickle bytes below a socket timeout.
    result = subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), '--one', url,
         str(staged), str(certificate), str(limit)],
        capture_output=True, text=True, check=True, timeout=min(90, remaining))
    return json.loads(result.stdout)


def fetch_documents(links, folder, certificate):
    if not 1 <= len(links) <= 100 or len({x['url'] for x in links}) != len(links):
        raise ValueError('Expected 1–100 unique documents')
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    journal = folder / 'download-manifest.json'
    previous = json.loads(journal.read_text(encoding='utf-8')) if journal.exists() else []
    cached = {row['url']: row for row in previous}
    verified_opener(certificate)
    rows, total = [], 0
    deadline = time.monotonic() + 600
    for link in links:
        url = validate_url(link['url'])
        name = hashlib.sha256(url.encode()).hexdigest() + '.source'
        path = folder / name
        sidecar = path.with_suffix('.json')
        old = cached.get(url)
        if not old and sidecar.exists():
            old = json.loads(sidecar.read_text(encoding='utf-8'))
        if path.is_symlink():
            raise ValueError('Refusing a symlink in the document cache')
        if (old and old['url'] == url and path.is_file()
                and 0 < path.stat().st_size == old['size_bytes'] <= MAX_FILE
                and hashlib.sha256(path.read_bytes()).hexdigest() == old['sha256']):
            rows.append(old)
            total += old['size_bytes']
            if total > MAX_TOTAL:
                raise ValueError('Document bundle exceeds 512 MiB')
            continue
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Document bundle deadline exceeded')
        staged = path.with_suffix('.part')
        try:
            result = _run_download(url, staged, certificate, remaining, min(MAX_FILE, MAX_TOTAL - total))
            staged.replace(path)
        finally:
            staged.unlink(missing_ok=True)
        total += result['size_bytes']
        rows.append({'url': url, 'name': link.get('name', ''), 'file': name,
                     **result})
        atomic_json(sidecar, rows[-1])
        atomic_json(journal, rows)
    atomic_json(journal, rows)
    return rows


if __name__ == '__main__':
    if len(sys.argv) != 6 or sys.argv[1] != '--one':
        raise SystemExit('Internal verified download worker')
    print(json.dumps(_download_one(sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]))))
