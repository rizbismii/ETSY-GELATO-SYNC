#!/usr/bin/env python3
"""POST current public print files onto every Gelato Etsy-store variant."""

import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
ECOM = "https://ecommerce.gelatoapis.com/v1"


def call(key: str, method: str, url: str, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-API-KEY": key,
            "User-Agent": UA,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read().decode()
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()[:400]


def versioned(origin: str, path: str) -> str:
    file = ROOT / "public" / path.lstrip("/")
    version = str(int(file.stat().st_mtime * 1000)) if file.exists() else str(int(time.time() * 1000))
    return f"{origin}{path}?v={version}"


def gelato_key() -> str:
    env = os.environ.get("GELATO_API_KEY", "").strip()
    if env:
        return env
    path = ROOT / "data" / "credentials.json"
    if not path.exists():
        raise SystemExit("Save a Gelato API key on Connections (or set GELATO_API_KEY), then rerun.")
    creds = json.loads(path.read_text())
    key = (creds.get("gelatoApiKey") or "").strip()
    if not key:
        raise SystemExit("data/credentials.json has no gelatoApiKey")
    return key


def public_origin() -> str:
    env = (os.environ.get("ETSY_PUBLIC_ORIGIN") or os.environ.get("NEXT_PUBLIC_APP_URL") or "").strip()
    if env:
        return env.rstrip("/")
    path = ROOT / "data" / "public-origin.json"
    if not path.exists():
        raise SystemExit("Start the desk (`npm run desk`) so the public tunnel origin is saved, or set ETSY_PUBLIC_ORIGIN.")
    origin = json.loads(path.read_text()).get("origin") or ""
    if not origin:
        raise SystemExit("data/public-origin.json has no origin")
    return origin.rstrip("/")


def gelato_store_id(key: str) -> str:
    override = os.environ.get("GELATO_STORE_ID", "").strip()
    if override:
        return override
    status, body = call(key, "GET", f"{ECOM}/stores")
    stores = body.get("stores", body) if isinstance(body, dict) else body
    if not isinstance(stores, list) or not stores:
        raise SystemExit(f"Could not list Gelato stores ({status}): {body}")
    etsy = next((row for row in stores if isinstance(row, dict) and str(row.get("type", "")).lower() == "etsy"), None)
    chosen = etsy or next((row for row in stores if isinstance(row, dict) and row.get("id")), None)
    if not chosen or not chosen.get("id"):
        raise SystemExit("No Gelato ecommerce store is connected")
    print("store", chosen.get("id"), chosen.get("name") or chosen.get("type") or "")
    return chosen["id"]


def main() -> None:
    key = gelato_key()
    origin = public_origin()
    store_id = gelato_store_id(key)
    src = (ROOT / "src" / "lib" / "live-catalog.ts").read_text()
    ids = re.findall(r'^\s+(live_[a-z0-9_]+): \{ storeProductId: "([^"]+)"', src, re.M)
    id_to_print = {}
    for block in re.split(r"\n  item\(\{", src):
        mid = re.search(r'id: "(live_[^"]+)"', block)
        print_file = re.search(r'printFileUrl: "([^"]+)"', block)
        if mid and print_file:
            id_to_print[mid.group(1)] = print_file.group(1)
    store_to_print = {sid: id_to_print[pid] for pid, sid in ids if pid in id_to_print}
    print("mapped", len(store_to_print), "origin", origin)

    ok = fail = 0
    samples = []
    for sid, path in store_to_print.items():
        print_url = versioned(origin, path)
        status, product = call(key, "GET", f"{ECOM}/stores/{store_id}/products/{sid}")
        if status != 200 or not isinstance(product, dict):
            print("MISS product", sid, status, str(product)[:120])
            fail += 1
            continue
        variants = product.get("variants") or []
        print(product.get("title"), "variants", len(variants), path)
        for variant in variants:
            vid = variant["id"]
            uid = variant.get("productUid")
            base = f"{ECOM}/stores/{store_id}/products/{sid}/variants/{vid}"
            put_st, _put_body = call(
                key,
                "PUT",
                base,
                {
                    "productUid": uid,
                    "fileUrl": print_url,
                    "files": [{"type": "default", "url": print_url}],
                    "connectionStatus": "connected",
                },
            )
            files_url = f"{base}/print-files"
            _gst, listing = call(key, "GET", files_url)
            files = (listing.get("files") if isinstance(listing, dict) else None) or []
            for row in files:
                if row.get("type") and row.get("type") != "default":
                    continue
                call(key, "DELETE", f"{files_url}/{row['id']}")
            post_st, pres = call(key, "POST", files_url, {"fileUrl": print_url, "type": "default"})
            if put_st >= 300 or post_st >= 300:
                print("  FAIL", variant.get("title"), put_st, post_st, str(pres)[:160])
                fail += 1
            else:
                ok += 1
                title = product.get("title") or ""
                if len(samples) < 3 and any(word in title for word in ("Hoodie", "Tee", "Sweatshirt")):
                    _gst2, listing2 = call(key, "GET", files_url)
                    files2 = (listing2.get("files") if isinstance(listing2, dict) else None) or []
                    samples.append((title, variant.get("title"), files2[:1], print_url))
            time.sleep(0.05)
    print("DONE ok", ok, "fail", fail)
    for row in samples:
        print("SAMPLE", json.dumps(row, default=str)[:600])


if __name__ == "__main__":
    main()
