#!/usr/bin/env python3
"""Bootstrap a local-only ONNX reranker environment for CodexLens.

This script defaults to dry-run output so it can be used as a reproducible
bootstrap manifest. When `--apply` is passed, it installs pinned reranker
packages into the selected virtual environment and can optionally pre-download
the ONNX reranker model into a repo-local Hugging Face cache.

Examples:
    python scripts/bootstrap_reranker_local.py --dry-run
    python scripts/bootstrap_reranker_local.py --apply --download-model
    python scripts/bootstrap_reranker_local.py --venv .venv --model Xenova/ms-marco-MiniLM-L-12-v2
"""

from __future__ import annotations

import argparse
import os
import shlex
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = Path(__file__).with_name("requirements-reranker-local.txt")
DEFAULT_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2"
DEFAULT_HF_HOME = PROJECT_ROOT / ".cache" / "huggingface"

STEP_NOTES = {
    "runtime": "Install the local ONNX runtime first so optimum/transformers do not backtrack over runtime wheels.",
    "hf-stack": "Pin the Hugging Face stack used by the ONNX reranker backend.",
}


@dataclass(frozen=True)
class RequirementStep:
    name: str
    packages: tuple[str, ...]


def _normalize_venv_path(raw_path: str | Path) -> Path:
    return (Path(raw_path) if raw_path else PROJECT_ROOT / ".venv").expanduser().resolve()


def _venv_python(venv_path: Path) -> Path:
    if os.name == "nt":
        return venv_path / "Scripts" / "python.exe"
    return venv_path / "bin" / "python"


def _venv_huggingface_cli(venv_path: Path) -> Path:
    if os.name == "nt":
        preferred = venv_path / "Scripts" / "hf.exe"
        return preferred if preferred.exists() else venv_path / "Scripts" / "huggingface-cli.exe"
    preferred = venv_path / "bin" / "hf"
    return preferred if preferred.exists() else venv_path / "bin" / "huggingface-cli"


def _default_shell() -> str:
    return "powershell" if os.name == "nt" else "bash"


def _shell_quote(value: str, shell: str) -> str:
    if shell == "bash":
        return shlex.quote(value)
    return "'" + value.replace("'", "''") + "'"


def _format_command(parts: Iterable[str], shell: str) -> str:
    return " ".join(_shell_quote(str(part), shell) for part in parts)


def _format_set_env(name: str, value: str, shell: str) -> str:
    quoted_value = _shell_quote(value, shell)
    if shell == "bash":
        return f"export {name}={quoted_value}"
    return f"$env:{name} = {quoted_value}"


def _model_local_dir(hf_home: Path, model_name: str) -> Path:
    slug = model_name.replace("/", "--")
    return hf_home / "models" / slug


def _parse_manifest(manifest_path: Path) -> list[RequirementStep]:
    current_name: str | None = None
    current_packages: list[str] = []
    steps: list[RequirementStep] = []

    for raw_line in manifest_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if line.startswith("# [") and line.endswith("]"):
            if current_name and current_packages:
                steps.append(RequirementStep(current_name, tuple(current_packages)))
            current_name = line[3:-1]
            current_packages = []
            continue

        if line.startswith("#"):
            continue

        if current_name is None:
            raise ValueError(f"Package entry found before a section header in {manifest_path}")
        current_packages.append(line)

    if current_name and current_packages:
        steps.append(RequirementStep(current_name, tuple(current_packages)))

    if not steps:
        raise ValueError(f"No requirement steps found in {manifest_path}")
    return steps


def _pip_install_command(python_path: Path, packages: Iterable[str]) -> list[str]:
    return [
        str(python_path),
        "-m",
        "pip",
        "install",
        "--upgrade",
        "--disable-pip-version-check",
        "--upgrade-strategy",
        "only-if-needed",
        "--only-binary=:all:",
        *packages,
    ]


def _probe_command(python_path: Path) -> list[str]:
    return [
        str(python_path),
        "-c",
        (
            "from codexlens.semantic.reranker.factory import check_reranker_available; "
            "print(check_reranker_available('onnx'))"
        ),
    ]


def _download_command(huggingface_cli: Path, model_name: str, model_dir: Path) -> list[str]:
    return [
        str(huggingface_cli),
        "download",
        model_name,
        "--local-dir",
        str(model_dir),
    ]


def _print_plan(
    shell: str,
    venv_path: Path,
    python_path: Path,
    huggingface_cli: Path,
    manifest_path: Path,
    steps: list[RequirementStep],
    model_name: str,
    hf_home: Path,
) -> None:
    model_dir = _model_local_dir(hf_home, model_name)

    print("CodexLens local reranker bootstrap")
    print(f"manifest: {manifest_path}")
    print(f"target_venv: {venv_path}")
    print(f"target_python: {python_path}")
    print(f"backend: onnx")
    print(f"model: {model_name}")
    print(f"hf_home: {hf_home}")
    print("mode: dry-run")
    print("notes:")
    print("- Uses only the selected venv Python; no global pip commands are emitted.")
    print("- Targets the local ONNX reranker backend only; no API or LiteLLM providers are involved.")
    print("")
    print("pinned_steps:")
    for step in steps:
        print(f"- {step.name}: {', '.join(step.packages)}")
        note = STEP_NOTES.get(step.name)
        if note:
            print(f"  note: {note}")
    print("")
    print("commands:")
    print(
        "1. "
        + _format_command(
            [
                str(python_path),
                "-m",
                "pip",
                "install",
                "--upgrade",
                "pip",
                "setuptools",
                "wheel",
            ],
            shell,
        )
    )
    command_index = 2
    for step in steps:
        print(f"{command_index}. " + _format_command(_pip_install_command(python_path, step.packages), shell))
        command_index += 1
    print(f"{command_index}. " + _format_set_env("HF_HOME", str(hf_home), shell))
    command_index += 1
    print(f"{command_index}. " + _format_command(_download_command(huggingface_cli, model_name, model_dir), shell))
    command_index += 1
    print(f"{command_index}. " + _format_command(_probe_command(python_path), shell))
    print("")
    print("optional_runtime_env:")
    print(_format_set_env("RERANKER_BACKEND", "onnx", shell))
    print(_format_set_env("RERANKER_MODEL", str(model_dir), shell))
    print(_format_set_env("HF_HOME", str(hf_home), shell))


def _run_command(command: list[str], *, env: dict[str, str] | None = None) -> None:
    command_env = os.environ.copy()
    if env:
        command_env.update(env)
    command_env.setdefault("PYTHONUTF8", "1")
    command_env.setdefault("PYTHONIOENCODING", "utf-8")
    subprocess.run(command, check=True, env=command_env)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Bootstrap pinned local-only ONNX reranker dependencies for a CodexLens virtual environment.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--venv",
        type=Path,
        default=PROJECT_ROOT / ".venv",
        help="Path to the CodexLens virtual environment (default: ./.venv under codex-lens).",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Model repo to pre-download for local reranking (default: {DEFAULT_MODEL}).",
    )
    parser.add_argument(
        "--hf-home",
        type=Path,
        default=DEFAULT_HF_HOME,
        help="Repo-local Hugging Face cache directory used for optional model downloads.",
    )
    parser.add_argument(
        "--shell",
        choices=("powershell", "bash"),
        default=_default_shell(),
        help="Shell syntax to use when rendering dry-run commands.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute the pinned install steps against the selected virtual environment.",
    )
    parser.add_argument(
        "--download-model",
        action="store_true",
        help="When used with --apply, pre-download the model into the configured HF_HOME directory.",
    )
    parser.add_argument(
        "--probe",
        action="store_true",
        help="When used with --apply, run a small reranker availability probe at the end.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the deterministic bootstrap plan. This is also the default when --apply is omitted.",
    )

    args = parser.parse_args()

    steps = _parse_manifest(MANIFEST_PATH)
    venv_path = _normalize_venv_path(args.venv)
    python_path = _venv_python(venv_path)
    huggingface_cli = _venv_huggingface_cli(venv_path)
    hf_home = args.hf_home.expanduser().resolve()

    if not args.apply:
        _print_plan(
            shell=args.shell,
            venv_path=venv_path,
            python_path=python_path,
            huggingface_cli=huggingface_cli,
            manifest_path=MANIFEST_PATH,
            steps=steps,
            model_name=args.model,
            hf_home=hf_home,
        )
        return 0

    if not python_path.exists():
        print(f"Target venv Python not found: {python_path}", file=sys.stderr)
        return 1

    _run_command(
        [
            str(python_path),
            "-m",
            "pip",
            "install",
            "--upgrade",
            "pip",
            "setuptools",
            "wheel",
        ]
    )
    for step in steps:
        _run_command(_pip_install_command(python_path, step.packages))

    if args.download_model:
        if not huggingface_cli.exists():
            print(f"Expected venv-local Hugging Face CLI not found: {huggingface_cli}", file=sys.stderr)
            return 1
        download_env = os.environ.copy()
        download_env["HF_HOME"] = str(hf_home)
        hf_home.mkdir(parents=True, exist_ok=True)
        _run_command(_download_command(huggingface_cli, args.model, _model_local_dir(hf_home, args.model)), env=download_env)

    if args.probe:
        local_model_dir = _model_local_dir(hf_home, args.model)
        probe_env = os.environ.copy()
        probe_env["HF_HOME"] = str(hf_home)
        probe_env.setdefault("RERANKER_BACKEND", "onnx")
        probe_env.setdefault("RERANKER_MODEL", str(local_model_dir if local_model_dir.exists() else args.model))
        _run_command(_probe_command(python_path), env=probe_env)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
