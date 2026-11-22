"""Execute the curated policy corpus, keeping semantic coverage separate."""
import asyncio
import json

import pytest
from scripts.check_turkish_ai_acceptance import FIXTURE, input_decision, output_decision

CASES=json.loads(FIXTURE.read_text(encoding='utf-8'))


@pytest.mark.parametrize('case',CASES['inputs'],ids=lambda case:case['id'])
def test_prepared_input_policy(case):
    assert asyncio.run(input_decision(case)) is case['expected_policy']


@pytest.mark.parametrize('case',CASES['outputs'],ids=lambda case:case['id'])
def test_grounded_output_policy(case):
    assert asyncio.run(output_decision(case)) is case['expected_policy']


def test_cli_does_not_overwrite_human_review(tmp_path,monkeypatch):
    from scripts import check_turkish_ai_acceptance as checker
    path=tmp_path/'review.md'
    path.write_text('Existing independent human decisions',encoding='utf-8')
    monkeypatch.setattr('sys.argv',['check_turkish_ai_acceptance.py','--review-template',str(path)])
    with pytest.raises(SystemExit):
        checker.main()
    assert path.read_text(encoding='utf-8')=='Existing independent human decisions'
