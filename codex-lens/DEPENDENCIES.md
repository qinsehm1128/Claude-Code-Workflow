# Dependency Management

This project uses setuptools with `pyproject.toml` for dependency management.

## Locking Dependencies

To generate a fully pinned `requirements.txt` from `requirements.in`:

```bash
# Install pip-tools
pip install pip-tools

# Compile requirements
pip-compile requirements.in --output-file=requirements.txt

# To upgrade dependencies
pip-compile --upgrade requirements.in --output-file=requirements.txt
```

## Version Constraints

This project uses **pessimistic versioning** (`~=`) for dependency specifications per PEP 440:

- `typer~=0.9.0` means: `>=0.9.0, ==0.9.*`
- Allows bugfix updates (0.9.0, 0.9.1, 0.9.2) but not feature/minor updates (0.10.0)

This provides stability while allowing automatic patch updates.

## Security Scanning

The project includes automated security scanning via GitHub Actions:
- Runs on every push to main branch
- Runs weekly (Sundays at 00:00 UTC)
- Can be triggered manually

The scan uses:
- `pip-audit`: Checks for known vulnerabilities in dependencies
- `bandit`: Security linter for Python code
