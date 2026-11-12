"""把照片处理成纪念日网站需要的样子。

做三件事：
1. 把照片缩小后按顺序存成 photos/p00.jpg（大图）和 photos/t00.jpg（缩略图）。
2. 把结尾合照预先采样成马赛克数据 js/mosaic-data.js。
   （网页是双击打开的 file:// 页面，浏览器不允许 canvas 读图片像素，所以必须提前算好。）
3. 生成一张带编号的总览图，方便对照着写每张照片的小字。

用法：
    python -I prepare_photos.py --photos <照片文件夹> --site <网站文件夹> [--finale <编号或文件名>]
    python -I prepare_photos.py --demo --site <网站文件夹>      # 没有照片时先用占位图预览
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

LOG = logging.getLogger("prepare_photos")

PHOTO_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
UNSUPPORTED_SUFFIXES = {".heic", ".heif"}
FULL_SIZE = 1280
THUMB_SIZE = 420
MOSAIC_COLS, MOSAIC_ROWS = 64, 48  # 4:3，和结尾页的相框一致
SHEET_TILE, SHEET_COLS = 300, 6
DEMO_COUNT = 8
DEMO_COLORS = ["#d9482b", "#2f3f66", "#7c9a7e", "#ffd23f", "#f3b9bd", "#5a2b1c", "#3f6bd9", "#e0568a"]


def find_photos(folder: Path) -> list[Path]:
    """按文件名排序找出文件夹里（不含子文件夹）能用的照片。"""
    if not folder.is_dir():
        raise SystemExit(f"照片文件夹不存在：{folder}")
    files = sorted(p for p in folder.iterdir() if p.is_file())
    skipped = [p.name for p in files if p.suffix.lower() in UNSUPPORTED_SUFFIXES]
    if skipped:
        LOG.warning("跳过了 %d 张 HEIC 照片（先在手机或电脑上转成 JPG）：%s", len(skipped), ", ".join(skipped))
    photos = [p for p in files if p.suffix.lower() in PHOTO_SUFFIXES]
    if not photos:
        raise SystemExit(f"在 {folder} 里没有找到 jpg / png / webp 照片")
    return photos


def make_demo_photos() -> list[tuple[str, Image.Image]]:
    """生成几张带编号的纯色占位图。"""
    demo = []
    for index in range(DEMO_COUNT):
        size = (1200, 900) if index % 2 == 0 else (900, 1200)
        image = Image.new("RGB", size, DEMO_COLORS[index % len(DEMO_COLORS)])
        draw = ImageDraw.Draw(image)
        draw.ellipse((size[0] * 0.25, size[1] * 0.25, size[0] * 0.75, size[1] * 0.75), outline="white", width=14)
        draw.text((size[0] / 2, size[1] / 2), str(index), fill="white", anchor="mm", font_size=260)
        demo.append((f"占位图 {index}", image))
    return demo


def load_photos(paths: list[Path]) -> list[tuple[str, Image.Image]]:
    """读入照片并按 EXIF 摆正方向。"""
    loaded = []
    for path in paths:
        with Image.open(path) as raw:
            loaded.append((path.name, ImageOps.exif_transpose(raw).convert("RGB")))
    return loaded


def resized(image: Image.Image, limit: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((limit, limit))
    return copy


def pick_finale(photos: list[tuple[str, Image.Image]], finale: str | None) -> int:
    """--finale 可以是编号，也可以是原文件名（带不带扩展名都行）；不给就用第一张。"""
    if finale is None:
        return 0
    names = [name for name, _ in photos]
    if finale in names:
        return names.index(finale)
    stems = [Path(name).stem for name in names]
    if stems.count(finale) == 1:
        return stems.index(finale)
    if stems.count(finale) > 1:
        raise SystemExit(f"--finale {finale} 对应了不止一张照片，请写上扩展名")
    if finale.isdigit() and int(finale) < len(photos):
        return int(finale)
    raise SystemExit(f"--finale 指定的照片找不到：{finale}（可以写编号 0~{len(photos) - 1}，或原文件名）")


def write_mosaic(site: Path, image: Image.Image, index: int, count: int) -> None:
    small = ImageOps.fit(image, (MOSAIC_COLS, MOSAIC_ROWS), Image.LANCZOS)
    pixels = small.tobytes()
    hex_colors = pixels.hex()
    text = (
        f"/* 由 prepare_photos.py 生成，不要手改。换照片或换结尾合照后重新运行脚本。 */\n"
        f"window.ANNIV_MOSAIC = {{ photoCount: {count}, cols: {MOSAIC_COLS}, rows: {MOSAIC_ROWS}, "
        f'src: "photos/p{index:02d}.jpg", hex: "{hex_colors}" }};\n'
    )
    (site / "js" / "mosaic-data.js").write_text(text, encoding="utf-8", newline="\n")


def write_contact_sheet(photos: list[tuple[str, Image.Image]], out: Path) -> None:
    rows = (len(photos) + SHEET_COLS - 1) // SHEET_COLS
    sheet = Image.new("RGB", (SHEET_COLS * SHEET_TILE, rows * (SHEET_TILE + 22)), "white")
    draw = ImageDraw.Draw(sheet)
    for index, (_, image) in enumerate(photos):
        x, y = (index % SHEET_COLS) * SHEET_TILE, (index // SHEET_COLS) * (SHEET_TILE + 22)
        sheet.paste(resized(image, SHEET_TILE), (x, y))
        draw.text((x + 4, y + SHEET_TILE + 3), f"#{index}", fill="black", font_size=16)
    sheet.save(out, quality=82)


def main() -> int:
    parser = argparse.ArgumentParser(description="把照片处理成纪念日网站需要的样子")
    parser.add_argument("--site", required=True, type=Path, help="网站文件夹（里面有 index.html）")
    parser.add_argument("--photos", type=Path, help="放原始照片的文件夹")
    parser.add_argument("--finale", help="结尾合照：编号或原文件名，默认第一张")
    parser.add_argument("--demo", action="store_true", help="没有照片时，生成占位图用来预览")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)

    if not (args.site / "index.html").is_file():
        raise SystemExit(f"{args.site} 里没有 index.html，--site 应该指向复制出来的网站文件夹")
    if args.demo == bool(args.photos):
        raise SystemExit("--photos 和 --demo 二选一")

    photos = make_demo_photos() if args.demo else load_photos(find_photos(args.photos))
    finale_index = pick_finale(photos, args.finale)

    photo_dir = args.site / "photos"
    photo_dir.mkdir(exist_ok=True)
    for old in list(photo_dir.glob("p[0-9][0-9].jpg")) + list(photo_dir.glob("t[0-9][0-9].jpg")):
        old.unlink()  # 清掉上一次生成的，避免照片变少后留下旧图
    for index, (_, image) in enumerate(photos):
        resized(image, FULL_SIZE).save(photo_dir / f"p{index:02d}.jpg", quality=84)
        resized(image, THUMB_SIZE).save(photo_dir / f"t{index:02d}.jpg", quality=78)

    write_mosaic(args.site, photos[finale_index][1], finale_index, len(photos))
    sheet_path = args.site / "photos" / "_overview.jpg"
    write_contact_sheet(photos, sheet_path)

    LOG.info("处理了 %d 张照片，结尾合照是 #%d（%s）", len(photos), finale_index, photos[finale_index][0])
    LOG.info("编号对照（config.js 里 captions 的顺序就是这个顺序）：")
    for index, (name, image) in enumerate(photos):
        LOG.info("  #%d  %s  %dx%d", index, name, image.width, image.height)
    LOG.info("带编号的总览图：%s", sheet_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
