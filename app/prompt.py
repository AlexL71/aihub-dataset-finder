"""Prompt for an outside AI (ChatGPT, Claude, Gemini): the student copies it and pastes it there.

No model is called here. The dataset part of every prompt is built once at start-up for all datasets and both
languages (`PromptBuilder.blocks`); a request only adds the student part and how the dataset was found:
  - the student's university, major, interests and request (left out when empty)
  - the path: a DataFinder recommendation (rank, relevance, match, reasons), a field/topic in browse or the data map,
    the compare page, or the dataset page opened directly
Endpoint: POST /api/prompt (app/server.py). Settings: config/app.yaml, `prompt:`.
"""
from __future__ import annotations

import re

from processing.cards import LEVEL, MODALITY

TEXT = {
    "ko": {
        "intro": "저는 대학생이고, 아래 AI Hub 데이터로 AI 프로젝트를 해 보려고 합니다. 제 정보와 이 데이터를 찾은 경로, 데이터 정보를 보고 저에게 맞는 프로젝트 하나를 계획해 주세요.",
        "rules": ("- 데이터 정보에 없는 사실(데이터 양, 라벨, 파일 구성 등)은 지어내지 말고, 모르는 내용은 AI Hub 페이지에서 확인하라고 알려 주세요.\n"
                  "- 추천 이유와 제 전공, 관심 분야를 살려서 계획해 주세요.\n"
                  "- 저는 AI를 처음 배우는 중일 수 있으니 쉬운 말로 써 주시고, 전문 용어는 처음 나올 때 짧게 풀어 주세요.\n"
                  "- 한국어로 답해 주세요."),
        "me": "내 정보", "univ": "대학교", "major": "전공", "interests": "관심 분야", "want": "하고 싶은 일",
        "path": "이 데이터를 찾은 경로", "how": "찾은 방법",
        "kind": {"recommend": "AI Hub DataFinder의 맞춤 추천 (내 전공, 관심 분야, 검색어를 바탕으로 고른 데이터)",
                 "browse": "AI Hub DataFinder의 분야별 둘러보기", "map": "AI Hub DataFinder의 데이터 지도",
                 "compare": "AI Hub DataFinder의 비교함", "direct": "AI Hub DataFinder에서 데이터 상세 정보를 직접 열어 봄"},
        "query": "검색어", "rank": "추천 순위", "rank_v": "{total}개 중 {rank}위", "score": "관련도", "score_v": "10점 만점에 {score}점",
        "match": "검색어와 맞는 정도", "match_v": {"strong": "잘 맞음", "partial": "일부 맞음",
                                          "weak": "정확히 맞는 데이터는 없어 가장 가까운 데이터로 추천됨"},
        "reasons": "추천 이유", "where": "찾아본 분야",
        "data": "데이터 정보", "name": "데이터 이름", "url": "AI Hub 주소", "topics": "주제", "types": "데이터 종류", "formats": "파일 형식",
        "size": "전체 용량", "amount": "데이터 양", "labels": "라벨(표시)", "classes": "항목 예시", "base": "기준 성능", "level": "난이도",
        "built": "만든 해·기관", "easy": "한 줄 설명", "detail": "자세한 설명", "ideas": "이 데이터로 할 수 있는 프로젝트 예시",
        "format": "답변 형식 (마크다운)",
        "outline": ("## (프로젝트 제목)\n**한 줄 요약**: (한 문장)\n### 왜 이 데이터인가\n### 진행 단계\n(번호 목록 4~6단계)\n"
                    "### 필요한 도구와 기술\n### 예상 난이도와 기간\n### 데이터를 받을 때 팁\n### 더 발전시키려면"),
        "end": "계획을 쓴 뒤에는 1단계부터 함께 진행할 수 있도록, 제가 먼저 준비할 것이 무엇인지 물어봐 주세요. 데이터는 AI Hub에서 신청해 내려받을 예정입니다.",
    },
    "en": {
        "intro": "I am a university student and want to do an AI project with the AI Hub dataset below. Please read my profile, how I found this dataset and the dataset information, and plan one project that fits me.",
        "rules": ("- Do not invent facts that are not in the dataset information (amount, labels, files); if something is missing, tell me to check the AI Hub page.\n"
                  "- Build on the recommendation reasons, my major and my interests.\n"
                  "- I may be new to AI: use plain words and explain a technical term briefly the first time.\n"
                  "- Answer in English."),
        "me": "About me", "univ": "University", "major": "Major", "interests": "Interests", "want": "What I want to do",
        "path": "How I found this dataset", "how": "Found through",
        "kind": {"recommend": "a personal recommendation in AI Hub DataFinder (picked from my major, interests and search words)",
                 "browse": "browsing by field in AI Hub DataFinder", "map": "the data map in AI Hub DataFinder",
                 "compare": "the compare page in AI Hub DataFinder", "direct": "opening the dataset page in AI Hub DataFinder directly"},
        "query": "Search words", "rank": "Rank", "rank_v": "{rank} of {total}", "score": "Relevance", "score_v": "{score} out of 10",
        "match": "Match with the search words", "match_v": {"strong": "good", "partial": "partial",
                                                           "weak": "no exact match; this is the closest dataset"},
        "reasons": "Why it was recommended", "where": "Field looked at",
        "data": "Dataset", "name": "Name", "url": "AI Hub page", "topics": "Topics", "types": "Data types", "formats": "File formats",
        "size": "Total size", "amount": "Amount", "labels": "Labels", "classes": "Example classes", "base": "Baseline results", "level": "Level",
        "built": "Built (year, organisation)", "easy": "In short", "detail": "Details", "ideas": "Project ideas for this dataset",
        "format": "Answer format (markdown)",
        "outline": ("## (Project title)\n**In one sentence**: (one sentence)\n### Why this dataset\n### Steps\n(numbered list, 4-6 steps)\n"
                    "### Tools and skills\n### Difficulty and time\n### Tips for getting the data\n### Taking it further"),
        "end": "After the plan, ask me what I should prepare first so we can go through it from step 1. I will request the data on AI Hub.",
    },
}
KINDS = ("recommend", "browse", "map", "compare", "direct")
# recommendation reasons are written to the student on screen (processing/recommend.py, _explain);
# in the prompt the student is speaking, so they are rewritten in the first person. Unknown text is kept as it is.
VOICE = {
    "ko": [(re.compile(r"^검색한 내용과 잘 맞습니다\.?$"), lambda m: "제가 찾는 내용과 잘 맞습니다."),
           (re.compile(r"^고른 관심 분야인 (.+)에 속합니다\.?$"), lambda m: f"제가 고른 관심 분야인 {m[1]}에 속합니다."),
           (re.compile(r"^전공\((.+)\)과 가까운 (.+) 분야입니다\.?$"), lambda m: f"제 전공({m[1]})과 가까운 {m[2]} 분야입니다.")],
    "en": [(re.compile(r"^Matches what you searched for\.?$"), lambda m: "It matches what I searched for."),
           (re.compile(r"^In (.+), an interest you picked\.?$"), lambda m: f"It is in {m[1]}, an interest I picked."),
           (re.compile(r"^In (.+), a field close to your major \((.+)\)\.?$"), lambda m: f"It is in {m[1]}, a field close to my major ({m[2]}).")],
}


def first_person(reason: str, lang: str) -> str:
    for pat, fix in VOICE[lang]:
        if m := pat.match(reason):
            return fix(m)
    return reason


def _clip(v, n: int) -> str:
    return " ".join(str(v or "").split())[:n]


class PromptBuilder:
    def __init__(self, cfg: dict, state) -> None:
        self.cfg, self.S = cfg, state
        self.blocks = {lg: {i: self._dataset_block(r, lg) for i, r in state.recs.items()} for lg in TEXT}   # all datasets, built once

    # ---------- dataset part (same for every student) ----------
    def _dataset_block(self, r: dict, lang: str) -> tuple[str, str]:
        """(title, markdown) for one dataset."""
        E, ko, S = TEXT[lang], lang == "ko", self.S
        row = lambda k, v: f"- {E[k]}: {v}\n" if v and v != "?" else ""
        title = r["title_ko"] if ko else r["title_en"]
        detail = _clip(r.get("detail_ko" if ko else "detail_en") or r.get("contents_ko"), int(self.cfg.get("detail_chars", 1200)))
        base = "; ".join(f"{b['model']} {b['metric']} {b['value']}" for b in r.get("baseline", [])[:3])
        ideas = "\n".join(f"- {x['title_ko' if ko else 'title_en']}: {x['desc_ko' if ko else 'desc_en']}" for x in r.get("project_ideas", []))
        built = ", ".join(str(x) for x in (r.get("build_year"), r.get("lead_organization")) if x)
        data = (row("name", title) + row("url", r["source_url"])
                + row("topics", ", ".join(S.domains[d]["ko" if ko else "en"] for d in r["domains"] if d in S.domains))
                + row("types", ", ".join(MODALITY.get(m, (m, m))[0 if ko else 1] for m in r["modalities"]))
                + row("formats", ", ".join(r["file_formats"])) + row("size", f"{r['total_gb']:,.1f} GB" if r["total_gb"] else "")
                + row("amount", r.get("amount_ko" if ko else "amount_en") or r.get("scale_ko"))
                + row("labels", r.get("labels_ko" if ko else "labels_en") or ", ".join(r.get("labels", [])))
                + row("classes", ", ".join(r.get("classes_example", [])[:10])) + row("base", base)
                + row("level", LEVEL.get(r["difficulty"], (r["difficulty"],) * 2)[0 if ko else 1]) + row("built", built)
                + row("easy", r.get("easy_ko" if ko else "easy_en") or r.get("summary_ko")))
        parts = [f"## {E['data']}\n{data}".rstrip()]
        if detail:
            parts.append(f"### {E['detail']}\n{detail}")
        if ideas:
            parts.append(f"### {E['ideas']}\n{ideas}")
        return title, "\n\n".join(parts)

    # ---------- student part ----------
    def _student(self, p: dict, E: dict, ko: bool) -> str:
        S = self.S
        major = next((m for m in S.majors if m["id"] == p.get("major")), None)
        univ = next((u for u in S.universities if u["id"] == p.get("univ")), None)
        interests = [S.domains[d]["ko" if ko else "en"] for d in (p.get("interests") or []) if d in S.domains]
        rows = [(E["univ"], univ and univ["ko" if ko else "en"]), (E["major"], major and major["name_ko" if ko else "name_en"]),
                (E["interests"], ", ".join(interests)), (E["want"], _clip(p.get("text"), 300))]
        return "".join(f"- {k}: {v}\n" for k, v in rows if v)

    def _path(self, via: dict, query: str, E: dict, ko: bool) -> str:
        lang = "ko" if ko else "en"
        S = self.S
        kind = via.get("kind") if via.get("kind") in KINDS else "direct"
        out = [f"- {E['how']}: {E['kind'][kind]}"]
        if kind == "recommend":
            if query:
                out.append(f"- {E['query']}: \"{query}\"")
            rank, total = via.get("rank"), via.get("total")
            if isinstance(rank, int) and isinstance(total, int) and 0 < rank <= total:
                out.append(f"- {E['rank']}: " + E["rank_v"].format(rank=rank, total=total))
            if isinstance(via.get("score"), (int, float)) and 0 <= via["score"] <= 10:
                out.append(f"- {E['score']}: " + E["score_v"].format(score=f"{via['score']:.1f}"))
            if via.get("match") in E["match_v"]:
                out.append(f"- {E['match']}: {E['match_v'][via['match']]}")
            reasons = [first_person(_clip(x, 160), lang) for x in (via.get("reasons") or [])[:4] if _clip(x, 160)]
            if reasons:
                out.append(f"- {E['reasons']}:\n" + "\n".join(f"  - {x}" for x in reasons))
        elif kind in ("browse", "map"):
            g, d = S.groups.get(via.get("field") or ""), S.domains.get(via.get("topic") or "")
            if d and not g:
                g = S.groups.get(d["group"])
            names = [x["ko" if ko else "en"] for x in (g, d) if x]
            if names:
                out.append(f"- {E['where']}: " + " > ".join(names))
        return "\n".join(out) + "\n"

    def build(self, dataset_id: str, profile: dict, via: dict, lang: str) -> dict | None:
        lang = "en" if lang == "en" else "ko"
        if dataset_id not in self.blocks[lang]:
            return None
        E, ko = TEXT[lang], lang == "ko"
        title, data = self.blocks[lang][dataset_id]
        me = self._student(profile or {}, E, ko)
        parts = [E["intro"], E["rules"]]
        if me:
            parts.append(f"## {E['me']}\n{me}".rstrip())
        parts.append(f"## {E['path']}\n{self._path(via or {}, _clip((profile or {}).get('text'), 300), E, ko)}".rstrip())
        parts += [data, f"## {E['format']}\n```markdown\n{E['outline']}\n```", E["end"]]
        return {"prompt": "\n\n".join(parts) + "\n", "title": title, "url": self.S.recs[dataset_id]["source_url"]}
