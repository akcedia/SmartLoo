"""Execute the curated policy corpus, keeping semantic coverage separate."""
import asyncio
import json

import pytest
from scripts.check_turkish_ai_acceptance import FIXTURE, input_decision, output_decision
from src.ai_restricted_policy import expected_candidate, restricted_validator

CASES=json.loads(FIXTURE.read_text(encoding='utf-8'))


@pytest.mark.parametrize('case',CASES['inputs'],ids=lambda case:case['id'])
def test_prepared_input_policy(case):
    assert asyncio.run(input_decision(case)) is case['expected_policy']


@pytest.mark.parametrize('case',CASES['outputs'],ids=lambda case:case['id'])
def test_grounded_output_policy(case):
    assert asyncio.run(output_decision(case)) is case['expected_policy']


@pytest.mark.parametrize(
    "summary,evidence",
    [
        ("Temizdi fakat sabun yoktu.", ["Temizdi.", "Temiz.", "Temizdi."]),
        ("Temizdi fakat sabun yoktu.", ["Temizdi.", "Sabun yoktu.", "Sabun var."]),
        ("Temizdi fakat sabun yoktu. ornek@example.com", ["Temizdi.", "Sabun yoktu.", "Temiz."]),
    ],
    ids=["missing-soap-evidence", "conflicting-soap-evidence", "personal-data-suffix"],
)
def test_allowed_paraphrase_cannot_hide_conflicts_or_add_claims(summary, evidence):
    prepared = [{"request_review_ref": f"r{index}", "text": text}
                for index, text in enumerate(evidence, start=1)]
    candidate = expected_candidate(prepared)
    candidate["summary"] = summary
    with pytest.raises(ValueError):
        asyncio.run(restricted_validator()(candidate, prepared))


def test_cli_does_not_overwrite_human_review(tmp_path,monkeypatch):
    from scripts import check_turkish_ai_acceptance as checker
    path=tmp_path/'review.md'
    path.write_text('Existing independent human decisions',encoding='utf-8')
    monkeypatch.setattr('sys.argv',['check_turkish_ai_acceptance.py','--review-template',str(path)])
    with pytest.raises(SystemExit):
        checker.main()
    assert path.read_text(encoding='utf-8')=='Existing independent human decisions'
