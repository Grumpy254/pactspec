import json
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List

import jsonschema
from jsonschema import Draft202012Validator

_SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.json")
_schema: Dict[str, Any] = {}
_validator: Any = None


def _get_validator() -> Draft202012Validator:
    global _schema, _validator
    if _validator is None:
        with open(_SCHEMA_PATH, "r", encoding="utf-8") as f:
            _schema = json.load(f)
        _validator = Draft202012Validator(_schema)
    return _validator


@dataclass
class ValidateResult:
    valid: bool
    errors: List[str] = field(default_factory=list)


def validate(spec: Any) -> ValidateResult:
    """Validate a PactSpec document against the canonical v1 schema.

    Synchronous — no network calls.

    Args:
        spec: The spec document as a dict (or any JSON-serialisable value).

    Returns:
        ValidateResult with valid=True and empty errors list, or
        valid=False with a list of human-readable error strings.

    Example:
        result = validate(my_spec)
        if not result.valid:
            for err in result.errors:
                print(err)
    """
    validator = _get_validator()
    errors = sorted(validator.iter_errors(spec), key=lambda e: list(e.path))
    if not errors:
        return ValidateResult(valid=True)
    return ValidateResult(
        valid=False,
        errors=[
            f"{'/' + '/'.join(str(p) for p in e.path) if e.path else '/'} {e.message}"
            for e in errors
        ],
    )
