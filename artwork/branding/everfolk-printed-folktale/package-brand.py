"""Create the portable font and logo download, retaining original font licensing."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root=Path(__file__).resolve().parent
project=root.parents[2]
archive=root/'everfolk-brand-kit.zip'
files={
    'README.md':root/'README.md',
    'manifest.json':root/'manifest.json',
    'approved-wordmark-proof.png':root/'approved-wordmark-proof.png',
    'source/Eczar-variable.ttf':root/'Eczar-variable.ttf',
    'source/google-fonts-source.css':root/'google-fonts-source.css',
    'source/build-brand.py':root/'build-brand.py',
    'source/export-brand.mjs':root/'export-brand.mjs',
    'source/package-brand.py':root/'package-brand.py',
    'fonts/eczar-latin-variable.woff2':project/'public/fonts/eczar-latin-variable.woff2',
    'fonts/eczar-latin-ext-variable.woff2':project/'public/fonts/eczar-latin-ext-variable.woff2',
    'fonts/eczar.css':project/'public/fonts/eczar.css',
    'fonts/OFL-Eczar.txt':project/'public/fonts/OFL-Eczar.txt',
}
for item in sorted((project/'public/assets/branding').glob('everfolk-*')):
    files['logos-and-textures/'+item.name]=item
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=9) as kit:
    for name,source in files.items():
        kit.write(source,name)
with ZipFile(archive) as kit:
    assert kit.testzip() is None
print(f'{archive} ({archive.stat().st_size:,} bytes, {len(files)} files)')
