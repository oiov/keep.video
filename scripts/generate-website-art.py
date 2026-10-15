#!/usr/bin/env python3
"""Reusable Nbility image asset generator. Credentials never enter output files.

python3 scripts/nbility-image.py --manifest scripts/art-direction.json --out-dir public/media
Set NBILITY_IMAGE_API_KEY, or enter it at the hidden terminal prompt.
Re-running resumes saved tasks; it does not resubmit a paid request.
"""
import argparse
import base64
import concurrent.futures
import getpass
import io
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def api_request(base, key, path, payload=None):
    headers = {"Authorization": f"Bearer {key}", "Accept": "application/json", "User-Agent": "Nbility-Asset-Tool/1.0"}
    if payload is not None:
        headers.update({"Content-Type": "application/json", "X-New-Api-Async-Task": "true"})
    request = urllib.request.Request(base + path, data=json.dumps(payload).encode() if payload else None, headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=180) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read(2000).decode(errors="replace").replace(key, "[redacted]")
        try:
            detail = json.loads(detail).get("error", {}).get("message", "Request rejected")
        except (ValueError, AttributeError):
            detail = "Non-JSON error response"
        raise RuntimeError(f"API returned HTTP {error.code}: {detail[:200]}; submission is not automatically retried") from None


def result_image(result):
    data = result.get("data", result)
    if isinstance(data, list):
        return data[0] if data else None
    urls = data.get("image_urls") or []
    url = (urls[0] if urls else None) or data.get("result_url")
    if isinstance(url, str) and ",https://" in url:
        url = url.split(",https://", 1)[0]
    if url:
        return {"url": url}
    return None


def save_image(item, destination, max_edge=2048, quality=89):
    if item.get("b64_json"):
        raw = base64.b64decode(item["b64_json"], validate=True)
    else:
        url = item["url"]
        if url.startswith("data:image/"):
            raw = base64.b64decode(url.split(",", 1)[1], validate=True)
        else:
            if urllib.parse.urlparse(url).scheme != "https":
                raise ValueError("Output URL must use HTTPS")
            # Never send the API key to an image/CDN host.
            request = urllib.request.Request(url, headers={"User-Agent": "Nbility-Asset-Tool/1.0"})
            with urllib.request.urlopen(request, timeout=90) as response:
                raw = response.read(40 * 1024 * 1024 + 1)
            if len(raw) > 40 * 1024 * 1024:
                raise ValueError("Image exceeds the 40 MiB download limit")
    from PIL import Image
    image = Image.open(io.BytesIO(raw))
    image.thumbnail((max_edge, max_edge))
    image.convert("RGB").save(destination, "WEBP", quality=quality, method=6)
    return {"width": image.width, "height": image.height, "bytes": destination.stat().st_size}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True, help="JSON array of name, prompt, size")
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--base-url", default="https://api.nbility.ai")
    parser.add_argument("--model", default="gpt-image-2-5-sunburst")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--metadata-dir", type=Path)
    parser.add_argument("--max-edge", type=int, default=2048)
    parser.add_argument("--quality", type=int, default=89)
    args = parser.parse_args()
    jobs = json.loads(args.manifest.read_text())
    for job in jobs:
        if not job["name"].replace("-", "").isalnum() or len(job["prompt"]) > 1000:
            parser.error("Use an alphanumeric/hyphen name and a prompt of at most 1000 characters")
    if args.dry_run:
        print(json.dumps({"model": args.model, "jobs": jobs}, indent=2, ensure_ascii=False))
        return
    base = args.base_url.rstrip("/")
    if urllib.parse.urlparse(base).scheme != "https":
        parser.error("API base URL must use HTTPS")
    key = os.environ.get("NBILITY_IMAGE_API_KEY") or getpass.getpass("Nbility image key (hidden): ")
    if not key:
        parser.error("Missing API key")
    args.out_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir = args.metadata_dir or args.out_dir
    metadata_dir.mkdir(parents=True, exist_ok=True)
    def run_job(job):
        destination = args.out_dir / f'{job["name"]}.webp'
        state_file = metadata_dir / f'{job["name"]}.json'
        if destination.exists():
            print(f'Skipping completed image: {job["name"]}', flush=True)
            return
        state = json.loads(state_file.read_text()) if state_file.exists() else {**job, "model": args.model}
        if state.get("submission") == "uncertain" and not state.get("task_id"):
            raise RuntimeError(f'{job["name"]}: previous submission uncertain. Check upstream before starting a new request.')
        if not state.get("task_id"):
            state["submission"] = "uncertain"
            state_file.write_text(json.dumps(state, indent=2, ensure_ascii=False))
            result = api_request(base, key, "/v1/images/generations", {
                "model": args.model, "prompt": job["prompt"], "n": 1,
                "size": job.get("size", "1536x1024"), "quality": "high", "response_format": "url",
            })
            data = result.get("data", {})
            state["task_id"] = data.get("task_id") if isinstance(data, dict) else None
            state["submission"] = "accepted"
            state["result"] = result
            state_file.write_text(json.dumps(state, indent=2, ensure_ascii=False))
            print(f'Submitted {job["name"]}: {state.get("task_id") or "synchronous result"}', flush=True)
        deadline = time.monotonic() + 1800
        result = state.get("result", {})
        while not result_image(result):
            if not state.get("task_id"):
                raise RuntimeError("No task ID or image in response; inspect saved state without resubmitting")
            if time.monotonic() > deadline:
                raise RuntimeError("Polling time limit reached; re-run to resume the same task")
            time.sleep(15)
            for attempt in range(5):
                try:
                    result = api_request(base, key, "/v1/images/tasks/" + urllib.parse.quote(state["task_id"], safe=""))
                    break
                except (RuntimeError, OSError):
                    if attempt == 4:
                        raise
                    time.sleep(3 + attempt * 2)
            data = result.get("data", result)
            status = str(data.get("status", "unknown")).lower()
            print(f'{job["name"]}: {status}', flush=True)
            state["result"] = result
            state_file.write_text(json.dumps(state, indent=2, ensure_ascii=False))
            if status in ("failed", "failure", "cancelled", "canceled"):
                raise RuntimeError("Image task failed. See upstream task; no automatic paid retry.")
        for attempt in range(5):
            try:
                state.update(save_image(result_image(result), destination, args.max_edge, args.quality))
                break
            except (ValueError, OSError):
                if attempt == 4:
                    raise
                time.sleep(3 + attempt * 2)
        state["file"] = destination.name
        state.pop("result", None)
        state_file.write_text(json.dumps(state, indent=2, ensure_ascii=False))
        print(f'Saved {destination} ({state["bytes"]:,} bytes)', flush=True)

    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(16, args.workers))) as pool:
        tasks = {pool.submit(run_job, job): job['name'] for job in jobs}
        for future in concurrent.futures.as_completed(tasks):
            try:
                future.result()
            except Exception as error:
                name = tasks[future]
                failures.append(name)
                print(f"Failed {name}: {str(error).replace(key, '[redacted]')[:250]}", flush=True)
    print(json.dumps({"jobs": len(jobs), "failed": failures}, ensure_ascii=False), flush=True)
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, OSError) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
