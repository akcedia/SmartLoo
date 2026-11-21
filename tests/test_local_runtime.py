"""Local launcher retains signing identity and never prints the signing key."""
import pytest

from scripts.run_local_api import signing_key


def test_local_key_survives_restart_without_logging(tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("SMARTLOO_JWT_SECRET", raising=False)
    path = tmp_path / "runtime" / "jwt"
    initial = signing_key(path)
    assert len(initial.encode()) >= 32
    assert signing_key(path) == initial
    assert capsys.readouterr().out == ""


def test_explicit_environment_key_takes_priority(tmp_path, monkeypatch):
    monkeypatch.setenv("SMARTLOO_JWT_SECRET", "test-only-configured-signing-key-at-least-32-bytes")
    path = tmp_path / "unused"
    assert signing_key(path) == "test-only-configured-signing-key-at-least-32-bytes"
    assert not path.exists()


@pytest.mark.parametrize("source", ["environment", "file"])
def test_invalid_key_is_rejected_instead_of_silently_replacing_identity(tmp_path, monkeypatch, source):
    monkeypatch.delenv("SMARTLOO_JWT_SECRET", raising=False)
    path = tmp_path / "jwt"
    if source == "environment":
        monkeypatch.setenv("SMARTLOO_JWT_SECRET", "short")
    else:
        path.write_text("short", encoding="utf-8")
    with pytest.raises(ValueError):
        signing_key(path)
