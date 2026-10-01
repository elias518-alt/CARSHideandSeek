"""Rasterize stock-model renders with depth-correct hair masks.
Requires CairoSVG and Pillow; usage: python script.py svg_folder output_folder.
"""
import io
import sys
from pathlib import Path
import cairosvg
from PIL import Image, ImageChops

source, output = map(Path, sys.argv[1:3])
output.mkdir(parents=True, exist_ok=True)
for asset in sorted(source.glob('*.svg')):
    if asset.stem.endswith('-mask'):
        continue
    image = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=asset.read_bytes()))).convert('RGBA')
    if asset.stem.endswith('-hair'):
        mask_path = asset.with_name(asset.stem + '-mask.svg')
        mask = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=mask_path.read_bytes()))).convert('RGBA')
        # The white hair is visible, black foreground facial geometry occludes
        # it. This preserves the actual 3D depth across separate image layers.
        image.putalpha(ImageChops.multiply(mask.convert('L'), mask.getchannel('A')))
    image.save(output / (asset.stem + '.webp'), 'WEBP', quality=88, method=6)
