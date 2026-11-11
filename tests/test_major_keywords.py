"""Tests for suggested keywords (processing/major_keywords.py), offline."""
import yaml

from processing.major_keywords import _CODE, candidates, choose
from processing.recommend import RANKING_FILE

CFG = yaml.safe_load(RANKING_FILE.read_text(encoding="utf-8"))
MAJOR = {"data_interests": [{"topic_ko": "의약품 식별", "topic_en": "Pill identification", "keywords": ["알약 이미지", "LLM"]}],
         "key_topics": ["신약 개발", "독성학과 안전성(Toxicology)"]}
RECORDS = [{"keywords_ko": ["약초", "합성 데이터"], "keywords_en": ["medicinal herbs", "YOLOv8"]},
           {"keywords_ko": ["약초", "합성 데이터"], "keywords_en": ["medicinal herbs", "YOLOv8"]}]


def test_code_like_words():
    for w in ["YOLOv5-seg", "Sentinel-2", "OpenNMT", "SLAM", "K-IFRS", "P&ID", "Qwen3"]:
        assert _CODE.search(w), w
    for w in ["3D pose", "4D radar", "crack detection", "Korean-English", "약초"]:
        assert not _CODE.search(w), w


def test_candidates_drop_method_words_and_codes():
    ko = candidates(MAJOR, RECORDS, "ko", CFG)
    assert ko["알약 이미지"] == "profile" and ko["약초"] == "datasets"
    assert "LLM" not in ko and "합성 데이터" not in ko                     # stop words
    assert "독성학과 안전성" in ko                                          # text in brackets removed
    en = candidates(MAJOR, RECORDS, "en", CFG)
    assert "Pill identification" in en and "medicinal herbs" in en and "YOLOv8" not in en


def test_choose_skips_overlapping_keywords():
    scored = [{"keyword": "a", "source": "datasets", "top_score": 9.0, "top_ids": ["1", "2", "3"]},
              {"keyword": "a2", "source": "datasets", "top_score": 8.9, "top_ids": ["1", "2", "3"]},
              {"keyword": "b", "source": "profile", "top_score": 8.0, "top_ids": ["7", "8", "9"]}]
    assert [x["keyword"] for x in choose(scored, CFG)] == ["a", "b"]
