#!/usr/bin/env python3
"""Render the 36 Racer Info cells directly from the original rulebook.

The output is lossless PNG. No JPEG/WebP encoding, resizing pipeline, sprite,
or extraction from the previously generated HTML is involved.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import fitz  # PyMuPDF
import requests

SOURCE_URLS = [
    "https://tesera.ru/images/items/2587383/How_to_play_Magical_Athlete_compressed.pdf",
    "https://gamers-hq.de/media/pdf/g0/6d/14/How-to-play-MAGICAL-ATHLETE.pdf",
]

CARD_IDS = [
    "alchemist", "blimp", "coach",
    "baba-yaga", "centaur", "copycat",
    "banana", "cheerleader", "dicemonger",
    "duelist", "genius", "heckler",
    "egg", "gunk", "huge-baby",
    "flip-flop", "hare", "hypnotist",
    "inchworm", "legs", "mastermind",
    "lackey", "lovable-loser", "m-o-u-t-h",
    "leaptoad", "magician", "party-animal",
    "rocket-scientist", "sisyphus", "suckerfish",
    "romantic", "skipper", "third-wheel",
    "scoocher", "stickler", "twin",
]

# Exact Racer Info grid, expressed relative to the 705.6 x 496.8 pt pages.
# Each crop includes the card, English name, flavour line, and rules note.
REFERENCE_W = 705.6
REFERENCE_H = 496.8
ROW_TOPS = (100.0, 235.0, 370.0)
ROW_BOTTOMS = (225.0, 360.0, 495.0)
PAGE_INDICES = (21, 22, 23, 24)  # printed pages 22-25
RENDER_SCALE = 4.0

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "cards"
PDF_PATH = ROOT / ".cache" / "magical-athlete-rulebook.pdf"


def download_pdf() -> str:
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": "Mozilla/5.0 (Magical Athlete Companion asset build)"}
    errors: list[str] = []
    for url in SOURCE_URLS:
        try:
            response = requests.get(url, timeout=60, headers=headers)
            response.raise_for_status()
            if not response.content.startswith(b"%PDF"):
                raise RuntimeError("response is not a PDF")
            PDF_PATH.write_bytes(response.content)
            return url
        except Exception as exc:  # try the mirror
            errors.append(f"{url}: {exc}")
    raise RuntimeError("Could not download the source rulebook:\n" + "\n".join(errors))


def crop_rect(page: fitz.Page, row: int, col: int) -> fitz.Rect:
    sx = page.rect.width / REFERENCE_W
    sy = page.rect.height / REFERENCE_H
    x0 = (REFERENCE_W / 3.0 * col) * sx
    x1 = (REFERENCE_W / 3.0 * (col + 1)) * sx
    y0 = ROW_TOPS[row] * sy
    y1 = min(ROW_BOTTOMS[row] * sy, page.rect.height)
    return fitz.Rect(x0, y0, x1, y1)


def main() -> None:
    source_url = download_pdf()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    document = fitz.open(PDF_PATH)
    if document.page_count < 25:
        raise RuntimeError(f"Unexpected rulebook page count: {document.page_count}")

    manifest: dict[str, object] = {
        "source": source_url,
        "source_pages": "22-25",
        "format": "PNG",
        "lossless": True,
        "render_scale": RENDER_SCALE,
        "cards": {},
    }

    index = 0
    for page_index in PAGE_INDICES:
        page = document.load_page(page_index)
        for row in range(3):
            for col in range(3):
                card_id = CARD_IDS[index]
                rect = crop_rect(page, row, col)
                pixmap = page.get_pixmap(
                    matrix=fitz.Matrix(RENDER_SCALE, RENDER_SCALE),
                    clip=rect,
                    alpha=False,
                    annots=False,
                )
                target = OUT_DIR / f"{card_id}.png"
                pixmap.save(target)
                data = target.read_bytes()
                if len(data) < 10_000:
                    raise RuntimeError(f"Suspiciously small render: {target} ({len(data)} bytes)")
                manifest["cards"][card_id] = {
                    "page": page_index + 1,
                    "row": row,
                    "column": col,
                    "width": pixmap.width,
                    "height": pixmap.height,
                    "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                }
                index += 1

    if index != 36:
        raise RuntimeError(f"Expected 36 images, rendered {index}")

    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Rendered {index} lossless PNG files from {source_url}")


if __name__ == "__main__":
    main()
