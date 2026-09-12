"""
Severity ranking shared by /api/check-interactions. Interaction results
now come from two sources (app/known_interactions.py's curated pairs, and
app/openfda_client.py's label text-matching), and both emit severity
directly in the plan's own three-bucket vocabulary — the same one used by
the `interaction_flags.severity` column and /api/save-interaction-flag —
so there's no separate raw/display mapping to maintain anymore.
"""

SEVERITY_RANK = {"significant": 2, "minor": 1, "none": 0}


def sort_interactions_by_severity(interactions):
    return sorted(
        interactions,
        key=lambda i: SEVERITY_RANK.get(i.get("severity"), 0),
        reverse=True,
    )
