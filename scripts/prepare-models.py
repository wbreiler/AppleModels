"""Convert Apple's binary USDZ layers to ASCII for the browser USD loader."""
import json
import re
import tempfile
import zipfile
from pathlib import Path
from pxr import Usd, UsdGeom

catalog_path = Path('.model-refresh/catalog.json')
catalog = json.loads(catalog_path.read_text())
for device in catalog['devices']:
    path = (Path('public') / device['url'].lstrip('/')) if device['url'].endswith('.zip') else Path('.model-refresh') / (device['id'] + '.usdz')
    with tempfile.TemporaryDirectory() as directory:
        base = Path(directory)
        with zipfile.ZipFile(path) as package:
            names = package.namelist()
            for name in names:
                if not (base / name).resolve().is_relative_to(base.resolve()):
                    raise ValueError('Unsafe package path')
            package.extractall(base)
        stage = Usd.Stage.Open(str(base / names[0]))
        # USD defaults to centimeters. Three needs an explicit unit declaration.
        UsdGeom.SetStageMetersPerUnit(stage, UsdGeom.GetStageMetersPerUnit(stage))
        # Disable instancing so the browser gets fully composed geometry.
        for prim in stage.TraverseAll():
            if prim.IsInstanceable():
                prim.SetInstanceable(False)
        # Flatten first so metadata inherited through references is editable here.
        stage = Usd.Stage.Open(stage.Flatten(addSourceFileComment=False))
        # USDAParser treats metadata on valueless shader outputs as a closing prim.
        # SDR metadata is editor-only. Removing it preserves material/texture paths.
        for prim in stage.TraverseAll():
            for attribute in prim.GetAttributes():
                if attribute.HasAuthoredMetadata('sdrMetadata'):
                    attribute.ClearMetadata('sdrMetadata')
        text = stage.ExportToString(addSourceFileComment=False)
        def relative_asset(match):
            asset = match.group(1)
            if asset.startswith(str(base)):
                asset = str(Path(asset).relative_to(base))
            return '@' + asset + '@'
        text = re.sub(r'@([^@]+)@', relative_asset, text)
        destination = Path('public/models') / (device['id'] + '.zip')
        temporary = destination.with_suffix('.zip.tmp')
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED) as output:
            output.writestr('model.usda', text)
            for name in names:
                if Path(name).suffix.lower() not in ('.usd', '.usdc', '.usda'):
                    output.write(base / name, name)
        temporary.replace(destination)
        device['url'] = '/' + str(destination.relative_to('public'))
        device['bytes'] = destination.stat().st_size
        print(f"Prepared {device['name']}: {device['bytes'] / 1048576:.1f} MB")
output_catalog = Path('public/catalog.json.tmp')
output_catalog.write_text(json.dumps(catalog, indent=2) + '\n')
output_catalog.replace('public/catalog.json')
