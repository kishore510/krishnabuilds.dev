"""Build basemaps/venus.json: the whole of Venus, 0 degrees in the middle.

Not part of the build. Run by hand when the map changes:

    pip install numpy scipy scikit-image pyshp shapely
    python3 scripts/venus/venus.py <topogrd.dat> <VENUS_nomenclature_center_pts folder> > basemaps/venus.json

Sources (neither is committed):

- Heights: the Magellan 1 x 1 degree topography grid (MGN-V-RDRS-5-TOPO-L2-V1.0,
  topogrd.dat; Ford and Pettengill 1992, radar altimetry from NASA's Magellan),
  from the PDS Geosciences Node. Heights in kilometres above a sphere of
  6051.848 km. NASA data, public domain.
- Names, centres and sizes: the IAU Gazetteer of Planetary Nomenclature,
  USGS Astrogeology (VENUS_nomenclature_center_pts), public domain.

The map is a sky basemap (the cosmic canvas) whose units are longitude (east
positive, -180 to 180) and latitude. The 1 degree grid is smoothed up to 4
pixels a degree before it is outlined, so the bands are soft by design. The
heights are drawn as four bands: the low lava plains, the rolling middle
ground, the highlands and the highest mountains. Venus is hidden under cloud;
the colours are a painted choice, not what the eye would see.
"""

import json
import math
import sys

import numpy as np
import shapefile
from scipy import ndimage
from shapely.geometry import Polygon
from skimage import measure

RADIUS_KM = 6051.8
KM_PER_DEG = RADIUS_KM * math.pi / 180
PPD = 4
# Outlines and holes smaller than this many square degrees are dropped.
MIN_AREA = 12

SURFACE = "#a8743c"
# (name, height in km above the reference sphere, fill, opacity): low first, so each band covers the one before.
BANDS = [
    ("low", -0.8, "#6e4422", 0.9),
    ("high", 1.0, "#c9944f", 0.85),
    ("peak", 3.5, "#ecc684", 0.95),
]

LABELS = {
    "Ishtar Terra": (-14, 9), "Maxwell Montes": (0, -5), "Lakshmi Planum": (0, -3),
    "Aphrodite Terra": (0, -14), "Ovda Regio": (0, 0), "Thetis Regio": (0, -2),
    "Beta Regio": (0, 0), "Atla Regio": (0, -5), "Alpha Regio": (0, 0),
    "Phoebe Regio": (0, 0), "Themis Regio": (0, 0), "Lada Terra": (0, 0),
    "Guinevere Planitia": (0, 0), "Sedna Planitia": (0, 0), "Atalanta Planitia": (0, 0),
    "Lavinia Planitia": (0, 0), "Aino Planitia": (0, 0), "Niobe Planitia": (0, 0),
    "Helen Planitia": (0, 0), "Ganiki Planitia": (0, 0), "Imdr Regio": (0, 4),
}
RINGS = ["Maat Mons", "Sapas Mons", "Theia Mons", "Rhea Mons", "Idunn Mons", "Gula Mons", "Sif Mons", "Mead"]


def r1(n):
    return round(n * 10) / 10


def lon180(lon):
    return lon - 360 if lon > 180 else lon


def heights(path):
    """The Magellan grid at PPD pixels a degree, column 0 at 180 W.

    The file's first column is centred on 240.5 E, so 180.5 E (-179.5) is column 300.
    """
    a = np.array(open(path).read().split(), float).reshape(180, 360)
    a = np.roll(a, -300, axis=1)
    return ndimage.zoom(a, PPD, order=3, mode="grid-wrap")


def band(grid, level):
    """Every area above (or, for the lowest band, below) a height, as smoothed, simplified outlines."""
    mask = (grid < level) if level < 0 else (grid >= level)
    padded = np.pad(mask.astype(float), 1)
    polys = []
    for c in measure.find_contours(padded, 0.5):
        pts = [((x - 0.5) / PPD - 180, 90 - (y - 0.5) / PPD) for y, x in c]
        if len(pts) >= 4:
            p = Polygon(pts).buffer(0)
            if not p.is_empty:
                polys.append(p)
    # find_contours gives outer rings and holes alike: xor them by area order.
    polys.sort(key=lambda g: -g.area)
    shape = None
    for p in polys:
        shape = p if shape is None else shape.symmetric_difference(p)
    shape = shape.buffer(0.4).buffer(-0.4)
    parts = shape.geoms if hasattr(shape, "geoms") else [shape]
    out = []
    for p in sorted(parts, key=lambda g: -g.area):
        if p.area < MIN_AREA:
            continue
        s = p.simplify(0.5, preserve_topology=True)
        holes = [[[r1(x), r1(y)] for x, y in h.coords[:-1]] for h in s.interiors if Polygon(h).area >= MIN_AREA]
        pts = [[r1(x), r1(y)] for x, y in s.exterior.coords[:-1]]
        if len(pts) >= 4:
            out.append((pts, holes))
    return out


def ring_pts(lon, lat, d_km, n=28):
    ry = d_km / 2 / KM_PER_DEG
    rx = ry / max(0.2, math.cos(math.radians(lat)))
    return [[r1(lon + rx * math.cos(2 * math.pi * i / n)), r1(lat + ry * math.sin(2 * math.pi * i / n))] for i in range(n)]


def edge(step=10):
    top = [[x, 90] for x in range(-180, 181, step)]
    right = [[180, y] for y in range(90 - step, -91, -step)]
    bottom = [[x, -90] for x in range(180 - step, -181, -step)]
    left = [[-180, y] for y in range(-90 + step, 90, step)]
    return top + right + bottom + left


def dump(obj):
    """JSON with one shape, star field or label per line, so the file diffs sensibly."""
    one = lambda x: json.dumps(x, ensure_ascii=False, separators=(", ", ": "))
    parts = []
    for key, value in obj.items():
        if isinstance(value, list) and value and isinstance(value[0], dict):
            body = ",\n".join("  " + one(x) for x in value)
            parts.append(f' "{key}": [\n{body}\n ]')
        else:
            parts.append(f' "{key}": {one(value)}')
    return "{\n" + ",\n".join(parts) + "\n}"


def gazetteer(folder):
    out = {}
    for rec in shapefile.Reader(f"{folder}/VENUS_nomenclature_center_pts").iterRecords():
        out[rec["name"]] = (lon180(rec["center_lon"]), rec["center_lat"], rec["diameter"])
    return out


def main(dat, names_dir):
    grid = heights(dat)
    names = gazetteer(names_dir)
    shapes = [{"points": edge(), "closed": True, "fill": SURFACE, "stroke": "#d6a066", "width": 1.6}]
    for _, level, fill, opacity in BANDS:
        for pts, holes in band(grid, level):
            s = {"points": pts, "closed": True, "fill": fill, "opacity": opacity}
            if holes:
                s["holes"] = holes
            shapes.append(s)
    for n in RINGS:
        lon, lat, d = names[n]
        shapes.append({"points": ring_pts(lon, lat, d), "closed": True, "stroke": "#f6d9a4", "width": 1, "opacity": 0.6})

    labels = []
    for n, (dx, dy) in LABELS.items():
        lon, lat, _ = names[n]
        labels.append({"text": n, "at": [r1(lon + dx - len(n) * 0.32), r1(lat + dy)], "kind": "sky"})

    basemap = {
        "id": "venus",
        "name": "Venus",
        "kind": "sky",
        "projection": {"lon0": -180, "lat0": 90, "unitsPerDegree": 10},
        "size": [3600, 1800],
        "overview": {"at": [0, 0], "width": 200},
        "source": "Heights from radar altimetry by NASA's Magellan (Ford and Pettengill 1992; PDS Geosciences Node); names, centres and sizes from the IAU Gazetteer of Planetary Nomenclature (USGS). Colours are painted: the surface is hidden under cloud. Units are longitude (east positive) and latitude.",
        "sky": {"edge": "#05040a", "from": "#0d0a10", "middle": "#09070d", "to": "#0d0a10"},
        "shapes": shapes,
        "washes": [],
        "stars": [
            {"count": 40, "seed": 31, "box": [-200, 92, 200, 150], "color": "#dfe6ff", "size": [0.6, 1.2]},
            {"count": 40, "seed": 32, "box": [-200, -150, 200, -92], "color": "#fff6dc", "size": [0.6, 1.2]},
        ],
        "labels": labels,
    }
    print(dump(basemap))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
