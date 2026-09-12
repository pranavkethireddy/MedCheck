"""
Timeline / schedule "wow layer" (plan Priority 2): given a user's saved
medications, each with an optional time_of_day ("08:00", "20:30", ...),
flag pairs of meds taken in the same window so the frontend can highlight
them on a day-view timeline.

This is intentionally simple for hackathon speed: two doses "overlap" if
they fall within `window_minutes` of each other (default 60).
"""

import re

_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})$")


def parse_time_to_minutes(time_str):
    if not time_str or not isinstance(time_str, str):
        return None
    match = _TIME_RE.match(time_str.strip())
    if not match:
        return None
    hours, minutes = int(match.group(1)), int(match.group(2))
    if hours > 23 or minutes > 59:
        return None
    return hours * 60 + minutes


def find_schedule_overlaps(medications, window_minutes=60):
    """
    medications: [{ "id": ..., "name": ..., "time_of_day": "08:00" }, ...]
    returns: [{ "a": med, "b": med, "minutesApart": int }, ...]
    """
    timed = [
        (med, parse_time_to_minutes(med.get("time_of_day")))
        for med in medications
    ]
    timed = [(med, minutes) for med, minutes in timed if minutes is not None]

    overlaps = []
    for i in range(len(timed)):
        for j in range(i + 1, len(timed)):
            diff = abs(timed[i][1] - timed[j][1])
            if diff <= window_minutes:
                overlaps.append({"a": timed[i][0], "b": timed[j][0], "minutesApart": diff})
    return overlaps
