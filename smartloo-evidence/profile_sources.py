"""Read original downloads; emit reproducible schema/identity/join evidence."""
from pathlib import Path
from collections import Counter, defaultdict
import json, hashlib, unicodedata, re
import openpyxl

ROOT = Path(__file__).parent
def norm(v):
    v = str(v).translate(str.maketrans('ıİşŞğĞüÜöÖçÇ', 'iIsSgGuUoOcC'))
    return re.sub(r'[^A-Z0-9]+', ' ', unicodedata.normalize('NFKD', v).encode('ascii', 'ignore').decode().upper()).strip()
def groups(counter):
    return [{'key': list(k) if isinstance(k,tuple) else k, 'count':v} for k,v in counter.items() if v>1]
report = {'files':{}, 'facility':{}, 'usage':{}}
for p in sorted(ROOT.iterdir()):
    if p.suffix in ('.geojson','.xlsx') or p.name.endswith('.metadata.json'):
        report['files'][p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
features=json.loads(next(ROOT.glob('*.geojson')).read_text())['features']
f=report['facility']; f['rows']=len(features)
f['feature_keys']=sorted(set().union(*(x.keys() for x in features)))
f['geometry_types']=dict(Counter(x['geometry']['type'] for x in features))
f['properties']={}
for k in sorted(set().union(*(x['properties'].keys() for x in features))):
    vals=[x['properties'].get(k) for x in features]
    f['properties'][k]={'types':dict(Counter(type(v).__name__ for v in vals)), 'null_or_empty':sum(v is None or v=='' for v in vals),'distinct':len(set(vals))}
    if k not in ('MAHAL_ADI','X','Y'):f['properties'][k]['values']=dict(Counter(vals))
f['coordinate_bounds']=[[min(x['geometry']['coordinates'][i] for x in features),max(x['geometry']['coordinates'][i] for x in features)] for i in (0,1)]
f['max_xy_difference']=[max(abs(x['geometry']['coordinates'][i]-x['properties'][k]) for x in features) for i,k in enumerate(('X','Y'))]
for label,key in [('name',lambda x:x['properties']['MAHAL_ADI']),('district_name',lambda x:(x['properties']['ILCE'],x['properties']['MAHAL_ADI'])),('geometry',lambda x:tuple(x['geometry']['coordinates'])),('candidate_identity',lambda x:(norm(x['properties']['ILCE']),norm(x['properties']['MAHAL_ADI']),*x['geometry']['coordinates']))]:
    counter=Counter(key(x) for x in features);f[label]={'distinct':len(counter),'duplicates':groups(counter)}
canonical=Counter(json.dumps(x,sort_keys=True,ensure_ascii=False) for x in features)
f['exact_duplicate_rows_excess']=sum(n-1 for n in canonical.values())
names=defaultdict(list)
for i,x in enumerate(features):names[norm(x['properties']['MAHAL_ADI'])].append(i)
all_stations=set(); terminal_stations=defaultdict(set)
for p in sorted(ROOT.glob('*.xlsx')):
    w=openpyxl.load_workbook(p,read_only=True,data_only=True);s=w['Veri']; rows=s.iter_rows(values_only=True);head=next(rows)
    types=[Counter() for _ in head];nulls=[0]*len(head);stations=set();terminals=set();months=Counter();genders=Counter();ages=set();lines=set();keycounts=Counter();count=0;non_integer=Counter();negative=0
    for row in rows:
        count+=1
        for i,v in enumerate(row):
            types[i][type(v).__name__]+=1;nulls[i]+=v is None or v==''
        y,m,line,station,terminal,age,gender,passages=row
        for i in (0,1,7):
            if not isinstance(row[i],int):non_integer[head[i]]+=1
        if isinstance(passages,(int,float)) and passages<0:negative+=1
        stations.add(station);terminals.add(terminal);terminal_stations[terminal].add(station);months[(y,m)]+=1;genders[gender]+=1;ages.add(age);lines.add(line)
        keycounts[row[:7]]+=1
    matches={str(st):names.get(norm(st),[]) if st else [] for st in sorted(stations,key=lambda x:str(x))}
    report['usage'][p.name]={'sheet':'Veri','rows':count,'columns':list(head),'types':{k:dict(t) for k,t in zip(head,types)},'null_or_empty':dict(zip(head,nulls)),'non_integer':dict(non_integer),'negative_passages':negative,'months':[list(k) for k in sorted(months)],'stations':len(stations),'terminals':len(terminals),'lines':sorted(lines),'genders':dict(genders),'age_groups':sorted(ages),'duplicate_dimension_keys':sum(n-1 for n in keycounts.values()),'name_match_counts':dict(Counter('none' if not ids else 'one' if len(ids)==1 else 'multiple' for ids in matches.values())),'name_match_candidates':matches}
    all_stations.update(stations);w.close()
    print('Profiled',p.name,count,flush=True)
f['usage_all_station_names']=len(all_stations)
f['usage_all_name_match_counts']=dict(Counter('none' if not names.get(norm(st)) else 'one' if len(names[norm(st)])==1 else 'multiple' for st in all_stations))
report['terminal_station_name_conflicts']={t:sorted(s) for t,s in terminal_stations.items() if len(s)>1}
(ROOT/'profile.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('Saved profile.json',flush=True)
