#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
"""Pack a directory into a timezone-independent ZIP."""
from __future__ import annotations

import argparse
import time
import zipfile
from pathlib import Path


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--root", required=True, help="directory whose contents are packed")
    p.add_argument("--out", required=True)
    p.add_argument("--epoch", required=True, type=int)
    p.add_argument(
        "--prefix",
        default="",
        help="optional path prefix inside the archive (e.g. alberich-web)",
    )
    args = p.parse_args()
    root = Path(args.root).resolve()
    files = sorted(path for path in root.rglob("*") if path.is_file())
    gm = time.gmtime(args.epoch)
    date_time = (gm.tm_year, gm.tm_mon, gm.tm_mday, gm.tm_hour, gm.tm_min, gm.tm_sec)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in files:
            rel = path.relative_to(root).as_posix()
            name = f"{args.prefix.rstrip('/')}/{rel}" if args.prefix else rel
            info = zipfile.ZipInfo(filename=name, date_time=date_time)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            zf.writestr(info, path.read_bytes())


if __name__ == "__main__":
    main()
