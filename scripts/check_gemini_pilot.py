"""Exactly one optional live request with fixed synthetic comments, no real users."""
import argparse
import asyncio
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


async def check(attempt=1):
    import httpx
    from src.ai_gemini import GeminiSummaryProvider, MODEL
    from src.ai_openai import SYSTEM_INSTRUCTIONS, ProviderError
    from src.ai_restricted_policy import restricted_summary_instructions, restricted_validator

    filename = 'gemini-pilot.json' if attempt == 1 else 'gemini-pilot-2.json'
    output = ROOT / '.venv' / filename
    if output.exists():
        raise SystemExit('A pilot result already exists; inspect it before repeating a live request.')
    settings = {}
    try:
        for line in (ROOT / '.venv' / 'gemini.env').read_text(encoding='utf-8').splitlines():
            key, value = line.split('=', 1)
            if key in settings:
                raise ValueError()
            settings[key] = value
        assert settings['SMARTLOO_AI_PROVIDER'] == 'gemini'
        assert settings['SMARTLOO_AI_PROFILE'] == 'restricted-tr-evidence-v1'
        assert settings['SMARTLOO_AI_MODEL'] == MODEL
        key = settings['GEMINI_API_KEY']
    except (OSError, ValueError, KeyError, AssertionError):
        raise SystemExit('Private Gemini settings are absent or invalid; no live request was made.') from None
    evidence = [{"request_review_ref": f"r{i}", "text": "Temizdi."} for i in range(1, 4)]
    result = dict(attempt=attempt, model=MODEL, synthetic_only=True, live_provider=True,
                  maximum_requests=1, retry=False, paid_fallback=False)
    async with httpx.AsyncClient() as client:
        provider = GeminiSummaryProvider(client, api_key=key, model=MODEL,
            system_instructions=f'{SYSTEM_INSTRUCTIONS}\n\n{restricted_summary_instructions()}')
        try:
            generated = await provider(evidence)
            accepted = await restricted_validator()(generated, evidence)
            result.update(status='validated', result=accepted)
        except ProviderError as error:
            result.update(status='provider_failed', safe_error=str(error))
        except ValueError:
            result.update(status='validation_rejected')
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in result.items() if key != 'result'}, ensure_ascii=False))
    print(f'Saved a redacted synthetic-only result in ignored .venv/{filename}.')
    return 0 if result['status'] == 'validated' else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--confirm-free-tier', action='store_true',
                        help='Confirm this key belongs to an AI Studio Free-tier project without paid billing.')
    parser.add_argument('--attempt', type=int, choices=(1, 2), default=1,
                        help='Explicitly select a separately recorded pilot attempt; never retries automatically.')
    args = parser.parse_args()
    if not args.confirm_free_tier:
        raise SystemExit('Confirm the project Free tier first; no live request was made.')
    return asyncio.run(check(args.attempt))


if __name__ == '__main__':
    raise SystemExit(main())
