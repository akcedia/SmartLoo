"""Offline policy regression, not live-model or new human acceptance evidence."""
import argparse
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.ai_evidence import ReviewText
from src.ai_restricted_policy import POLICY_VERSION, restricted_preparer, restricted_validator

FIXTURE = ROOT / 'docs/testing/fixtures/turkish-ai-acceptance.json'
REFERENCE = {
    'summary':'Temiz, ancak sabun eksik.', 'pros':['Temiz.'], 'cons':['Sabun eksik.'],
    'recommendation':'acceptable', 'categories':{'cleanliness':'positive','odor':'unknown',
    'supplies':'negative','accessibility':'unknown','safety':'unknown'},
}


async def input_decision(case):
    review = ReviewText(id='synthetic-review',created_at=datetime(2026,11,22,tzinfo=timezone.utc),
                        comment=case['text'],author_identifiers=tuple(case.get('author_identifiers',[])))
    prepared = await restricted_preparer()(SimpleNamespace(reviews=[review]))
    assert all(set(row)=={'request_review_ref','text'} for row in prepared)
    return bool(prepared)


async def output_decision(case):
    candidate = deepcopy(REFERENCE)
    candidate.update(case.get('replace',{}))
    candidate['categories'].update(case.get('category_overrides',{}))
    texts = case.get('evidence',['Temizdi.','Sabun yoktu.','Temiz.'])
    evidence = [{'request_review_ref':f'r{i}','text':text} for i,text in enumerate(texts,1)]
    try:
        await restricted_validator()(candidate,evidence)
        return True
    except ValueError:
        return False


async def evaluate():
    fixture = json.loads(FIXTURE.read_text(encoding='utf-8'))
    results = []
    for group, check in [('inputs',input_decision),('outputs',output_decision)]:
        for case in fixture[group]:
            actual = await check(case)
            results.append({'id':case['id'],'group':group,'expected_policy':case['expected_policy'],
                            'actual_policy':actual,'matched':actual==case['expected_policy']})
    decisions = {row['id']:row['actual_policy'] for row in results}
    usable = [case for case in fixture['inputs'] if case.get('existing_human_label')=='usable']
    excluded = [case for case in fixture['inputs'] if case.get('existing_human_label')=='exclude']
    return {'policy':POLICY_VERSION,'synthetic_only':True,'model_calls':0,'new_human_review':False,
        'policy_regression':{'total':len(results),'matched':sum(row['matched'] for row in results)},
        'inherited_pre_review_subset':{'usable_total':len(usable),
            'usable_accepted':sum(decisions[case['id']] for case in usable),
            'excluded_total':len(excluded),'excluded_rejected':sum(not decisions[case['id']] for case in excluded)},
        'added_input_cases_pending_human_review':sum(case.get('review_status')=='pending' for case in fixture['inputs']),
        'limitations':['Curated synthetic cases do not estimate real-world accuracy.',
                      'Passing the finite-policy regression does not establish broad language/privacy acceptance.',
                      'Same-meaning output paraphrases can be rejected.'], 'cases':results}


def write_review_template(path):
    fixture=json.loads(FIXTURE.read_text(encoding='utf-8'))
    lines=['# Türkçe AI insan değerlendirme formu', '',
           'Sentetik örneklerdir. Bu form politika kararlarını göstermez. Yeni insan değerlendirmesi henüz yapılmadı.',
           'Değerlendiren: …  Tarih: …  İncelenen commit: …', '',
           'Girdiler için kullanılabilir / ele / kararsız ve gözlenen özellikleri yazın. Kişisel veri veya talimat görürseniz belirtin.',
           'U+200B işareti görünmez karakteri görünür kılar; gerçek yorumda bu açıklama yoktur.', '',
           '| ID | Yorum | Bilinen yazar adı | İnsan kararı ve gerekçe |',
           '|---|---|---|---|']
    for case in fixture['inputs']:
        text=case['text'].replace('\u200b','[U+200B]').replace('|','\\|')
        lines.append(f"| {case['id']} | {text} | {', '.join(case.get('author_identifiers',[])) or '—'} | — |")
    lines += ['', '## Sentetik çıktı adayları', '',
              'Bunlar canlı model çıktıları değildir. Verilen yorumlara göre doğru / desteklenmiyor / kararsız kararı verin.',
              'Aynı anlamdaki farklı Türkçe ifadeleri yalnız biçimleri değiştiği için yanlış saymayın.', '']
    for case in fixture['outputs']:
        candidate=deepcopy(REFERENCE)
        candidate.update(case.get('replace',{}))
        candidate['categories'].update(case.get('category_overrides',{}))
        lines += [f"### {case['id']}", '',
                  'Yorumlar: '+json.dumps(case.get('evidence',['Temizdi.','Sabun yoktu.','Temiz.']),ensure_ascii=False),
                  '', '```json', json.dumps(candidate,ensure_ascii=False,indent=2), '```', '',
                  'İnsan kararı ve gerekçe: —', '']
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text('\n'.join(lines),encoding='utf-8')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--review-template',type=Path)
    args=parser.parse_args()
    for path in (args.output,args.review_template):
        if path and path.exists():
            parser.error('Output already exists; choose a new path to preserve evidence and human labels.')
    report=asyncio.run(evaluate())
    if args.review_template:
        write_review_template(args.review_template)
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({key:value for key,value in report.items() if key!='cases'},ensure_ascii=False))
    return 0 if report['policy_regression']['matched']==report['policy_regression']['total'] else 1


if __name__=='__main__':
    raise SystemExit(main())
