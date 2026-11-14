"""Simplify PaleoMAP PaleoCoastlines into era shapes for basemaps/earth-deep.json.

Not part of the build. Run by hand when the basemap's data eras change:

    pip install pyshp shapely pygplates
    python3 scripts/paleo/paleomap.py <PaleoCoastlines Data folder> > /tmp/eras.json

The Data folder is from PaleoMAP PaleoCoastlines v7.1 (Kocsis and Scotese,
2020), CC BY 4.0, doi:10.5281/zenodo.4297693. The archive is not committed.

Prints, for each era below: simplified land shapes (`[lon, lat]`, 0.1 degree)
and where the listed sites were at that age, reconstructed with the
dataset's own PALEOMAP rotation model. Ancient longitude cannot be measured
(rocks record latitude, not longitude), so an era may be recentred with
`shift` without misplacing anything; its sites are shifted with it.
"""

import json
import sys

import pygplates
import shapefile
from shapely.affinity import translate
from shapely.geometry import box, shape
from shapely.ops import unary_union

# id, age in millions of years, longitude shift in degrees
ERAS = [
    ("cambrian", 535, 180),
    ("devonian", 375, 0),
    ("carboniferous", 300, 0),
    ("pangaea", 250, 0),
    ("jurassic", 150, 0),
    ("early-cretaceous", 125, 0),
    ("end-cretaceous", 65, 0),
    ("india-asia", 45, 0),
    ("today", 0, 0),
]

# Sites as they are today: [lat, lon].
SITES = {
    "chicxulub": (21.3, -89.5),
    "deccan": (18.9, 73.8),
    "himalaya": (28.0, 86.9),
    "siberian-traps": (66.0, 95.0),
    "atlantic-rift": (31.0, -60.0),
    "iceland": (64.3, -21.0),
    # Fossil sites for Life on Earth
    "ediacara": (-30.8, 138.1),
    "burgess": (51.4, -116.5),
    "tiktaalik": (77.2, -86.4),
    "joggins": (45.7, -64.4),
    "meishan": (31.1, 119.7),
    "ischigualasto": (-30.0, -67.9),
    "solnhofen": (48.9, 11.0),
    "liaoning": (41.6, 120.8),
    "hell-creek": (47.5, -106.9),
    "pakicetus": (33.6, 72.4),
}

TOLERANCE = 0.9  # degrees
MIN_AREA = 6.0  # square degrees; smaller islands are dropped


def wrap(geom, shift):
    """Shift by `shift` degrees of longitude and wrap back into -180..180."""
    world = box(-180, -90, 180, 90)
    moved = translate(geom, xoff=shift)
    pieces = [translate(moved, xoff=k * 360).intersection(world) for k in (-1, 0, 1)]
    # A small buffer out and back closes the seam where pieces cut at the old edge meet.
    return unary_union([p for p in pieces if not p.is_empty]).buffer(0.2).buffer(-0.2)


def rings(geom):
    polys = getattr(geom, "geoms", [geom])
    out = []
    for p in polys:
        if p.geom_type != "Polygon" or p.area < MIN_AREA:
            continue
        r1 = lambda xs: [[round(x, 1), round(y, 1)] for x, y in list(xs)[:-1]]
        shp = {"closed": True, "points": r1(p.exterior.coords)}
        holes = [r1(h.coords) for h in p.interiors if abs(shape({"type": "Polygon", "coordinates": [list(h.coords)]}).area) >= MIN_AREA]
        if holes:
            shp["holes"] = holes
        out.append(shp)
    return out


def main(data):
    model = data + "/paleomap_model_v19o_r1c/"
    rot = pygplates.RotationModel(model + "m06c9h_3id_forPgeog_19o_r1c.rot")
    plates = pygplates.FeatureCollection(model + "PALEOMAP_PlatePolygons__forPgeog_v19o.gpml")
    feats = []
    for name, (lat, lon) in SITES.items():
        f = pygplates.Feature()
        f.set_geometry(pygplates.PointOnSphere(lat, lon))
        f.set_name(name)
        feats.append(f)
    feats = pygplates.partition_into_plates(plates, rot, feats, properties_to_copy=[pygplates.PartitionProperty.reconstruction_plate_id])

    out = []
    for era, age, shift in ERAS:
        reader = shapefile.Reader(f"{data}/CS/{age}Ma_CS_v7")
        land = unary_union([shape(s.__geo_interface__).buffer(0) for s in reader.shapes()])
        land = wrap(land, shift).simplify(TOLERANCE, preserve_topology=True)
        recon = []
        pygplates.reconstruct(feats, rot, recon, age)
        sites = {}
        for r in recon:
            lat, lon = r.get_reconstructed_geometry().to_lat_lon()
            lon = (lon + shift + 180) % 360 - 180
            sites[r.get_feature().get_name()] = [round(lon, 1), round(lat, 1)]
        shapes = rings(land)
        print(f"{era}: {len(shapes)} shapes, {sum(len(s['points']) for s in shapes)} points", file=sys.stderr)
        out.append({"id": era, "age": age, "shift": shift, "shapes": shapes, "sites": sites})
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main(sys.argv[1])
