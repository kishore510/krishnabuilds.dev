"""Build basemaps/moon.json: the whole Moon, near side in the middle.

Not part of the build. Run by hand when the map changes:

    pip install pyshp shapely
    python3 scripts/moon/moon.py <LROC_GLOBAL_MARE_180 folder> <MOON_nomenclature_center_pts folder> > basemaps/moon.json

Sources (neither is committed):

- Mare outlines: LROC Global Mare Boundaries (LROC_GLOBAL_MARE_180),
  LROC Science Operations Center, Arizona State University, for NASA's Lunar
  Reconnaissance Orbiter. Metadata: use constraints none. Nelson et al., LPSC 45 (2014), 2861.
- Crater and mare names, centres and diameters: the IAU Gazetteer of Planetary
  Nomenclature, USGS Astrogeology (MOON_nomenclature_center_pts), public domain.

The map is a sky basemap (the cosmic canvas) whose units are selenographic
longitude and latitude: east is right, the near side (which faces Earth) is
between 90 W and 90 E, and lon0 -180 puts the far side at both edges.
"""

import json
import math
import sys

import shapefile
from shapely.affinity import translate
from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import unary_union

RADIUS_KM = 1737.4
KM_PER_DEG = RADIUS_KM * math.pi / 180

SURFACE = "#5c5b62"
MARE = "#2f313c"
RIM = "#9a98a3"

# Maria to label: gazetteer name -> label. English, as the IAU's own glosses.
MARIA = {
    "Oceanus Procellarum": "Ocean of Storms",
    "Mare Imbrium": "Sea of Showers",
    "Mare Serenitatis": "Sea of Serenity",
    "Mare Tranquillitatis": "Sea of Tranquillity",
    "Mare Crisium": "Sea of Crises",
    "Mare Fecunditatis": "Sea of Fecundity",
    "Mare Nectaris": "Sea of Nectar",
    "Mare Nubium": "Sea of Clouds",
    "Mare Humorum": "Sea of Moisture",
    "Mare Frigoris": "Sea of Cold",
    "Mare Moscoviense": "Sea of Muscovy",
}
# Label nudges in degrees, where the gazetteer centre sits on a crater ring or another label.
NUDGE = {"Mare Fecunditatis": (-3, -2), "Oceanus Procellarum": (-6, 0), "Mare Frigoris": (0, 1), "Mare Nectaris": (0, -4), "Mare Humorum": (-2, -3)}

# Large or well-known craters, drawn as rings from their gazetteer diameter.
CRATERS = ["Copernicus", "Tycho", "Kepler", "Aristarchus", "Plato", "Clavius", "Grimaldi", "Ptolemaeus", "Langrenus",
           "Petavius", "Theophilus", "Von Kármán", "Apollo", "Korolev", "Hertzsprung", "Tsiolkovskiy"]
CRATER_LABELS = {"Copernicus": (0, -3), "Tycho": (0, -3.5), "Von Kármán": (0, -4.5), "Apollo": (0, -10.5), "Korolev": (0, -9)}

# South Pole-Aitken basin: centre 53 S, 191 E, about 2,400 by 2,050 km
# (Garrick-Bethell and Zuber, Icarus 204, 2009). Drawn as a dashed ellipse.
SPA = {"at": (-169, -53), "km": (2400, 2050)}


def r1(n):
    return round(n * 10) / 10


def ring_pts(lon, lat, d_km, n=28):
    """A circle of diameter d_km on the surface, as [lon, lat] points (wider in longitude away from the equator)."""
    ry = d_km / 2 / KM_PER_DEG
    rx = ry / max(0.2, math.cos(math.radians(lat)))
    return [[r1(lon + rx * math.cos(2 * math.pi * i / n)), r1(lat + ry * math.sin(2 * math.pi * i / n))] for i in range(n)]


def gazetteer(folder):
    out = {}
    for rec in shapefile.Reader(f"{folder}/MOON_nomenclature_center_pts").iterRecords():
        lon = rec["center_lon"]
        out[rec["name"]] = (lon - 360 if lon > 180 else lon, rec["center_lat"], rec["diameter"])
    return out


def maria(folder):
    """Every LROC mare polygon, merged, smoothed and simplified; small patches dropped."""
    geoms = [shape(s.__geo_interface__) for s in shapefile.Reader(f"{folder}/LROC_GLOBAL_MARE_180").shapes()]
    merged = unary_union([g.buffer(0) for g in geoms]).buffer(0.2).buffer(-0.2)
    parts = merged.geoms if hasattr(merged, "geoms") else [merged]
    shapes = []
    for p in sorted(parts, key=lambda g: -g.area):
        if p.area < 3:  # square degrees: about 2,700 square km at the equator
            continue
        ext = Polygon(p.exterior).simplify(0.45, preserve_topology=True)
        pts = [[r1(x), r1(y)] for x, y in ext.exterior.coords[:-1]]
        if len(pts) >= 4:
            shapes.append(pts)
    return shapes


def edge(step=10):
    """The whole surface as a closed outline, with points along each side so the curve stays square."""
    top = [[-179, 90]] + [[x, 90] for x in range(-180 + step, 180, step)] + [[179, 90], [180, 90], [180, 89]]
    right = [[180, y] for y in range(90 - step, -90, -step)] + [[180, -89], [180, -90], [179, -90]]
    bottom = [[x, -90] for x in range(180 - step, -180, -step)] + [[-179, -90], [-180, -90], [-180, -89]]
    left = [[-180, y] for y in range(-90 + step, 90, step)] + [[-180, 89], [-180, 90]]
    return top + right + bottom + left


def main(mare_dir, names_dir):
    names = gazetteer(names_dir)
    shapes = [{"points": edge(), "closed": True, "fill": SURFACE, "stroke": "#8b8994", "width": 1.6}]
    shapes += [{"points": pts, "closed": True, "fill": MARE, "opacity": 0.92} for pts in maria(mare_dir)]
    for n in CRATERS:
        lon, lat, d = names[n]
        shapes.append({"points": ring_pts(lon, lat, d), "closed": True, "fill": "#6e6d75", "opacity": 0.35, "stroke": RIM, "width": 1.1})
    # The basin crosses 180 degrees, so it is cut at the map's edge and drawn on both sides.
    ring = ring_pts(*SPA["at"], SPA["km"][0], 48)
    line = LineString(ring + ring[:1])
    world = box(-180, -90, 180, 90)
    for piece in [line.intersection(world), translate(line, 360).intersection(world)]:
        for part in getattr(piece, "geoms", [piece]):
            if not part.is_empty:
                shapes.append({"points": [[r1(x), r1(y)] for x, y in part.coords], "stroke": "#b7b4c4", "width": 1.2, "dash": "6 6"})
    # The limb as seen from Earth: 90 W and 90 E.
    for lon in (-90, 90):
        shapes.append({"points": [[lon, 88], [lon, 0], [lon, -88]], "stroke": "#c7c3d4", "width": 1, "dash": "2 7"})

    labels = [
        {"text": "NEAR SIDE · FACES EARTH", "at": [-14, 82], "kind": "sky"},
        {"text": "FAR SIDE", "at": [-142, 82], "kind": "sky"},
        {"text": "FAR SIDE", "at": [122, 82], "kind": "sky"},
        {"text": "South Pole–Aitken basin", "at": [-186 + 40, -74], "kind": "sky"},
    ]
    for gaz, text in MARIA.items():
        lon, lat, _ = names[gaz]
        dx, dy = NUDGE.get(gaz, (0, 0))
        labels.append({"text": text, "at": [r1(lon + dx - len(text) * 0.32), r1(lat + dy)], "kind": "sky"})
    for n, (dx, dy) in CRATER_LABELS.items():
        lon, lat, d = names[n]
        labels.append({"text": n, "at": [r1(lon + dx - len(n) * 0.32), r1(lat + dy - d / 2 / KM_PER_DEG)], "kind": "sky"})

    basemap = {
        "id": "moon",
        "name": "The Moon",
        "kind": "sky",
        "projection": {"lon0": -180, "lat0": 90, "unitsPerDegree": 10},
        "size": [3600, 1800],
        "overview": {"at": [0, 0], "width": 200},
        "source": "Maria from LROC Global Mare Boundaries (NASA LRO, Arizona State University); names, centres and crater sizes from the IAU Gazetteer of Planetary Nomenclature (USGS). Units are selenographic longitude and latitude.",
        "sky": {"edge": "#04050b", "from": "#090a16", "middle": "#070816", "to": "#090a16"},
        "shapes": shapes,
        "washes": [],
        "stars": [
            {"count": 40, "seed": 11, "box": [-200, 92, 200, 150], "color": "#dfe6ff", "size": [0.6, 1.2]},
            {"count": 40, "seed": 12, "box": [-200, -150, 200, -92], "color": "#fff6dc", "size": [0.6, 1.2]},
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
