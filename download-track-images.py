"""Download the NASA reference stills used by Tracks 3-8."""
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent / 'assets' / 'tracks'
FILES = {
    'air-quality.png': 'https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005533/AirQuality_Sphere_1920x1080_0000.png',
    'storms.jpg': 'https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_preview.jpg',
    'ocean-currents.jpg': 'https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_2028x1024.25000.jpg',
    'wind.jpg': 'https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004960/atmos_rivers_narrated_4k.00090_print.jpg',
    'hurricane.jpg': 'https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004947/hurr2021_4k_comp.4991_print.jpg',
    'altitude.jpg': 'https://svs.gsfc.nasa.gov/vis/a010000/a011700/a011734/pf-1024.jpg',
}

if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    for name, url in FILES.items():
        with urlopen(url, timeout=30) as response:
            data = response.read()
        if not (data.startswith(b'\x89PNG') or data.startswith(b'\xff\xd8')):
            raise ValueError(f'{name}: response is not a PNG or JPEG')
        (ROOT / name).write_bytes(data)
        print(f'{name}: {len(data)} bytes')
