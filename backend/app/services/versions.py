def parse_version(value: str | None) -> tuple[int, ...] | None:
    """'1.2.3' -> (1, 2, 3); anything unparseable -> None."""
    if not value:
        return None
    try:
        parts = tuple(int(p) for p in value.strip().lstrip('v').split('.'))
    except ValueError:
        return None
    return parts or None


def _pad(a: tuple[int, ...], b: tuple[int, ...]):
    n = max(len(a), len(b))
    return a + (0,) * (n - len(a)), b + (0,) * (n - len(b))


def is_older(current: tuple[int, ...], other: tuple[int, ...]) -> bool:
    a, b = _pad(current, other)
    return a < b
