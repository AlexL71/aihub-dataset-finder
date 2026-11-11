"""Tests for the scoring rules in processing/recommend.py (offline: no index, no API)."""
import numpy as np
import pytest
import yaml

from processing.recommend import (RANKING_FILE, chip_interest, combine, major_fit, major_score, mmr, pick_idea,
                                  scale_sims, text_interest)

CFG = yaml.safe_load(RANKING_FILE.read_text(encoding="utf-8"))
LINKS = [{"domain": "city_space", "level": "core"}, {"domain": "traffic_transport", "level": "core"},
         {"domain": "energy", "level": "related"}]


def test_text_interest_is_clipped_and_mixes_rank():
    assert text_interest(0.40, 0.40, 0.0, 1.0, CFG) == 0.0                     # below sim_low, rank 0
    assert text_interest(0.90, 0.10, 1.0, 1.0, CFG) == pytest.approx(1.0)     # above sim_high, best rank
    assert text_interest(0.675, 0.0, 0.5, 1.0, CFG) == pytest.approx(0.5)     # halfway sim, half rank


def test_chip_interest_main_beats_other():
    assert chip_interest(["pets_vet", "medical"], ["pets_vet"], CFG) == 1.0
    assert chip_interest(["medical", "pets_vet"], ["pets_vet"], CFG) == 0.6
    assert chip_interest(["law"], ["pets_vet"], CFG) == 0.0


def test_major_fit_order():
    assert major_fit(["city_space"], LINKS, CFG) == 1.0
    assert major_fit(["satellite_aerial", "traffic_transport"], LINKS, CFG) == 0.8
    assert major_fit(["energy"], LINKS, CFG) == 0.6
    assert major_fit(["manufacturing", "energy"], LINKS, CFG) == 0.5
    assert major_fit(["law"], LINKS, CFG) == 0.0


def test_profile_similarity_scaled_per_major():
    s = scale_sims(np.array([0.50, 0.60, 0.60, 0.70, 0.80]))     # median 0.60, max 0.80
    assert s.tolist() == pytest.approx([0.0, 0.0, 0.0, 0.5, 1.0])
    assert scale_sims(np.array([0.6, 0.6])).tolist() == [0.0, 0.0]   # all equal: no division by zero


def test_major_score_mixes_links_and_profile():
    share = CFG["major"]["profile_share"]
    assert major_score(1.0, 1.0, CFG) == pytest.approx(1.0)
    assert major_score(1.0, 0.0, CFG) == pytest.approx(1 - share)              # linked domain, unlike profile
    assert major_score(0.0, 1.0, CFG) == pytest.approx(share)                  # not linked, very like profile


def test_score_is_0_to_10():
    assert combine({"interest": 1.0, "major": 1.0}, CFG, True) == pytest.approx(10.0)
    assert combine({"interest": 0.0, "major": 0.0}, CFG, False) == 0.0
    assert combine({}, CFG, False) == 0.0


def test_missing_part_is_skipped():
    assert combine({"interest": 0.7}, CFG, True) == pytest.approx(7.0)       # no major given
    assert combine({"major": 0.5}, CFG, False) == pytest.approx(5.0)         # no text, no chips


def test_text_request_outweighs_major():
    # exactly what the student asked for, outside the major vs. a weak match inside the major
    asked = {"interest": 1.0, "major": 0.0}
    weak_in_major = {"interest": 0.3, "major": 1.0}
    assert combine(asked, CFG, True) > combine(weak_in_major, CFG, True)


def test_mmr_avoids_near_duplicates():
    v = {"a": np.array([1.0, 0.0]), "a2": np.array([1.0, 0.0]), "b": np.array([0.0, 1.0])}
    scores = {"a": 9.0, "a2": 8.9, "b": 7.0}
    assert mmr(["a", "a2", "b"], scores, v, 2, 0.75) == ["a", "b"]             # a2 is a copy of a
    assert mmr(["a", "a2", "b"], scores, v, 2, 1.0) == ["a", "a2"]             # lambda 1 = plain ranking


def test_pick_idea_follows_purpose():
    ideas = [{"level": "beginner"}, {"level": "capstone"}, {"level": "research"}]
    assert pick_idea(ideas, "thesis", CFG)["level"] == "research"
    assert pick_idea(ideas, None, CFG)["level"] == "beginner"                  # no purpose: first idea
    assert pick_idea([], "class", CFG) is None
