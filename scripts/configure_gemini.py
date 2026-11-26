"""Run interactively in a terminal; never pass a key as an argument or log it."""
from getpass import getpass
from pathlib import Path
import re


def main():
    root = Path(__file__).resolve().parents[1]
    folder = root / '.venv'
    if folder.is_symlink():
        raise SystemExit('Refusing redirected private configuration directory.')
    folder.mkdir(exist_ok=True)
    destination = folder / 'gemini.env'
    if destination.exists() or destination.is_symlink():
        raise SystemExit('Private Gemini settings already exist; no file was overwritten.')
    print('Use an AI Studio project on the Free tier. Do not enable billing for this pilot.')
    key = getpass('Gemini API key (hidden): ').strip()
    if not re.fullmatch(r'[A-Za-z0-9_.-]{20,300}', key):
        raise SystemExit('Invalid key format; nothing was saved.')
    with destination.open('x', encoding='utf-8', newline='\n') as output:
        output.write('SMARTLOO_AI_PROVIDER=gemini\n'
                     'SMARTLOO_AI_PROFILE=restricted-tr-evidence-v1\n'
                     'SMARTLOO_AI_MODEL=gemini-3.1-flash-lite\n'
                     f'GEMINI_API_KEY={key}\n')
    print('Saved to ignored .venv/gemini.env. No live request was made.')


if __name__ == '__main__':
    main()
