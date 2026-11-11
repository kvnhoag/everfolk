"""Rebuild the approved Eczar 600 wordmark, offline from the bundled source TTF."""
from pathlib import Path
from base64 import b64encode
from hashlib import sha256
from math import ceil
from random import Random
import json
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
ASSETS = PROJECT / 'public' / 'assets' / 'branding'
ASSETS.mkdir(parents=True, exist_ok=True)
FONT_PATH = ROOT / 'Eczar-variable.ttf'
font = instantiateVariableFont(TTFont(FONT_PATH), {'wght': 600}, inplace=False)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font['head'].unitsPerEm
TRACKING = -.025 * upm


def pair_adjustment(left, right):
    """Apply Eczar's Latin GPOS pair kerning, matching browser text shaping."""
    table = font['GPOS'].table
    indices = next(r.Feature.LookupListIndex for r in table.FeatureList.FeatureRecord if r.FeatureTag == 'kern')
    total = 0
    for index in indices:
        for sub in table.LookupList.Lookup[index].SubTable:
            if left not in sub.Coverage.glyphs:
                continue
            value = None
            if sub.Format == 1:
                pair_set = sub.PairSet[sub.Coverage.glyphs.index(left)]
                record = next((r for r in pair_set.PairValueRecord if r.SecondGlyph == right), None)
                if record is None:
                    continue
                value = record.Value1
            elif sub.Format == 2:
                c1 = sub.ClassDef1.classDefs.get(left, 0)
                c2 = sub.ClassDef2.classDefs.get(right, 0)
                value = sub.Class1Record[c1].Class2Record[c2].Value1
            if value:
                total += getattr(value, 'XAdvance', 0)
            break
    return total


outlines = []
cursor = 0
text = 'Everfolk.'
for i, char in enumerate(text):
    name = cmap[ord(char)]
    pen = SVGPathPen(glyphs)
    glyphs[name].draw(pen)
    bounds_pen = BoundsPen(glyphs)
    glyphs[name].draw(bounds_pen)
    bounds = bounds_pen.bounds
    outlines.append({'character': char, 'path': pen.getCommands(), 'x': cursor, 'bounds': bounds})
    cursor += font['hmtx'].metrics[name][0]
    if i < len(text)-1:
        cursor += TRACKING + pair_adjustment(name, cmap[ord(text[i+1])])

left = min(g['x'] + g['bounds'][0] for g in outlines)
right = max(g['x'] + g['bounds'][2] for g in outlines)
bottom = min(g['bounds'][1] for g in outlines)
top = max(g['bounds'][3] for g in outlines)
padding = 55
width = right-left + padding*2
height = top-bottom + padding*2
viewbox = f'0 0 {width:g} {height:g}'


def speckle_mask():
    rng = Random(20261111)
    shapes = [f'<rect width="{width:g}" height="{height:g}" fill="white"/>']
    for i in range(270):
        x, y = rng.uniform(padding, width-padding), rng.uniform(padding, height-padding)
        rx, ry = rng.uniform(2, 7), rng.uniform(2, 9)
        alpha = rng.uniform(.16, .48)
        shapes.append(f'<ellipse cx="{x:.2f}" cy="{y:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="black" opacity="{alpha:.3f}"/>')
    return ''.join(shapes)


def make_svg(ink, clay, textured=True):
    mask = f'<defs><mask id="ink-grain" maskUnits="userSpaceOnUse" x="0" y="0" width="{width:g}" height="{height:g}">{speckle_mask()}</mask></defs>' if textured else ''
    group = '<g mask="url(#ink-grain)">' if textured else '<g>'
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="{round(1280*height/width)}" viewBox="{viewbox}" role="img" aria-labelledby="title"><title id="title">Everfolk.</title>', mask, group]
    for glyph in outlines:
        color = clay if glyph['character'] == '.' else ink
        parts.append(f'<path fill="{color}" transform="translate({glyph["x"]-left+padding:g} {top+padding:g}) scale(1 -1)" d="{glyph["path"]}"/>')
    return ''.join(parts) + '</g></svg>\n'


for tone, ink, clay in [('cream','#e7e0c9','#db9c78'),('ink','#284744','#9b553e')]:
    (ASSETS / f'everfolk-wordmark-{tone}.svg').write_text(make_svg(ink, clay), encoding='utf-8')
    (ASSETS / f'everfolk-wordmark-{tone}-clean.svg').write_text(make_svg(ink, clay, False), encoding='utf-8')

# Small-icon companion: the same outlined E and full-stop, with a dark backing
# so the cream lettering remains readable in both light and dark browser chrome.
initial, stop = outlines[0], outlines[-1]
initial_scale = 41 / (initial['bounds'][3]-initial['bounds'][1])
ix = 11 - initial['bounds'][0]*initial_scale
iy = 51 + initial['bounds'][1]*initial_scale
stop_scale = 8 / (stop['bounds'][2]-stop['bounds'][0])
sx = 51 - (stop['bounds'][0]+stop['bounds'][2])/2*stop_scale
sy = 49 + (stop['bounds'][1]+stop['bounds'][3])/2*stop_scale
monogram = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-labelledby="title"><title id="title">Everfolk</title><rect width="64" height="64" rx="10" fill="#284744"/><path fill="#e7e0c9" transform="translate({ix:g} {iy:g}) scale({initial_scale:g} {-initial_scale:g})" d="{initial["path"]}"/><path fill="#db9c78" transform="translate({sx:g} {sy:g}) scale({stop_scale:g} {-stop_scale:g})" d="{stop["path"]}"/></svg>\n'
(ASSETS/'everfolk-monogram.svg').write_text(monogram,encoding='utf-8')


def make_ink_mask():
    size, scale = 256, 4
    im = Image.new('RGBA', (size*scale,size*scale), (255,255,255,255))
    alpha = Image.new('L', im.size, 255)
    draw = ImageDraw.Draw(alpha)
    rng = Random(20261111)
    for i in range(300):
        x,y = rng.uniform(0,size),rng.uniform(0,size)
        r = rng.uniform(.25,.8)
        opacity = rng.randint(90,220)
        # Repeat edge-crossing specks so the tile wraps seamlessly.
        for dx in (-size,0,size):
            for dy in (-size,0,size):
                draw.ellipse(((x-r+dx)*scale,(y-r+dy)*scale,(x+r+dx)*scale,(y+r+dy)*scale),fill=opacity)
    im.putalpha(alpha)
    return im.resize((size,size),Image.Resampling.LANCZOS)


def make_paper_grain():
    rng=Random(20261112)
    im=Image.new('RGBA',(256,256))
    pixels=[]
    for i in range(256*256):
        dark=rng.random()>.22
        pixels.append((94,66,31,rng.randrange(0,49)) if dark else (255,249,224,rng.randrange(0,49)))
    im.putdata(pixels)
    draw=ImageDraw.Draw(im)
    for i in range(240):
        x,y=rng.uniform(0,256),rng.uniform(0,256)
        length=rng.uniform(3,15)
        dy=rng.uniform(-1,1)
        color=(108,77,39,28) if i%3 else (255,245,214,44)
        for dx in (-256,0,256):
            for offset_y in (-256,0,256):
                draw.line((x+dx,y+offset_y,x+length+dx,y+dy+offset_y),fill=color,width=1)
    # The tile is displayed at full opacity in the game; keep its fibres and
    # speckles restrained so typography remains the focus on parchment.
    im.putalpha(im.getchannel('A').point(lambda value: round(value * .28)))
    return im


make_ink_mask().save(ASSETS/'everfolk-ink-mask.png',optimize=True)
make_paper_grain().save(ASSETS/'everfolk-parchment-grain.png',optimize=True)
manifest = {
    'name':'Everfolk Printed Folktale', 'font':'Eczar', 'weight':600,
    'trackingEm':-.025, 'fontWeightRange':[400,800],
    'source': 'https://github.com/google/fonts/tree/main/ofl/eczar',
    'upstreamProject':'https://github.com/rosettatype/eczar',
    'copyright':'Copyright 2014 The Eczar Project Authors (https://github.com/rosettatype/eczar)',
    'license':'SIL Open Font License 1.1',
    'sourceFontSha256':sha256(FONT_PATH.read_bytes()).hexdigest(),
    'logoViewBox':viewbox,'logoWidth':1280,'logoHeight':round(1280*height/width),
    'cream':{'ink':'#e7e0c9','period':'#db9c78'},'ink':{'ink':'#284744','period':'#9b553e'},
    'assetDirectory':'public/assets/branding',
    'fontFile':'public/fonts/eczar-latin-variable.woff2',
    'fontLicense':'public/fonts/OFL-Eczar.txt',
    'glyphAdvances': [{'character':g['character'],'x':g['x']} for g in outlines]
}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'logoWidth':1280,'logoHeight':manifest['logoHeight'],'viewBox':viewbox,'assets':str(ASSETS)}))
