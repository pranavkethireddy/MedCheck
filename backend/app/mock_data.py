"""
Demo-reliability fallback (plan 5d): if RxNav/Supabase are flaky during
judging, the frontend can load one of these canned patients instead of
live data and still show a working demo end-to-end.
"""

MOCK_PATIENTS = [
    {
        "name": "Demo Patient — Grandma",
        "medications": [
            {"name": "Warfarin", "rxcui": "11289", "time_of_day": "08:00"},
            {"name": "Ibuprofen", "rxcui": "5640", "time_of_day": "08:30"},
            {"name": "Lisinopril", "rxcui": "29046", "time_of_day": "20:00"},
        ],
    },
    {
        "name": "Demo Patient — College Student",
        "medications": [
            {"name": "Sertraline", "rxcui": "312938", "time_of_day": "09:00"},
            {"name": "Tramadol", "rxcui": "10689", "time_of_day": "09:15"},
        ],
    },
]
