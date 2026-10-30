"""Minimal ComfyUI API client for the art pipeline (standard library only).

ComfyUI is an external service shared with other work: nothing here touches its folders. Images are uploaded through the API
and results are fetched through the API. Everything the game sends is namespaced under the `overseer` subfolder
(input/overseer, output/overseer) so it never mixes with other projects.
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

URL = os.environ.get('COMFY_URL', 'http://127.0.0.1:8188').rstrip('/')
SUBFOLDER = 'overseer'
SAVE_NODES = {'SaveImage', 'SaveWEBM', 'SaveAnimatedWEBP', 'SaveVideo'}


class ComfyError(RuntimeError):
    pass


def _open(req, timeout=60):
    try:
        return urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.HTTPError as e:
        raise ComfyError(f'{e.code} from ComfyUI: {e.read().decode(errors="replace")[:1200]}') from None
    except urllib.error.URLError as e:
        raise ComfyError(f'ComfyUI is not reachable at {URL} ({e.reason})') from None


def upload_image(path):
    """Upload a local image into input/overseer/ and return the name a LoadImage node expects."""
    name = os.path.basename(path)
    boundary = uuid.uuid4().hex
    body = b''
    for k, v in (('subfolder', SUBFOLDER), ('type', 'input'), ('overwrite', 'true')):
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    body += f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()
    body += open(path, 'rb').read() + f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(f'{URL}/upload/image', body, {'Content-Type': f'multipart/form-data; boundary={boundary}'})
    res = json.load(_open(req))
    return f"{res.get('subfolder') or SUBFOLDER}/{res['name']}"


def run(workflow_path, settings, out_dir, prefix, timeout=900):
    """Run an API-format workflow file with `settings` ({"node.input": value}) and save the outputs into out_dir.

    Returns the list of saved file paths. Every save node writes to output/overseer/<prefix>.
    """
    graph = json.load(open(workflow_path))['prompt']
    for key, value in settings.items():
        node, field = key.split('.', 1)
        graph[node]['inputs'][field] = value
    for node in graph.values():
        if node['class_type'] in SAVE_NODES:
            node['inputs']['filename_prefix'] = f'{SUBFOLDER}/{prefix}'
    req = urllib.request.Request(f'{URL}/prompt', json.dumps({'prompt': graph}).encode(), {'Content-Type': 'application/json'})
    pid = json.load(_open(req))['prompt_id']
    t0 = time.time()
    while True:
        hist = json.load(_open(f'{URL}/history/{pid}'))
        if pid in hist:
            break
        if time.time() - t0 > timeout:
            raise ComfyError(f'timed out after {timeout}s waiting for {workflow_path}; interrupt it with POST {URL}/interrupt')
        time.sleep(1)
    job = hist[pid]
    if job['status']['status_str'] != 'success':
        raise ComfyError('workflow failed: ' + json.dumps(job['status'])[:1500])
    os.makedirs(out_dir, exist_ok=True)
    saved = []
    for node in job['outputs'].values():
        for kind in ('images', 'videos', 'gifs'):
            for item in node.get(kind, []):
                q = urllib.parse.urlencode({'filename': item['filename'], 'subfolder': item['subfolder'], 'type': item['type']})
                dst = os.path.join(out_dir, item['filename'])
                with open(dst, 'wb') as f:
                    f.write(_open(f'{URL}/view?{q}').read())
                saved.append(dst)
    return saved
