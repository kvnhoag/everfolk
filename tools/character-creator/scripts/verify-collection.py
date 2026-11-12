"""Independent QA of delivered PNG/OpenRaster files (requires Pillow)."""
import io
import json
import pathlib
import zipfile
import xml.etree.ElementTree as ET
from PIL import Image, ImageChops

root = pathlib.Path(__file__).resolve().parents[1] / 'nft-collection'
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
checked = 0
for character in manifest['characters']:
    for source, merged, size in [(character['layeredCard'], character['card'], (480, 640))] + [
        (view['layered'], view['path'], (64, 96)) for view in character['views']
    ] + [
        (variant['layeredCard'], variant['path'], (480, 640)) for variant in character['rarityVariants']
    ]:
        with zipfile.ZipFile(root / source) as archive:
            assert archive.testzip() is None, source
            assert archive.infolist()[0].filename == 'mimetype', source
            assert archive.infolist()[0].compress_type == zipfile.ZIP_STORED, source
            assert archive.read('mimetype') == b'image/openraster', source
            stack = ET.fromstring(archive.read('stack.xml'))
            assert (int(stack.get('w')), int(stack.get('h'))) == size
            composed = Image.new('RGBA', size)
            for layer in reversed(list(stack.find('stack'))):
                layer_image = Image.open(io.BytesIO(archive.read(layer.get('src')))).convert('RGBA')
                assert layer_image.size == size
                composed = Image.alpha_composite(composed, layer_image)
            expected = Image.open(root / merged).convert('RGBA')
            embedded = Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA')
            assert ImageChops.difference(composed, expected).getbbox() is None, source
            assert composed.tobytes() == expected.tobytes() == embedded.tobytes(), source
            checked += 1
    for view in character['views']:
        sprite = Image.open(root / view['path']).convert('RGBA')
        assert set(sprite.getchannel('A').tobytes()) <= {0, 255}
        assert sprite.getbbox() is not None
    for variant in character['rarityVariants']:
        assert Image.open(root / variant['path']).size == (480, 640)
        assert Image.open(root / variant['background']).size == (240, 190)
with zipfile.ZipFile(root / 'collection.zip') as archive:
    assert archive.testzip() is None
    for name in archive.namelist():
        assert archive.read(name) == (root / name).read_bytes(), name
sprites = sum(len(character['views']) for character in manifest['characters'])
previews = sum(len(character['rarityVariants']) for character in manifest['characters'])
print(f'PASS: {checked} OpenRaster files reconstruct exactly; {sprites} sprites, {previews} rarity previews and complete ZIP verified.')
