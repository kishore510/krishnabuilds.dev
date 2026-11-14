"""Assemble basemaps/earth-deep.json: the data eras from paleomap.py plus the eras drawn by hand.

Not part of the build. After paleomap.py:

    python3 scripts/paleo/paleomap.py <Data folder> > /tmp/eras.json
    python3 scripts/paleo/assemble.py /tmp basemaps/earth-deep.json

The first argument is the folder holding eras.json. Prints where the sites were in each data era.

The hand-drawn eras (before 535 million years, and the ice-age ice sheets) are illustrative,
and the basemap says so in its labels and the story in its cards.
"""
import json, math, random, sys
S=sys.argv[1]; data={e['id']:e for e in json.load(open(S+'/eras.json'))}
def blob(lon,lat,rx,ry,seed,n=16,rough=.28):
    r=random.Random(seed); pts=[]
    phases=[r.random()*6.28 for _ in range(3)]
    for i in range(n):
        a=i/n*2*math.pi
        k=1+rough*(.5*math.sin(2*a+phases[0])+.3*math.sin(3*a+phases[1])+.2*math.sin(5*a+phases[2]))+r.uniform(-.06,.06)
        pts.append([round(lon+rx*k*math.cos(a),1), round(max(-89,min(89,lat+ry*k*math.sin(a))),1)])
    return {"closed":True,"points":pts}
L=lambda text,at,kind="sea":{"text":text,"at":at,"kind":kind}
eras=[]
eras.append({"id":"hadean","name":"Molten Earth, about 4.5 billion years ago","wash":{"color":"#b8400f","opacity":0.85},
  "labels":[L("Magma ocean",[-20,20])]})
eras.append({"id":"first-ocean","name":"The first oceans, about 4.4 billion years ago",
  "shapes":[blob(lon,lat,r,r*.8,s,10,.35) for s,(lon,lat,r) in enumerate([(-60,10,3),(-20,-25,2.5),(25,15,3.5),(70,-10,2.5),(110,30,3),(150,-30,2.5),(-120,-15,3)])],
  "labels":[L("A global ocean",[-20,20]),L("Islands illustrative",[40,-45],"range")]})
cr=[(-110,30,9,7),(-60,-20,11,8),(-10,40,8,6),(20,-5,12,9),(60,25,9,7),(95,-30,10,7),(135,15,8,6),(160,-50,7,5),(-150,-45,8,6)]
eras.append({"id":"archean","name":"The first continents, 4 to 2.5 billion years ago",
  "shapes":[blob(lon,lat,rx,ry,100+s,14,.3) for s,(lon,lat,rx,ry) in enumerate(cr)],
  "labels":[L("Small continents: shapes illustrative",[-20,62],"range")]})
rod=[blob(5,-5,58,32,201,22,.32),blob(-75,30,14,10,202,12,.3),blob(85,35,12,9,203,12,.3)]
eras.append({"id":"rodinia","name":"Rodinia, about 1 billion years ago","shapes":rod,
  "labels":[L("Rodinia",[-15,8],"range"),L("Mirovia Ocean",[-110,-30]),L("One reconstruction of several",[5,-48],"range")]})
sb=[blob(-40,10,26,18,301,16,.3),blob(25,-10,30,20,302,16,.3),blob(90,15,22,14,303,14,.3)]
eras.append({"id":"snowball","name":"Snowball Earth, about 700 million years ago","shapes":sb,"ice":sb,"wash":{"color":"#e9f3f8","opacity":0.78},
  "labels":[L("Ice from pole to equator?",[-110,-25],"range")]})
def data_era(i,name,labels): e=data[i]; return {"id":i,"name":name,"shapes":e["shapes"],"labels":labels}
eras.append(data_era("cambrian","Gondwana, 535 million years ago",[L("Gondwana",[0,-55],"range"),L("Panthalassic Ocean",[-100,20])]))
eras.append(data_era("devonian","The world 375 million years ago",[L("Panthalassic Ocean",[-120,10]),L("Gondwana",[20,-55],"range")]))
eras.append(data_era("carboniferous","The world 300 million years ago",[L("Panthalassic Ocean",[-120,10]),L("Pangaea forming",[0,-35],"range")]))
eras.append(data_era("pangaea","Pangaea, 250 million years ago",[L("Pangaea",[20,-10],"range"),L("Panthalassa",[-120,0]),L("Tethys",[95,15])]))
eras.append(data_era("jurassic","Pangaea breaking up, 150 million years ago",[L("Laurasia",[40,55],"range"),L("Gondwana",[20,-40],"range"),L("Tethys",[60,10])]))
eras.append(data_era("early-cretaceous","The world 125 million years ago",[L("Pacific Ocean",[-150,0]),L("Tethys",[60,5])]))
eras.append(data_era("end-cretaceous","The world 65 million years ago",[L("Pacific Ocean",[-150,0]),L("Tethys",[45,15])]))
eras.append(data_era("india-asia","The world 45 million years ago",[L("Pacific Ocean",[-150,0]),L("Atlantic Ocean",[-35,15])]))
today=data["today"]["shapes"]
ice=[{"closed":True,"points":[[-165,68],[-140,70],[-120,75],[-90,80],[-70,80],[-60,72],[-58,55],[-65,45],[-72,41],[-80,40],[-87,38.5],[-95,40],[-100,46],[-112,48],[-122,47],[-130,54],[-150,60],[-165,62]]},
     {"closed":True,"points":[[-55,60],[-43,59.5],[-30,68],[-20,75],[-18,82],[-40,83.5],[-60,82],[-70,77],[-58,70]]},
     {"closed":True,"points":[[-11,53],[-6,50.5],[2,51.5],[10,52.5],[20,52],[30,55],[40,62],[55,66],[65,72],[60,80],[40,81],[15,80],[0,72],[-10,62],[-14,57]]},
     {"closed":True,"points":[[-180,-64],[-120,-66],[-60,-62],[0,-66],[60,-64],[120,-63],[180,-64],[180,-90],[-180,-90]]}]
eras.append({"id":"ice-age","name":"The last ice age, about 20,000 years ago","shapes":today,"ice":ice,
  "labels":[L("Ice sheets (approximate)",[-118,71],"range"),L("Atlantic Ocean",[-35,15]),L("Pacific Ocean",[-150,0])]})
eras.append({"id":"today","name":"Today","shapes":today,"labels":[L("Atlantic Ocean",[-35,15]),L("Pacific Ocean",[-150,0]),L("Indian Ocean",[75,-25])]})
basemap={"id":"earth-deep","name":"Earth in deep time","kind":"deep",
 "projection":{"lon0":-180,"lat0":90,"unitsPerDegree":5},"size":[1800,900],
 "sea":{"top":"#1f4f78","middle":"#15385c","bottom":"#0d2642","wave":"#8fc0e4","shallows":"#4f9fd0","shallowsWidth":8},
 "land":{"top":"#e6cf96","middle":"#e2ac5f","bottom":"#d9a560","edge":"#8a4f1c"},
 "waves":{"count":60,"seed":17},"overview":{"at":[0,0],"width":360},
 "source":"Eras from 535 million years ago to today: simplified from PaleoMAP PaleoCoastlines v7.1 (Kocsis and Scotese 2020, CC BY 4.0). Older eras and the ice-age ice sheets are drawn by hand and are illustrative.",
 "eras":eras}
json.dump(basemap,open(sys.argv[2],'w'),separators=(",",":"))
json.dump({k:v["sites"] for k,v in data.items()},sys.stdout,indent=0)
