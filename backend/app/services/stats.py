from dataclasses import dataclass
from datetime import date, timedelta

from app.services.days import week_start


def longest_streak(
    statuses: dict[date, str], today: date, threshold: int
) -> int:
    """Longest run of consecutive completed weeks, same rules as
    ``compute_streak``: a sick week freezes the run, the week in
    progress never breaks it."""
    if not statuses:
        return 0
    this_week = week_start(today)
    monday = week_start(min(statuses))
    best = run = 0
    while monday <= this_week:
        days = [monday + timedelta(days=i) for i in range(7)]
        workouts = sum(statuses.get(d) == 'workout' for d in days)
        sick = any(statuses.get(d) == 'sick' for d in days)
        if workouts >= threshold:
            run += 1
            best = max(best, run)
        elif not sick and monday != this_week:
            run = 0
        monday += timedelta(days=7)
    return best


def weekly_days(
    statuses: dict[date, str], today: date, weeks: int
) -> list[tuple[date, int]]:
    """(monday, days with a workout) for the last ``weeks`` weeks,
    oldest first, ending with the current week."""
    this_week = week_start(today)
    out = []
    for i in range(weeks - 1, -1, -1):
        monday = this_week - timedelta(days=7 * i)
        n = sum(
            statuses.get(monday + timedelta(days=d)) == 'workout'
            for d in range(7)
        )
        out.append((monday, n))
    return out


def best_week_days(statuses: dict[date, str]) -> int:
    per_week: dict[date, int] = {}
    for day, status in statuses.items():
        if status == 'workout':
            monday = week_start(day)
            per_week[monday] = per_week.get(monday, 0) + 1
    return max(per_week.values(), default=0)


@dataclass(frozen=True)
class BadgeDef:
    id: str
    icon: str
    title: str
    description: str
    target: int
    metric: str


BADGES = (
    BadgeDef(
        'first', '🎉', 'Pierwszy krok', 'Pierwszy trening', 1, 'workouts'
    ),
    BadgeDef('days_10', '💪', 'Rozgrzewka', '10 dni z treningiem', 10, 'days'),
    BadgeDef('days_50', '🏃', 'Wytrwały', '50 dni z treningiem', 50, 'days'),
    BadgeDef('days_100', '💯', 'Setka', '100 dni z treningiem', 100, 'days'),
    BadgeDef(
        'streak_4', '🔥', 'Miesiąc w ruchu', '4 tygodnie serii', 4, 'streak'
    ),
    BadgeDef(
        'streak_12', '🚀', 'Kwartał w ruchu', '12 tygodni serii', 12, 'streak'
    ),
    BadgeDef('streak_26', '🌟', 'Pół roku', '26 tygodni serii', 26, 'streak'),
    BadgeDef(
        'streak_52', '👑', 'Rok w ruchu', '52 tygodnie serii', 52, 'streak'
    ),
    BadgeDef(
        'week_5',
        '⚡',
        'Mocny tydzień',
        '5 dni z treningiem w tygodniu',
        5,
        'week',
    ),
    BadgeDef(
        'week_7',
        '🏆',
        'Pełny tydzień',
        'Trening każdego dnia tygodnia',
        7,
        'week',
    ),
    BadgeDef(
        'variety',
        '🧭',
        'Wszechstronny',
        '5 różnych rodzajów treningu',
        5,
        'kinds',
    ),
    BadgeDef(
        'photos_20', '📸', 'Fotograf', '20 zdjęć treningów', 20, 'photos'
    ),
)


def badge_progress(metrics: dict[str, int]) -> list[dict]:
    out = []
    for b in BADGES:
        value = metrics.get(b.metric, 0)
        out.append(
            {
                'id': b.id,
                'icon': b.icon,
                'title': b.title,
                'description': b.description,
                'earned': value >= b.target,
                'progress': min(value, b.target),
                'target': b.target,
            }
        )
    return out
