from dataclasses import dataclass
from datetime import date, timedelta

from app.services.days import week_start


@dataclass
class StreakInfo:
    streak: int
    week_progress: int
    week_threshold: int


def compute_streak(
    statuses: dict[date, str], today: date, threshold: int
) -> StreakInfo:
    """Count consecutive completed Monday-Sunday weeks.

    ``statuses`` maps a day to 'workout' / 'rest' / 'sick'. A week is
    completed when its days with a workout reach ``threshold``. Rest
    only never counts as a workout day. A week with a 'sick' day that
    is not completed freezes the streak (neither adds nor breaks).
    The current week never breaks the streak while it is in progress.
    """
    this_week = week_start(today)

    def counts(monday: date) -> tuple[int, bool]:
        days = [monday + timedelta(days=i) for i in range(7)]
        workouts = sum(statuses.get(d) == 'workout' for d in days)
        sick = any(statuses.get(d) == 'sick' for d in days)
        return workouts, sick

    progress, _ = counts(this_week)
    if not statuses:
        return StreakInfo(0, progress, threshold)

    earliest = week_start(min(statuses))
    streak = 1 if progress >= threshold else 0
    monday = this_week - timedelta(days=7)
    while monday >= earliest:
        workouts, sick = counts(monday)
        if workouts >= threshold:
            streak += 1
        elif not sick:
            break
        monday -= timedelta(days=7)
    return StreakInfo(streak, progress, threshold)
