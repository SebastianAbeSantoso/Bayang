"""
One-command Hugging Face Spaces deployer for ShiftGuard.
Supports both Docker Spaces (full Python backend + React 19 UI + AMD_API_KEY secret)
and automatic fallback to Static Spaces (for free Hugging Face accounts where cpu-basic Docker is gated).
When deploying to a Static Space, it also places index.html, favicon.svg, and assets/* at the root
of the Space so https://<user>-shiftguard.hf.space/ serves the React 19 workbench immediately.
"""

import os
import sys
from pathlib import Path
from huggingface_hub import HfApi
from huggingface_hub.errors import HfHubHTTPError

ROOT = Path(__file__).resolve().parent


def load_dotenv_dict(path: Path) -> dict[str, str]:
    env_vars: dict[str, str] = {}
    if not path.exists():
        return env_vars
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars


def main() -> None:
    api = HfApi()
    try:
        info = api.whoami()
    except Exception as exc:
        print(f"[!] Not logged into Hugging Face CLI: {exc}")
        print("    Run: hf auth login   (and use a token with WRITE permission)")
        sys.exit(1)

    username = info.get("name")
    token_role = info.get("auth", {}).get("accessToken", {}).get("role", "unknown")
    print(f"[*] Authenticated as Hugging Face user: {username} (token role: {token_role})")
    if token_role == "read":
        print("\n[!] Your current Hugging Face token only has READ permissions.")
        print("    To deploy a Space, please authenticate with a WRITE token:")
        print("    1. Create a Write token at: https://huggingface.co/settings/tokens")
        print("    2. Run in terminal: hf auth login --token hf_YOUR_WRITE_TOKEN")
        print("    3. Re-run: python deploy_hf_space.py")
        sys.exit(1)

    repo_id = f"{username}/shiftguard"
    dotenv_vars = load_dotenv_dict(ROOT / ".env")
    amd_key = os.getenv("AMD_API_KEY") or dotenv_vars.get("AMD_API_KEY", "")

    sdk_used = "docker"
    try:
        print(f"[*] Creating Docker Space '{repo_id}'...")
        api.create_repo(
            repo_id=repo_id,
            repo_type="space",
            space_sdk="docker",
            exist_ok=True,
            private=False,
        )
    except HfHubHTTPError as exc:
        print(f"[!] Docker Space creation returned: {exc}")
        print("[*] Falling back to Static Space (free tier compatible)...")
        sdk_used = "static"
        api.create_repo(
            repo_id=repo_id,
            repo_type="space",
            space_sdk="static",
            exist_ok=True,
            private=False,
        )

    if sdk_used == "docker" and amd_key:
        try:
            api.add_space_secret(repo_id=repo_id, key="AMD_API_KEY", value=amd_key)
            api.add_space_variable(repo_id=repo_id, key="AMD_API_BASE", value="https://api.tokenfactory.amd.com/v1")
            api.add_space_variable(repo_id=repo_id, key="AMD_MODEL_ID", value="google/gemma-3-27b-it")
            print("[*] Configured AMD_API_KEY secret and AMD Token Factory variables on Space.")
        except Exception as sec_exc:
            print(f"[!] Note: Could not set Space secrets automatically ({sec_exc}).")

    print(f"[*] Uploading ShiftGuard repository to https://huggingface.co/spaces/{repo_id} ...")
    api.upload_folder(
        repo_id=repo_id,
        repo_type="space",
        folder_path=str(ROOT),
        ignore_patterns=[
            ".git/*",
            ".git",
            ".env",
            "**/node_modules/*",
            "**/__pycache__/*",
            ".pytest_cache/*",
            ".agent/*",
            ".agents/*",
            "archive/*",
            "scratch/*",
        ],
    )

    if sdk_used == "static":
        print("[*] Uploading prebuilt React 19 bundle (index.html + assets/) to Space root for Static SDK...")
        api.upload_folder(
            repo_id=repo_id,
            repo_type="space",
            folder_path=str(ROOT / "client"),
            path_in_repo="",
        )
        readme_text = (ROOT / "README.md").read_text(encoding="utf-8")
        readme_text = readme_text.replace(
            "sdk: docker\napp_port: 7860",
            "sdk: static\napp_file: index.html",
        )
        api.upload_file(
            path_or_fileobj=readme_text.encode("utf-8"),
            path_in_repo="README.md",
            repo_id=repo_id,
            repo_type="space",
        )

    print(f"\n[+] Successfully deployed ShiftGuard to Hugging Face Spaces ({sdk_used.upper()} SDK)!")
    print(f"    Space Page: https://huggingface.co/spaces/{repo_id}")
    print(f"    Direct App: https://{username}-shiftguard.hf.space/")


if __name__ == "__main__":
    main()
