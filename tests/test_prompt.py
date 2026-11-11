"""Tests for app/prompt.py: a prompt exists for every dataset in both languages (offline: no index, no API)."""
import json
from types import SimpleNamespace

import pytest
import yaml

from app.prompt import PromptBuilder
from processing.domains import load_domains
from processing.recommend import EXPORT, MAJORS_FILE

ROOT = EXPORT.parents[2]
APP_CFG = yaml.safe_load((ROOT / "config" / "app.yaml").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def builder():
    doms = load_domains()
    state = SimpleNamespace(recs={r["dataset_id"]: r for r in json.loads(EXPORT.read_text(encoding="utf-8"))["datasets"]},
                            groups=doms["groups"], domains=doms["domains"],
                            majors=json.loads(MAJORS_FILE.read_text(encoding="utf-8"))["majors"],
                            universities=APP_CFG["universities"])
    return PromptBuilder(APP_CFG["prompt"], state)


def test_every_dataset_has_a_prompt_with_its_link(builder):
    for lang in ("ko", "en"):
        assert set(builder.blocks[lang]) == set(builder.S.recs)
        for i, r in builder.S.recs.items():
            out = builder.build(i, {}, {}, lang)
            assert r["source_url"] in out["prompt"], i
            assert "## (" in out["prompt"] and out["title"], i


def test_recommendation_path_and_student_are_written(builder):
    i = next(iter(builder.S.recs))
    major = builder.S.majors[0]
    dom = next(iter(builder.S.domains))
    p = {"univ": "ku_sejong", "major": major["id"], "interests": [dom], "text": "도로 사진으로 신호등 찾기"}
    via = {"kind": "recommend", "rank": 2, "total": 12, "score": 7.84, "match": "partial",
           "reasons": ["검색한 내용과 잘 맞습니다", "고른 관심 분야인 의료·질병 진단에 속합니다",
                       "전공(경제통계학부(경제정책학전공))과 가까운 영상 인식, 의료 분야입니다"]}
    s = builder.build(i, p, via, "ko")["prompt"]
    for part in (major["name_ko"], builder.S.domains[dom]["ko"], "도로 사진으로 신호등 찾기", "12개 중 2위", "10점 만점에 7.8점",
                 "일부 맞음", "맞춤 추천", "  - 제가 찾는 내용과 잘 맞습니다.", "  - 제가 고른 관심 분야인 의료·질병 진단에 속합니다.",
                 "  - 제 전공(경제통계학부(경제정책학전공))과 가까운 영상 인식, 의료 분야입니다."):
        assert part in s, part
    assert "검색한" not in s and "  - 고른" not in s


def test_reasons_in_english_are_first_person():
    from app.prompt import first_person
    assert first_person("Matches what you searched for", "en") == "It matches what I searched for."
    assert first_person("In Medical, Vision, an interest you picked", "en") == "It is in Medical, Vision, an interest I picked."
    assert first_person("In Vision, a field close to your major (Software (AI))", "en") == "It is in Vision, a field close to my major (Software (AI))."
    assert first_person("Something new", "ko") == "Something new"


def test_browse_path_names_field_and_topic_and_empty_profile_is_left_out(builder):
    i = next(iter(builder.S.recs))
    dom, d = next(iter(builder.S.domains.items()))
    s = builder.build(i, {}, {"kind": "browse", "topic": dom}, "ko")["prompt"]
    assert f"{builder.S.groups[d['group']]['ko']} > {d['ko']}" in s
    assert "## 내 정보" not in s


def test_bad_input_is_handled(builder):
    i = next(iter(builder.S.recs))
    assert builder.build("no-such-id", {}, {}, "ko") is None
    s = builder.build(i, {"major": "x", "interests": ["y"]}, {"kind": "hack", "rank": "1", "score": 99}, "ko")["prompt"]
    assert "직접 열어 봄" in s and "위" not in s.split("## 데이터 정보")[0].split("## 이 데이터를 찾은 경로")[1]
