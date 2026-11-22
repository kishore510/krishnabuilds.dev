"""Build basemaps/mars.json: the whole of Mars, 0 degrees in the middle.

Not part of the build. Run by hand when the map changes:

    pip install numpy scikit-image pyshp shapely
    python3 scripts/mars/mars.py <megt90n000cb.img> <MARS_nomenclature_center_pts folder> > basemaps/mars.json

Sources (neither is committed):

- Heights: MOLA Mission Experiment Gridded Data Record, 4 pixels per degree
  (MGS-M-MOLA-5-MEGDR-L3-V1.0, megt90n000cb.img), NASA Mars Global Surveyor,
  from the PDS Geosciences Node. NASA data, public domain.
- Names, centres and sizes: the IAU Gazetteer of Planetary Nomenclature,
  USGS Astrogeology (MARS_nomenclature_center_pts), public domain.

The map is a sky basemap (the cosmic canvas) whose units are planetocentric
longitude (east positive, -180 to 180) and latitude. The heights are drawn as
four bands: the northern lowlands and deep basins, the cratered middle ground,
the high plateaus and the volcano summits. The polar caps are drawn by hand
and are illustrative: their size changes with the seasons.
"""

import json
import math
import sys

import numpy as np
import shapefile
from shapely.geometry import Polygon
from shapely.ops import unary_union
from skimage import measure

RADIUS_KM = 3389.5
KM_PER_DEG = RADIUS_KM * math.pi / 180
PPD = 4

SURFACE = "#9c5b3b"
# (height in metres above the MOLA datum, fill, opacity): low first, so each band covers the one before.
BANDS = [
    ("low", -3000, "#5e3324", 0.9),
    ("high", 3000, "#c07a4f", 0.85),
    ("peak", 9000, "#dca277", 0.95),
]
ICE = "#f1ece4"

LABELS = {
    "Olympus Mons": (0, -9), "Tharsis Montes": (8, 0), "Alba Mons": (0, 0),
    "Valles Marineris": (0, -6), "Hellas Planitia": (0, 0), "Argyre Planitia": (0, 0),
    "Utopia Planitia": (0, 0), "Acidalia Planitia": (0, 0), "Amazonis Planitia": (0, 0),
    "Chryse Planitia": (0, -3), "Isidis Planitia": (0, 0), "Elysium Mons": (0, -6),
    "Arabia Terra": (0, 0), "Terra Cimmeria": (0, 0), "Noachis Terra": (0, 4),
    "Syrtis Major Planum": (0, -4), "Planum Boreum": (0, -3), "Planum Australe": (0, 3),
}
RINGS = ["Olympus Mons", "Arsia Mons", "Pavonis Mons", "Ascraeus Mons", "Elysium Mons", "Alba Mons"]


def r1(n):
    return round(n * 10) / 10


def lon180(lon):
    return lon - 360 if lon > 180 else lon


def heights(path):
    """The MOLA grid, re-centred so column 0 is 180 W, at 1 pixel per degree x PPD."""
    a = np.fromfile(path, ">i2").reshape(180 * PPD, 360 * PPD).astype(float)
    return np.roll(a, 180 * PPD, axis=1)


def band(grid, level):
    """Every area above (or, for the lowest band, below) a height, as smoothed, simplified outlines."""
    mask = (grid < level) if level < 0 else (grid >= level)
    padded = np.pad(mask.astype(float), 1)
    polys = []
    for c in measure.find_contours(padded, 0.5):
        pts = [((x - 1) / PPD - 180, 90 - (y - 1) / PPD) for y, x in c]
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
        if p.area < 4:
            continue
        s = p.simplify(0.5, preserve_topology=True)
        holes = [[[r1(x), r1(y)] for x, y in h.coords[:-1]] for h in s.interiors if Polygon(h).area >= 4]
        pts = [[r1(x), r1(y)] for x, y in s.exterior.coords[:-1]]
        if len(pts) >= 4:
            out.append((pts, holes))
    return out


def ring_pts(lon, lat, d_km, n=28):
    ry = d_km / 2 / KM_PER_DEG
    rx = ry / max(0.2, math.cos(math.radians(lat)))
    return [[r1(lon + rx * math.cos(2 * math.pi * i / n)), r1(lat + ry * math.sin(2 * math.pi * i / n))] for i in range(n)]


def gazetteer(folder):
    out = {}
    for rec in shapefile.Reader(f"{folder}/MARS_nomenclature_center_pts").iterRecords():
        out[rec["name"]] = (lon180(rec["center_lon"]), rec["center_lat"], rec["diameter"])
    return out


def edge(step=10):
    top = [[x, 90] for x in range(-180, 181, step)]
    right = [[180, y] for y in range(90 - step, -91, -step)]
    bottom = [[x, -90] for x in range(180 - step, -181, -step)]
    left = [[-180, y] for y in range(-90 + step, 90, step)]
    return top + right + bottom + left


def cap(lat_edge, top):
    """A polar cap as a wavy band across the top or bottom of the map (illustrative)."""
    pts = []
    for i, x in enumerate(range(-180, 181, 30)):
        pts.append([x, r1(lat_edge + (0.6 if i % 2 else -0.6))])
    end = 90 if top else -90
    return pts + [[180, end], [-180, end]]


def main(img, names_dir):
    grid = heights(img)
    names = gazetteer(names_dir)
    shapes = [{"points": edge(), "closed": True, "fill": SURFACE, "stroke": "#c98a62", "width": 1.6}]
    for _, level, fill, opacity in BANDS:
        for pts, holes in band(grid, level):
            s = {"points": pts, "closed": True, "fill": fill, "opacity": opacity}
            if holes:
                s["holes"] = holes
            shapes.append(s)
    for n in RINGS:
        lon, lat, d = names[n]
        shapes.append({"points": ring_pts(lon, lat, d), "closed": True, "stroke": "#f0c39a", "width": 1, "opacity": 0.6})
    # Polar caps: the north cap reaches about 80 N, the smaller south cap about 85 S (illustrative).
    shapes.append({"points": cap(81, True), "closed": True, "fill": ICE, "opacity": 0.85})
    shapes.append({"points": cap(-85, False), "closed": True, "fill": ICE, "opacity": 0.85})

    labels = [{"text": "NORTHERN LOWLANDS", "at": [-40, 66], "kind": "sky"},
              {"text": "SOUTHERN HIGHLANDS", "at": [-40, -66], "kind": "sky"}]
    for n, (dx, dy) in LABELS.items():
        lon, lat, _ = names[n]
        labels.append({"text": n, "at": [r1(lon + dx - len(n) * 0.32), r1(lat + dy)], "kind": "sky"})

    basemap = {
        "id": "mars",
        "name": "Mars",
        "kind": "sky",
        "projection": {"lon0": -180, "lat0": 90, "unitsPerDegree": 10},
        "size": [3600, 1800],
        "overview": {"at": [0, 0], "width": 200},
        "source": "Heights from MOLA on NASA's Mars Global Surveyor (PDS Geosciences Node); names, centres and sizes from the IAU Gazetteer of Planetary Nomenclature (USGS). Polar caps drawn by hand. Units are planetocentric longitude (east positive) and latitude.",
        "sky": {"edge": "#04050b", "from": "#0b0912", "middle": "#08070f", "to": "#0b0912"},
        "shapes": shapes,
        "washes": [],
        "stars": [
            {"count": 40, "seed": 21, "box": [-200, 92, 200, 150], "color": "#dfe6ff", "size": [0.6, 1.2]},
            {"count": 40, "seed": 22, "box": [-200, -150, 200, -92], "color": "#fff6dc", "size": [0.6, 1.2]},
        ],
        "labels": labels,
    }
    print(dump(basemap))


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


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
