// "About" pages: #/about/aihub (what AI Hub is), #/about/map (data map), #/about/method (how relatedness is scored).
// Loaded before app.js and uses its shared helpers ($, esc, t, lang, view, setFrame, api, navSeq, tile, name, L).
// Charts follow the dataviz rules: one hue for single-series bars, values as text, hover tooltips, fixed group colors.
"use strict";

const AT = {
  ko: {
    sub_aihub: "AI Hub 알아보기", sub_map: "데이터 지도", sub_prep: "데이터 준비 과정", sub_method: "관련도 계산 방법",
    // AI Hub page
    ah_title: "AI Hub는 어떤 곳인가요?",
    ah_intro: "AI Hub는 과학기술정보통신부와 한국지능정보사회진흥원(NIA)이 운영하는 AI 통합 플랫폼입니다. AI 개발에 필요한 학습용 데이터, AI 소프트웨어 API, 컴퓨팅 자원을 연구자, 기업, 공공기관 누구나 이용할 수 있습니다.",
    ah_numbers: "숫자로 보는 AI Hub", n_data: "공개 데이터", n_fields: "AI Hub 분야", n_tb: "전체 용량", n_manual: "설명서 제공 데이터",
    u_count: "개", u_tb: "TB",
    ah_can: "AI Hub에서 할 수 있는 일",
    can: [
      ["AI 학습용 데이터", "정부 사업으로 구축한 학습용 데이터와 기관·기업이 제공한 데이터를 14개 분야로 나누어 공개합니다."],
      ["오픈 API와 AI Hub Shell", "명령어 도구로 데이터 목록과 파일 구성을 확인하고, 승인받은 데이터를 다운로드합니다."],
      ["안심존", "개인정보 등 민감한 데이터는 외부로 가져가지 않고 AI Hub 보안 서버(GPU 포함)에서 분석합니다. 온라인 안심존과 오프라인 안심존이 있습니다."],
      ["교육 자료와 K-AI Leaderboard", "수준별 AI 교육 자료가 있고, NIA 평가 데이터로 언어모델(LLM) 성능을 비교하는 공개 순위표도 운영합니다."],
    ],
    ah_steps: "데이터 이용 절차",
    steps: [
      "AI Hub에 회원가입 후 로그인합니다.",
      "원하는 데이터 페이지에서 이용 신청을 합니다. 일부 데이터는 내국인만 신청할 수 있습니다.",
      "승인되면 웹 또는 AI Hub Shell로 다운로드합니다. 용량이 크면 필요한 파일만 골라 받을 수 있습니다.",
      "안심존 데이터는 별도 신청서를 내고 NIA 검토(최대 2주)를 거친 뒤 보안 서버에서 이용합니다.",
    ],
    ch_fields: "AI Hub 분야별 데이터 수", ch_years: "구축 연도별 데이터 수", ch_mods: "데이터 유형별 데이터 수",
    ch_mods_note: "데이터 하나에 이미지와 텍스트처럼 여러 유형이 함께 있을 수 있어 합계가 867개보다 많습니다.",
    ch_basis: "2026년 10월 말에 수집한 AI Hub 데이터 867개 기준입니다.",
    of_total: "전체의 {p}%", downloads_n: "다운로드 {n}회",
    ah_top: "다운로드가 많은 데이터",
    ah_notes: "이용 시 참고 사항",
    notes: [
      "논문이나 결과물에 데이터를 사용하면 '한국지능정보사회진흥원의 사업결과'임을 밝혀야 합니다.",
      "해외 이용자는 NIA와 별도 협약을 맺어야 데이터를 이용할 수 있습니다.",
      "AI Hub DataFinder는 AI Hub와 관계없는 학생 연구 프로젝트입니다. 데이터 신청과 다운로드는 AI Hub에서 할 수 있습니다.",
    ],
    sources: "출처", src_intro: "AI Hub 소개", src_safe: "안심존이란?", src_policy: "이용정책",
    // map
    map_title: "데이터 지도",
    map_intro: "AI Hub 데이터를 8개 분야, 53개 주제로 나눈 지도입니다. 분야나 주제를 선택하면 해당 데이터가 아래 목록에 나오고, 데이터를 선택하면 비슷한 데이터를 함께 볼 수 있습니다.",
    map_how: "보는 방법", map_how_over: "원이 클수록 데이터가 많습니다. 주제를 누르면 해당 주제의 데이터만 보여 줍니다.",
    map_how_topic: "가운데 숫자는 이 주제의 데이터 수입니다. 데이터를 누르면 비슷한 데이터가 파란 점선으로 이어지고 나머지는 흐려집니다.",
    map_full: "전체 화면", map_exit: "전체 화면 닫기", map_back: "← 전체 지도", map_pick_topic: "주제를 선택하면 해당 주제의 데이터만 목록에 나옵니다.", same_topic: "같은 주제",
    map_search: "데이터 이름 검색", map_reset: "원래대로", zoom_in: "확대", zoom_out: "축소",
    map_pick: "분야나 주제를 선택한 뒤 목록에서 데이터를 눌러 보세요.",
    n_domains: "주제 {n}개", n_sets: "데이터 {n}개", n_main: "이 주제가 중심 주제인 데이터 {n}개", n_all: "이 주제와 관련된 데이터 {n}개",
    similar: "비슷한 데이터", also_in: "함께 속한 주제", main_topic: "중심 주제", open_topic: "주제 펼치기",
    sim_pct: "유사도 {p}", view: "자세히 보기", list_view: "목록으로 보기", map_fail: "지도를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침하세요.",
    // data preparation
    p_title: "데이터 준비 과정",
    p_intro: "추천에 쓰는 데이터는 AI Hub의 공개 페이지와 데이터 설명서를 모아 정리했습니다. 원본 HTML에서 필요한 부분만 글로 옮기고, 데이터마다 기록을 하나씩 만든 뒤 검색용 카드와 조각으로 나눕니다. 예시는 모두 실제 데이터 '{title}'에서 가져왔습니다.",
    p_steps: [
      ["데이터 페이지 수집", "AI Hub의 공개 데이터 목록에서 데이터 {n}개를 확인하고, 데이터마다 상세 페이지 HTML과 파일 목록을 받았습니다. 요청은 한 번에 하나씩 3~5초 간격으로 보냈습니다(2026년 10월 27~28일)."],
      ["필요한 부분만 글로 정리", "HTML에서 제목, 분야, 구축 연도, 다운로드 수 같은 기본 정보와 '데이터 개요', '데이터 통계' 같은 본문만 뽑아 글로 옮겼습니다. 메뉴와 버튼, 담당자 이름과 연락처는 지웠습니다."],
      ["데이터 설명서 변환", "데이터 설명서(HWP, PDF, HWPX 등)를 글로 바꿨습니다. 표는 줄 단위로 남기고, 이메일과 전화번호는 지웠습니다. 설명서를 쓴 데이터는 {m}개입니다."],
      ["데이터 기록 작성", "페이지 글, 설명서, 파일 목록을 모아 AI(Claude)가 데이터마다 기록을 하나씩 썼습니다. 요약, 라벨, 난이도, 프로젝트 아이디어, 쉬운 설명이 들어 있습니다. 제목, 연도, 용량처럼 정확해야 하는 값은 스크립트가 원본에서 그대로 옮겼고, 모든 기록은 정해진 형식에 맞는지 자동으로 검사했습니다."],
      ["검색용 카드와 조각", "기록에서 요약, 주제, 할 수 있는 일, 키워드를 모아 데이터마다 '카드'를 하나 만들고, 페이지와 설명서 글은 약 {chunk}자 단위의 '조각'으로 나눴습니다. 카드 {cards}개와 조각 {chunks}개를 벡터로 바꿔 검색에 씁니다."],
    ],
    ex: { html: "원본 HTML", filetree: "파일 목록", page: "정리한 페이지 글", manual: "설명서 글", record: "데이터 기록 (JSON)", card: "검색용 카드", chunks: "조각" },
    ex_part: "{n}줄 중 {s}줄", ex_all: "{n}줄", ex_chunks: "조각 {n}개 중 {s}개", ex_open: "펼쳐 보기", ex_close: "닫기",
    ex_cut: "… (이하 {n}줄 생략)", ex_source: "원본 페이지", p_next: "관련도 계산 방법 보기",
    // method
    m_title: "관련도 계산 방법",
    m_intro: "추천 목록의 '관련도'와 데이터 지도의 '비슷한 데이터'를 정하는 방법입니다. 이 페이지의 숫자는 서비스가 지금 쓰는 설정 파일에서 그대로 가져옵니다.",
    m_prep: "검색용 카드와 조각을 만든 과정은 별도 페이지에서 설명합니다.",
    flow_title: "추천 순서",
    flow: ["검색어와 내 정보", "의미 검색 · 키워드 검색 (순위 4개)", "순위 합치기", "관심 점수 + 전공 점수", "관련도 0~10", "비슷한 데이터 정리", "추천 목록"],
    cos_title: "의미가 비슷한 정도를 재는 방법",
    cos_text: "벡터를 화살표로 그리면 의미가 비슷한 글일수록 두 화살표 사이의 각도가 작습니다. 각도가 작을수록 1에 가까워지는 값(코사인 유사도)을 유사도로 씁니다.",
    calc_title: "관련도 계산기", calc_intro: "값을 바꾸면 관련도가 어떻게 달라지는지 바로 볼 수 있습니다.",
    c_text: "검색어를 입력한 경우", c_cos: "검색어와의 유사도 (코사인)", c_rank: "검색 순위 점수 (1위 대비)", c_chip: "선택한 관심 분야와의 관계",
    c_fit: "전공 분야와의 관계", c_prof: "전공 소개글과의 유사도 (0~1로 조정)",
    chip_main: "데이터의 중심 주제", chip_other: "데이터의 다른 주제", chip_none: "관계없음",
    fit_core_main: "전공 핵심 분야가 중심 주제", fit_core_other: "전공 핵심 분야가 다른 주제", fit_related_main: "전공 관련 분야가 중심 주제", fit_related_other: "전공 관련 분야가 다른 주제", fit_none: "관계없음",
    c_interest: "관심 점수", c_major: "전공 점수", c_score: "관련도",
    m_detail: "단계별 계산",
    d_embed: "1. 글을 벡터로 바꾸기",
    d_embed_t: "데이터마다 카드 1개와 조각 여러 개가 있습니다(현재 카드 {cards}개, 조각 {chunks}개). Google의 {model} 모델로 각 글을 숫자 {dim}개짜리 벡터로 바꾸고 길이를 1로 맞췄습니다. 그래서 코사인 유사도는 두 벡터에서 같은 위치의 숫자를 곱해 모두 더한 값과 같습니다.",
    d_search: "2. 순위 4개를 하나로 합치기 (RRF)",
    d_search_t: "검색어 하나로 카드 의미 검색, 조각 의미 검색, 카드 키워드 검색, 조각 키워드 검색의 순위 4개를 만듭니다. 키워드 검색에는 BM25(드문 단어가 자주 나올수록 높아지는 점수)와 한국어 형태소 분석기 Kiwi를 씁니다. 각 순위에서 상위 {cand}개를 가져와 순위가 높을수록 큰 값을 더합니다(역순위 합산, RRF). 키워드 검색은 YOLOX 같은 정확한 용어를 놓치지 않기 위한 것이라 가중치를 낮게 둡니다.",
    d_interest: "3. 관심 점수 (0~1)",
    d_interest_t: "검색어를 입력했다면 카드와 조각 중 더 높은 코사인 값을 {lo}~{hi} 범위에서 0~1로 늘리고, 합친 순위 점수(1위 대비 비율)와 섞습니다. 관심 분야를 선택했다면 그 분야가 데이터의 중심 주제일 때 {cm}점, 다른 주제일 때 {co}점입니다. 둘 다 있으면 검색어 {ts}, 관심 분야 {cs} 비율로 섞습니다.",
    d_major: "4. 전공 점수 (0~1)",
    d_major_t: "두 값을 절반씩 섞습니다. 하나는 데이터 주제가 전공의 핵심 분야인지 관련 분야인지(아래 표)이고, 다른 하나는 전공 소개글(요약, 주요 분야, 관심 데이터, 프로젝트 주제)과 데이터 카드의 코사인 유사도입니다. 전공마다 유사도 범위가 달라서 그 전공의 중간값 데이터를 0, 가장 비슷한 데이터를 1로 다시 맞춥니다.",
    fit_table: ["데이터 주제", "점수"],
    d_score: "5. 관련도 (0~10)",
    d_score_t: "입력한 정보만으로 가중 평균을 내고 10을 곱합니다. 검색어를 입력했으면 관심 {wi}, 전공 {wm}이고, 관심 분야만 선택했으면 관심 {ci}, 전공 {cm2}입니다. 이 비율은 31개 전공 모두로 시험 질문을 실행해 정했습니다. 관심 가중치가 0.9일 때 정답 데이터가 1위로 나온 비율은 99.3%였습니다.",
    d_example: "예시",
    d_example_t: "검색어 유사도 0.74, 순위 점수 0.8, 전공 핵심 분야가 중심 주제, 전공 소개글 유사도 0.6일 때:",
    d_label: "6. 일치도 표시",
    d_label_t: "데이터 카드와 검색어의 코사인 유사도로 정합니다. 한국어 검색어는 {ks} 이상이면 '잘 맞습니다', {kp} 이상이면 '어느 정도 맞습니다', 그보다 낮으면 '관련이 적습니다'로 표시합니다. 영어 검색어는 유사도가 대체로 낮게 나와서 {es}와 {ep}을 기준으로 씁니다. 두 기준 모두 시험 질문으로 정한 임시값입니다.",
    d_mmr: "7. 비슷한 데이터 정리 (MMR)",
    d_mmr_t: "관련도가 높은 순서로 하나씩 고르되, 이미 고른 데이터와 비슷한 만큼 점수를 낮춥니다. λ가 {lam}이므로 유사도보다 관련도를 더 중요하게 봅니다.",
    d_map: "8. 데이터 지도의 연결",
    d_map_t: "데이터마다 주제를 1~3개 붙였고, 첫 번째가 중심 주제입니다. 53개 주제는 8개 분야로 묶입니다. 이 분류는 AI Hub의 14개 분야와 다르며, 학생이 이해하기 쉬운 말로 이 프로젝트에서 새로 만들었습니다. '비슷한 데이터'는 데이터 카드 벡터의 코사인 유사도가 가장 높은 5개입니다.",
    d_eval: "정확도",
    d_eval_t: "따로 떼어 둔 시험 질문 59개 중 찾던 데이터가 1위로 나온 경우는 56개, 5위 안에 든 경우는 57개였습니다. 31개 전공 정보를 함께 넣어 1,888번 실행했을 때는 1위 96.1%, 5위 이내 96.6%였습니다(2026년 11월 2일 측정).",
    d_limits: "한계",
    limits: [
      "일치도 기준과 가중치는 시험 질문으로 정한 값이라 실제 학생 평가로 다시 맞춰야 합니다.",
      "전공 소개글과 주제 분류는 AI가 쓴 초안이며, 아직 학과 검토를 받지 않았습니다.",
      "검색어가 아주 짧거나 설명서 깊은 곳의 내용을 물으면 정확도가 떨어집니다.",
    ],
    go_aihub: "AI Hub 바로가기", see_map: "데이터 지도 보기", map_open_all: "모든 분야 펼치기", map_close_all: "처음으로",
    map_how_tree: "분야와 주제를 누르면 가지가 펼쳐지고, 다시 누르면 접힙니다. 이름 옆 숫자는 데이터 수입니다. 데이터를 누르면 비슷한 데이터가 파란색으로 표시됩니다.",
    map_how_v: "분야를 누르면 주제가 펼쳐지고, 주제를 누르면 아래 목록에 해당 주제의 데이터가 나옵니다. 숫자는 데이터 수입니다.",
    list_title: "데이터 목록",
    list_hint: "위에서 분야나 주제를 누르면 데이터 목록이 여기에 나옵니다.",
    list_filter: "목록에서 검색",
    list_field: "{name} 분야 데이터 {n}개",
    list_topic: "{name} 데이터 {n}개",
    list_none: "해당 이름의 데이터가 없습니다.",
  },
  en: {
    sub_aihub: "About AI Hub", sub_map: "Data map", sub_prep: "How the data was prepared", sub_method: "How relevance is calculated",
    ah_title: "What is AI Hub?",
    ah_intro: "AI Hub is Korea's national AI development platform, run by the Ministry of Science and ICT and the National Information Society Agency (NIA). It offers the training data, AI software APIs and computing resources needed to build AI, open to researchers, companies and public bodies.",
    ah_numbers: "AI Hub in numbers", n_data: "open datasets", n_fields: "AI Hub fields", n_tb: "in total", n_manual: "datasets with a manual",
    u_count: "", u_tb: "TB",
    ah_can: "What you can do on AI Hub",
    can: [
      ["AI training data", "Training data built in government projects and data shared by other institutions and companies, in 14 fields."],
      ["Open API and AI Hub Shell", "A command-line tool to list datasets and their files, and to download the data you were approved for."],
      ["Safe zone (안심존)", "Sensitive data such as personal information never leaves AI Hub: you analyse it on their secure servers (with GPUs), online or on site."],
      ["Learning resources and K-AI Leaderboard", "AI learning materials by level, and a public leaderboard where language models (LLMs) compete on NIA's evaluation data."],
    ],
    ah_steps: "How to get the data",
    steps: [
      "Sign up for AI Hub and log in.",
      "Request access on the dataset's page. Some datasets are open to Korean nationals only.",
      "Once approved, download on the web or with AI Hub Shell. For large datasets you can pick only the files you need.",
      "Safe-zone data needs its own application, a review by NIA (up to 2 weeks), and is used on their secure servers.",
    ],
    ch_fields: "Datasets per AI Hub field", ch_years: "Datasets by year built", ch_mods: "Datasets by data type",
    ch_mods_note: "One dataset can hold several types (for example images and text), so the total is above 867.",
    ch_basis: "Counted from the 867 AI Hub datasets collected at the end of October 2026.",
    of_total: "{p}% of all", downloads_n: "{n} downloads",
    ah_top: "Most downloaded datasets",
    ah_notes: "Good to know",
    notes: [
      "If you use the data in a paper or project, credit it as a result of an NIA project.",
      "Users outside Korea need a separate agreement with NIA to use the data.",
      "AI Hub DataFinder is an independent student project, not affiliated with AI Hub. Request and download data on AI Hub.",
    ],
    sources: "Sources", src_intro: "About AI Hub", src_safe: "What is the safe zone", src_policy: "Usage policy",
    map_title: "Data map",
    map_intro: "A tree from AI Hub to 8 fields and 53 topics. Pick a field or topic to list its datasets below; pick a dataset to see others with a similar meaning.",
    map_how: "How to read it", map_how_over: "Bigger circles hold more datasets. Click a topic to see only its datasets.",
    map_how_topic: "The number in the centre is how many datasets this topic has. Click a dataset: blue dotted lines lead to datasets with a similar meaning, and the rest fade.",
    map_full: "Full screen", map_exit: "Exit full screen", map_back: "← Whole map", map_pick_topic: "Pick a topic to narrow the list.", same_topic: "same topic",
    map_search: "Find a dataset by name", map_reset: "Reset view", zoom_in: "Zoom in", zoom_out: "Zoom out",
    map_pick: "Pick a field or topic, then a dataset in the list.",
    n_domains: "{n} topics", n_sets: "{n} datasets", n_main: "{n} datasets with this as main topic", n_all: "{n} datasets related to this topic",
    similar: "Similar datasets", also_in: "Also belongs to", main_topic: "Main topic", open_topic: "Open topic",
    sim_pct: "similarity {p}", view: "View details", list_view: "Show as a list", map_fail: "The map drawing library (D3) could not load. Check your internet connection and reload.",
    // data preparation
    p_title: "How the data was prepared",
    p_intro: "The data behind the recommendations comes from AI Hub's public pages and dataset manuals. We keep only the needed parts of the page HTML as text, write one record per dataset, then split it into search cards and pieces. Every example comes from the real dataset '{title}' (in Korean, as on AI Hub).",
    p_steps: [
      ["Collecting the pages", "From AI Hub's public dataset list we found {n} datasets and downloaded each one's page HTML and file list, one request at a time, 3–5 seconds apart (27–28 October 2026)."],
      ["Keeping only what matters", "From the HTML we kept the basic facts (title, field, year built, downloads) and the body sections such as '데이터 개요' and '데이터 통계', as plain text. Menus, buttons and staff names and contacts were removed."],
      ["Converting the manuals", "Dataset manuals (HWP, PDF, HWPX and more) were turned into text. Tables are kept row by row; emails and phone numbers were removed. {m} datasets use a manual."],
      ["Writing one record per dataset", "From the page text, manual and file list, an AI (Claude) wrote one record per dataset: summary, labels, level, project ideas and a plain explanation. Exact values such as title, year and size were copied from the source by a script, and every record was checked against a fixed schema."],
      ["Search cards and pieces", "Each dataset gets one 'card' (summary, topics, tasks, keywords) and its page and manual text are cut into 'pieces' of about {chunk} characters. The {cards} cards and {chunks} pieces are turned into vectors for search."],
    ],
    ex: { html: "Page HTML", filetree: "File list", page: "Cleaned page text", manual: "Manual text", record: "Dataset record (JSON)", card: "Search card", chunks: "Pieces" },
    ex_part: "{s} of {n} lines", ex_all: "{n} lines", ex_chunks: "{s} of {n} pieces", ex_open: "Open", ex_close: "Close",
    ex_cut: "… ({n} more lines not shown)", ex_source: "Source page", p_next: "See how relevance is calculated",
    m_title: "How relevance is calculated",
    m_intro: "How the 'relevance' in your recommendations and the 'similar datasets' on the data map are decided. The numbers on this page are read live from the settings the app runs with.",
    m_prep: "How the search cards and pieces were made is explained on its own page.",
    flow_title: "How a recommendation is made",
    flow: ["Your request and profile", "Meaning + word search (4 rankings)", "Merge the rankings", "Interest + major score", "Relevance 0–10", "Remove near-duplicates", "Your list"],
    cos_title: "Measuring 'similar meaning' as a number",
    cos_text: "Draw the vectors as arrows: the closer the meaning, the smaller the angle between them. We use a value that gets closer to 1 as the angle gets smaller (cosine similarity).",
    calc_title: "Score calculator", calc_intro: "Move the values to see how the relevance changes.",
    c_text: "I typed a request", c_cos: "Similarity to the request (cosine)", c_rank: "Search rank score (vs. the top hit)", c_chip: "Picked interest field is the dataset's",
    c_fit: "Relation to your major", c_prof: "Similarity to your major's profile (scaled 0–1)",
    chip_main: "main topic", chip_other: "other topic", chip_none: "not related",
    fit_core_main: "core field = main topic", fit_core_other: "core field = other topic", fit_related_main: "related field = main topic", fit_related_other: "related field = other topic", fit_none: "not related",
    c_interest: "Interest", c_major: "Major", c_score: "Relevance",
    m_detail: "Step by step",
    d_embed: "1. Turning text into vectors",
    d_embed_t: "Each dataset has one card and several pieces ({cards} cards and {chunks} pieces now). Google's {model} model turns each text into a vector of {dim} numbers, scaled to length 1, so the cosine similarity of two vectors is simply the sum of their products.",
    d_search: "2. Merging four rankings (RRF)",
    d_search_t: "One request gives four rankings: meaning search and word search, each on cards and on pieces. Word search uses BM25 (a score that rises when rare words appear often) with the Korean tokenizer Kiwi. The top {cand} of each list are merged by adding more for higher ranks (reciprocal rank fusion, RRF). Word search counts less; it is there so exact terms like YOLOX are not missed.",
    d_interest: "3. Interest score (0–1)",
    d_interest_t: "With a request: the better cosine of card or piece is stretched from the range {lo}–{hi} to 0–1, then mixed with the merged rank score (share of the top hit). With picked fields: {cm} when the field is the dataset's main topic, {co} when it is another of its topics. With both, the request counts {ts} and the fields {cs}.",
    d_major: "4. Major score (0–1)",
    d_major_t: "Half comes from whether the dataset's topics are core or related fields of the major (table below), half from the cosine between the major's profile text (summary, key topics, data interests, project themes) and the dataset card. Similarity ranges differ per major, so each major's median dataset is set to 0 and its most similar dataset to 1.",
    fit_table: ["Dataset topic", "Score"],
    d_score: "5. Relevance (0–10)",
    d_score_t: "A weighted mean of only the parts you gave, times 10. With a request: interest {wi}, major {wm}; with picked fields only: interest {ci}, major {cm2}. The weights were chosen by running the test questions with all 31 majors (interest 0.9 put the right dataset first 99.3% of the time).",
    d_example: "Example",
    d_example_t: "Similarity 0.74, rank score 0.8, the major's core field is the main topic, major profile similarity 0.6:",
    d_label: "6. The 'good match' label",
    d_label_t: "Set by the cosine between the request and the dataset card. Korean requests: {ks} or more is 'good match', {kp} or more 'partly matches', below that 'loosely related'. English requests score lower overall and use {es} / {ep}. These thresholds are provisional, chosen on the test questions.",
    d_mmr: "7. Removing near-duplicates (MMR)",
    d_mmr_t: "Datasets are picked one by one by relevance, minus how much each looks like the datasets already picked. With λ = {lam}, relevance weighs more than likeness.",
    d_map: "8. Links on the data map",
    d_map_t: "Each dataset has 1–3 topics; the first is its main topic. The 53 topics form 8 big fields. This grouping is not AI Hub's 14 fields: this project made it in plain words for students. 'Similar datasets' are the 5 with the highest cosine between dataset-card vectors.",
    d_eval: "How well does it work?",
    d_eval_t: "On 59 held-out test questions, the wanted dataset came first 56 times and in the top 5 57 times. Run with each of the 31 majors (1,888 runs): first 96.1%, top 5 96.6% (measured 2 November 2026).",
    d_limits: "Limits",
    limits: [
      "The label thresholds and weights were tuned on test questions and still need checking against real student ratings.",
      "The major profiles and topic grouping are AI-written drafts, not yet reviewed by the departments.",
      "Very short requests, or questions about details deep inside a manual, can be less accurate.",
    ],
    go_aihub: "Visit AI Hub", see_map: "Explore the data map", map_open_all: "Open all fields", map_close_all: "Start over",
    map_how_tree: "Click a field or topic to open its branch, and again to close it. Numbers are dataset counts. Click a dataset to mark datasets with a similar meaning in blue.",
    map_how_v: "Click a field to show its topics; click a topic to list its datasets below. Numbers are dataset counts.",
    list_title: "Dataset list",
    list_hint: "Click a field or topic above to list its datasets here.",
    list_filter: "Filter the list",
    list_field: "{name}: {n} datasets",
    list_topic: "{name}: {n} datasets",
    list_none: "No dataset with that name.",
  },
};
const at = (k, vars = {}) => {
  const v = AT[lang][k] ?? AT.ko[k] ?? k;
  return typeof v === "string" ? v.replace(/\{(\w+)\}/g, (_, x) => vars[x] ?? "") : v;
};
// fixed categorical order for the 8 groups (validated palette, dataviz skill)
const GROUP_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js";
const KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/";
const aboutCache = {};

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { (window.d3 || window.katex) ? res() : setTimeout(res, 300); return; }
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("load failed: " + src));
    document.head.appendChild(s);
  });
}
function loadCss(href) {
  if (!document.querySelector(`link[href="${href}"]`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l); }
}
async function aboutData(kind) { return aboutCache[kind] || (aboutCache[kind] = await api(`/api/about/${kind}`)); }
const fmt = n => Number(n).toLocaleString(lang === "ko" ? "ko-KR" : "en-US");

// one tooltip for every chart mark that has data-tip
let tipEl = null;
function showTip(e) {
  const m = e.target.closest?.("[data-tip]"); if (!m) return hideTip();
  if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; tipEl.setAttribute("role", "status"); document.body.appendChild(tipEl); }
  tipEl.textContent = m.dataset.tip; tipEl.hidden = false;
  const r = m.getBoundingClientRect(), x = e.clientX ?? r.left + r.width / 2, y = e.clientY ?? r.top;
  tipEl.style.left = Math.min(window.innerWidth - tipEl.offsetWidth - 8, x + 12) + "px";
  tipEl.style.top = Math.max(8, y - tipEl.offsetHeight - 10) + "px";
}
function hideTip() { if (tipEl) tipEl.hidden = true; }
document.addEventListener("pointerover", showTip); document.addEventListener("pointermove", e => { if (tipEl && !tipEl.hidden) showTip(e); });
document.addEventListener("focusin", showTip); document.addEventListener("focusout", hideTip);

const ABOUT_PAGES = ["aihub", "map", "prep", "method"];
function subnav(cur) {
  return `<nav class="subnav" aria-label="${esc(t("nav_about"))}">${ABOUT_PAGES.map(id =>
    `<a href="#/about/${id}" class="${id === cur ? "on" : ""}" ${id === cur ? 'aria-current="page"' : ""}>${esc(at("sub_" + id))}</a>`).join("")}</nav>`;
}

// ---------- charts (single series: one hue, values as text, hover shows share) ----------
function hbars(rows, total) {
  const max = Math.max(...rows.map(r => r.n));
  return `<div class="hbars">${rows.map(r => `<div class="hb" tabindex="0" data-tip="${esc(r.label)}: ${fmt(r.n)}${total ? " · " + at("of_total", { p: Math.round(100 * r.n / total) }) : ""}">
    <span class="hb-l">${esc(r.label)}</span><span class="hb-t"><i style="width:${(100 * r.n / max).toFixed(1)}%"></i></span><span class="hb-v">${fmt(r.n)}</span></div>`).join("")}</div>`;
}
function vbars(rows, total) {
  const max = Math.max(...rows.map(r => r.n));
  return `<div class="vbars" style="--n:${rows.length}">${rows.map(r => `<div class="vb" tabindex="0" data-tip="${esc(r.label)}: ${fmt(r.n)} · ${at("of_total", { p: Math.round(100 * r.n / total) })}">
    <span class="vb-v">${fmt(r.n)}</span><span class="vb-t"><i style="height:${(100 * r.n / max).toFixed(1)}%"></i></span><span class="vb-l">${esc(r.label)}</span></div>`).join("")}</div>`;
}

// ---------- page 1: AI Hub ----------
// small line icons (24 x 24, stroke = currentColor) used on the About pages
const ICON = {
  db: '<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  disk: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 14h18"/><circle cx="16.5" cy="17" r="1"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
  term: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 10 3 2.5L7 15M12.5 15H17"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.6 3 8 7 9.5 4-1.5 7-4.9 7-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  cap: '<path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z"/><path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11"/>',
  user: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.8-3.6 3.4-5.5 6.5-5.5 1.4 0 2.7.4 3.8 1.2"/><path d="M18 14v6M15 17h6"/>',
  form: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  down: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5S9.6 5.9 12 3.5z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>',
  vec: '<path d="M4 20 18 6M4 20h11M4 20V9"/><path d="M14 6h4v4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-5"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const icon = (k, size = 22) => `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

async function pageAihub(seq) {
  const s = await aboutData("stats");
  if (seq !== navSeq) return;
  const stat = (ic, v, unit, label) => `<div class="stat">${icon(ic, 24)}<b>${esc(v)}<small>${esc(unit)}</small></b><span>${esc(label)}</span></div>`;
  const canIcons = ["db", "term", "shield", "cap"], stepIcons = ["user", "form", "down", "lock"], noteIcons = ["pen", "globe", "info"];
  view(`
  <section class="ah-hero">
    <div class="ah-hero-text">
      <h1>${esc(at("ah_title"))}</h1><p class="lead">${esc(at("ah_intro"))}</p>
      <div class="btn-row"><a class="btn btn-coral" href="https://www.aihub.or.kr/" target="_blank" rel="noopener">${esc(at("go_aihub"))} ↗</a>
        <a class="btn btn-line" href="#/about/map">${esc(at("see_map"))}</a></div>
    </div>
    <div class="ah-mosaic" aria-hidden="true">${s.top_downloads.slice(0, 9).map(r => tile(r, "tile-m")).join("")}</div>
  </section>
  <section class="stats" aria-label="${esc(at("ah_numbers"))}">
    ${stat("db", fmt(s.n_datasets), at("u_count"), at("n_data"))}${stat("grid", s.n_fields, at("u_count"), at("n_fields"))}
    ${stat("disk", "≈ " + fmt(s.total_tb), at("u_tb"), at("n_tb"))}${stat("doc", fmt(s.n_manual), at("u_count"), at("n_manual"))}
  </section>
  <p class="hint basis">${esc(at("ch_basis"))}</p>
  <section class="panel"><h3>${esc(at("ah_can"))}</h3>
    <div class="can">${at("can").map(([h, p], i) => `<div class="can-card"><span class="ic-wrap">${icon(canIcons[i])}</span><div><b>${esc(h)}</b><p>${esc(p)}</p></div></div>`).join("")}</div></section>
  <section class="panel"><h3>${esc(at("ah_steps"))}</h3>
    <ol class="stepper">${at("steps").map((x, i) => `<li><span class="st-dot">${icon(stepIcons[i], 22)}<em>${i + 1}</em></span><p>${esc(x)}</p></li>`).join("")}</ol></section>
  <div class="two">
    <section class="panel fill"><h3>${esc(at("ch_fields"))}</h3>${hbars(s.fields.map(f => ({ label: f.name, n: f.n })), s.n_datasets)}</section>
    <div>
      <section class="panel"><h3>${esc(at("ch_years"))}</h3>${vbars(s.years.map(y => ({ label: y.year, n: y.n })), s.n_datasets)}</section>
      <section class="panel"><h3>${esc(at("ch_mods"))}</h3>${hbars(s.modalities.map(m => ({ label: m[lang], n: m.n })), s.n_datasets)}
        <p class="hint" style="margin:12px 0 0">${esc(at("ch_mods_note"))}</p></section>
    </div>
  </div>
  <section class="panel"><h3>${esc(at("ah_top"))}</h3>
    <div class="related">${s.top_downloads.slice(0, 6).map(r => `<a class="rel" href="#/dataset/${esc(r.id)}">${tile(r, "tile-m")}<span>${esc(L(r, "title"))}</span><small>${esc(at("downloads_n", { n: r.downloads }))}</small></a>`).join("")}</div></section>
  <section class="panel"><h3>${esc(at("ah_notes"))}</h3>
    <div class="note-cards">${at("notes").map((x, i) => `<div class="note-card">${icon(noteIcons[i])}<p>${esc(x)}</p></div>`).join("")}</div>
    <p class="hint" style="margin:18px 0 0">${esc(at("sources"))}: <a href="https://www.aihub.or.kr/intrcn/intrcn.do?currMenu=150&topMenu=105" target="_blank" rel="noopener">${esc(at("src_intro"))} ↗</a>
    · <a href="https://www.aihub.or.kr/intrcn/safetyzoneintrcn.do?currMenu=306&topMenu=105" target="_blank" rel="noopener">${esc(at("src_safe"))} ↗</a>
    · <a href="https://www.aihub.or.kr/intrcn/guid/usagepolicy.do?currMenu=151&topMenu=105" target="_blank" rel="noopener">${esc(at("src_policy"))} ↗</a></p></section>`);
}

// ---------- page 2: data map (vertical tree + dataset list) ----------
// Top to bottom: AI Hub -> 8 fields -> the topics of ONE open field (D3 tree), so the drawing stays small.
// Datasets are not drawn as nodes: a field or topic fills a scrollable list under the tree (icon, name, size,
// level, filter box), and a dataset picked in the list shows its details and its 5 most similar datasets.
// Full screen shows tree, list and details on the whole screen (Fullscreen API, CSS fallback for iPhone Safari).
const mapState = { field: null, topic: null, sel: null };
let mapCtx = null;                                   // the live map, so full-screen changes can redraw it
document.addEventListener("fullscreenchange", () => mapCtx?.onFs());
window.addEventListener("resize", () => { clearTimeout(mapCtx?.rt); if (mapCtx) mapCtx.rt = setTimeout(() => mapCtx?.update(), 150); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.querySelector(".map-wrap.fs-fallback")) mapCtx?.toggleFs(); });

async function pageMap(seq, focus) {
  view(`<section class="about-head"><h1>${esc(at("map_title"))}</h1><p class="lead">${esc(at("map_intro"))}</p></section>
    <div class="loading">${esc(t("loading"))}</div>`);
  let G;
  try { [G] = await Promise.all([aboutData("graph"), loadScript(D3_URL)]); }
  catch (e) { if (seq === navSeq) view(`<div class="msg err">${esc(at("map_fail"))}</div>`); return; }
  if (seq !== navSeq || !window.d3) return;
  const d3 = window.d3;
  const gColor = Object.fromEntries(G.groups.map((g, i) => [g.id, GROUP_COLORS[i % GROUP_COLORS.length]]));
  const dom = Object.fromEntries(G.domains.map(d => [d.id, d]));
  const grp = Object.fromEntries(G.groups.map(g => [g.id, g]));
  const ds = Object.fromEntries(G.datasets.map(d => [d.id, d]));
  const groupN = g => G.domains.filter(d => d.group === g).reduce((s, d) => s + d.n_main, 0);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  view(`<section class="about-head"><h1>${esc(at("map_title"))}</h1><p class="lead">${esc(at("map_intro"))}</p></section>
    <div class="map-wrap v" id="map-wrap">
      <div class="map-box panel">
        <div class="map-tools">
          <input id="map-q" list="map-list" placeholder="${esc(at("map_search"))}" aria-label="${esc(at("map_search"))}">
          <datalist id="map-list">${G.datasets.map(d => `<option value="${esc(L(d, "title"))}"></option>`).join("")}</datalist>
          <button type="button" class="btn btn-line btn-sm" id="m-reset">${esc(at("map_close_all"))}</button>
          <button type="button" class="btn btn-line btn-sm" id="m-full">${esc(at("map_full"))}</button>
        </div>
        <div class="map-stage"><svg id="map" role="tree" aria-label="${esc(at("map_title"))}"></svg></div>
        <p class="hint map-how"><b>${esc(at("map_how"))}</b> ${esc(at("map_how_v"))}</p>
      </div>
      <div class="map-lower">
        <section class="panel dl-panel" aria-live="polite">
          <div class="dl-head"><h3 id="dl-title">${esc(at("list_title"))}</h3><input id="dl-filter" placeholder="${esc(at("list_filter"))}" aria-label="${esc(at("list_filter"))}" hidden></div>
          <ul class="dl" id="dl"></ul>
        </section>
        <aside class="map-side panel" id="map-side" aria-live="polite"></aside>
      </div>
    </div>`);

  const data = { key: "root", type: "root", kids: G.groups.map(g => ({ key: "g:" + g.id, type: "group", g,
    kids: G.domains.filter(d => d.group === g.id && d.n_main > 0).sort((a, b) => b.n_main - a.n_main).map(d => ({ key: "d:" + d.id, type: "domain", d })) })) };
  const wrap = $("#map-wrap"), stage = $(".map-stage"), svg = d3.select("#map");
  const gLinks = svg.append("g"), gNodes = svg.append("g");
  const MIN_W = 1000, LEVEL_H = 104, TOP = 34;     // 8 one-line field names need ~1000 px; narrower screens scroll the tree
  // long names break at the middle dot into two lines, so neighbours do not touch
  const lines = s => {
    if (s.length <= 7 || !s.includes("·")) return [s];
    const parts = s.split("·"), mid = s.length / 2;
    let best = 1, bestD = Infinity, acc = 0;
    for (let i = 1; i < parts.length; i++) { acc += parts[i - 1].length + 1; const d = Math.abs(acc - mid); if (d < bestD) { bestD = d; best = i; } }
    return [parts.slice(0, best).join("·") + "·", parts.slice(best).join("·")];
  };
  const labelLines = n => (n.type === "group" ? [name(n.g)] : lines(nameOf(n)));   // field names stay on one line
  const nameOf = n => n.type === "root" ? "AI Hub" : n.type === "group" ? name(n.g) : name(n.d);
  const countOf = n => n.type === "root" ? G.datasets.length : n.type === "group" ? groupN(n.g.id) : n.d.n_main;
  const colorOf = n => n.type === "group" ? gColor[n.g.id] : n.type === "domain" ? gColor[n.d.group] : "#378aff";
  let prev = new Map();

  function update(sourceKey) {
    const fs = wrap.classList.contains("is-fs");
    const h = d3.hierarchy(data, n => (n.type === "root" || (n.type === "group" && mapState.field === n.g.id) ? n.kids : null));
    const W = Math.max(MIN_W, stage.clientWidth), depth = mapState.field ? 2 : 1, H = TOP + depth * LEVEL_H + 62;
    d3.tree().size([W - 110, depth * LEVEL_H]).separation((a, b) => (a.parent === b.parent ? 1 : 1.6))(h);
    h.each(n => { n.px = n.x + 55; n.py = n.y + TOP; });
    svg.attr("viewBox", [0, 0, W, H]).attr("width", W).attr("height", H);
    const dur = reduce || !prev.size ? 0 : 320, src = prev.get(sourceKey) || [W / 2, TOP];
    const pos = new Map(); h.each(n => pos.set(n.data.key, [n.px, n.py]));
    const link = d3.linkVertical().x(p => p[0]).y(p => p[1]);
    const lp = l => link({ source: [l.source.px, l.source.py + (l.source.data.type === "root" ? 12 : 24 + 16 * labelLines(l.source.data).length + 10)], target: [l.target.px, l.target.py - 9] });
    gLinks.selectAll("path").data(h.links(), l => l.target.data.key).join(
      e => e.append("path").attr("d", () => link({ source: src, target: src })).attr("opacity", 0),
      u => u, x => x.transition().duration(dur).attr("opacity", 0).remove())
      .attr("fill", "none").attr("stroke", l => colorOf(l.target.data)).attr("stroke-width", 1.6)
      .transition().duration(dur).attr("d", lp).attr("opacity", l => (mapState.field && l.target.data.type === "group" && l.target.data.g.id !== mapState.field ? .25 : .55));

    const nodes = gNodes.selectAll("g.vn").data(h.descendants(), n => n.data.key).join(
      e => {
        const g = e.append("g").attr("class", "vn").attr("transform", `translate(${src})`).attr("opacity", 0).attr("tabindex", 0).attr("role", "treeitem");
        g.append("circle"); g.append("text").attr("class", "v-label"); g.append("text").attr("class", "v-count");
        return g;
      }, u => u, x => x.transition().duration(dur).attr("opacity", 0).attr("transform", () => `translate(${src})`).remove());
    const on = n => (n.data.type === "group" && mapState.field === n.data.g.id) || (n.data.type === "domain" && mapState.topic === n.data.d.id);
    const dim = n => (n.data.type === "group" && mapState.field && mapState.field !== n.data.g.id) || (n.data.type === "domain" && mapState.topic && mapState.topic !== n.data.d.id);
    nodes.attr("class", n => `vn vn-${n.data.type}` + (on(n) ? " on" : "") + (dim(n) ? " dim" : ""))
      .attr("aria-expanded", n => (n.data.type === "group" ? String(mapState.field === n.data.g.id) : null))
      .attr("aria-label", n => `${nameOf(n.data)}, ${countOf(n.data)}`);
    nodes.transition().duration(dur).attr("opacity", 1).attr("transform", n => `translate(${n.px},${n.py})`);
    nodes.select("circle").attr("r", n => (n.data.type === "root" ? 11 : n.data.type === "group" ? 9 : 7))
      .attr("fill", n => (n.data.type === "root" ? "#378aff" : on(n) || n.data.type === "group" ? colorOf(n.data) : "#fff"))
      .attr("stroke", n => (n.data.type === "root" ? "#fff" : colorOf(n.data))).attr("stroke-width", 2.2);
    nodes.select(".v-label").each(function (n) {
      const el = d3.select(this).attr("text-anchor", "middle"), ls = n.data.type === "root" ? [] : labelLines(n.data);
      el.selectAll("tspan").remove();
      if (n.data.type === "root") { el.attr("y", -18).append("tspan").attr("x", 0).text(`AI Hub · ${G.datasets.length}`); return; }
      el.attr("y", 24);
      ls.forEach((s, i) => el.append("tspan").attr("x", 0).attr("dy", i ? "1.2em" : 0).text(s));
    });
    nodes.select(".v-count").attr("text-anchor", "middle").attr("y", n => (n.data.type === "root" ? 0 : 24 + 16 * labelLines(n.data).length + 2))
      .text(n => (n.data.type === "root" ? "" : countOf(n.data)));
    nodes.on("click", (e, n) => pick(n.data)).on("keydown", (e, n) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(n.data); } });
    prev = pos;
    if (fs) stage.style.maxHeight = "";
  }

  // ---------- the dataset list under the tree ----------
  function listItems() {
    const keep = mapState.topic ? d => d.domains[0] === mapState.topic : mapState.field ? d => dom[d.domains[0]].group === mapState.field : null;
    return keep ? G.datasets.filter(keep).sort((a, b) => b.downloads - a.downloads) : [];
  }
  function drawList() {
    const items = listItems(), ul = $("#dl"), filter = $("#dl-filter");
    const scope = mapState.topic ? dom[mapState.topic] : mapState.field ? grp[mapState.field] : null;
    $("#dl-title").innerHTML = scope ? `<i class="dot" style="background:${gColor[mapState.topic ? scope.group : scope.id]}"></i>${esc(at(mapState.topic ? "list_topic" : "list_field", { name: name(scope), n: items.length }))}` : esc(at("list_title"));
    filter.hidden = !scope;
    const q = filter.value.trim().toLowerCase();
    const shown = q ? items.filter(d => L(d, "title").toLowerCase().includes(q)) : items;
    if (!scope) { ul.innerHTML = `<li class="dl-empty">${esc(at("list_hint"))}</li>`; return; }
    if (!shown.length) { ul.innerHTML = `<li class="dl-empty">${esc(at("list_none"))}</li>`; return; }
    const sel = mapState.sel ? ds[mapState.sel] : null, sim = new Set(sel ? sel.similar.map(([j]) => j) : []);
    ul.innerHTML = shown.map(d => `<li><button type="button" class="dl-item ${d.id === mapState.sel ? "on" : ""} ${sim.has(d.id) ? "sim" : ""}" data-id="${esc(d.id)}">
        ${tile(d, "tile-xs")}<span class="dl-text"><b>${esc(L(d, "title"))}</b>
        <small>${esc(t("size"))} ${esc(d.size)} · ${esc(t("difficulty"))} ${esc(T[lang].difficulty_v[d.difficulty] ?? d.difficulty)}${mapState.topic ? "" : " · " + esc(name(dom[d.domains[0]]))}</small></span></button></li>`).join("");
    ul.querySelectorAll(".dl-item").forEach(b => b.onclick = () => selectDataset(b.dataset.id, false));
  }

  function pick(n) {
    if (n.type === "root") { reset(); return; }
    if (n.type === "group") {
      const open = mapState.field !== n.g.id;
      Object.assign(mapState, { field: open ? n.g.id : null, topic: null });
      update(n.key); $("#dl-filter").value = ""; drawList(); side(open ? { type: "group", g: n.g } : null);
      return;
    }
    mapState.topic = mapState.topic === n.d.id ? null : n.d.id;
    update(n.key); $("#dl-filter").value = ""; drawList(); side(mapState.topic ? { type: "domain", d: n.d } : { type: "group", g: grp[mapState.field] });
  }
  function selectDataset(id, scroll = true) {
    const x = ds[id]; if (!x) return;
    const d = dom[x.domains[0]];
    const moved = mapState.field !== d.group || mapState.topic !== d.id;
    Object.assign(mapState, { field: d.group, topic: d.id, sel: id });
    if (moved) { update("d:" + d.id); $("#dl-filter").value = ""; }
    drawList(); side({ type: "dataset", x });
    const li = document.querySelector(`#dl .dl-item[data-id="${CSS.escape(id)}"]`);
    if (li) { const ul = $("#dl"); ul.scrollTop = li.offsetTop - ul.clientHeight / 2 + li.clientHeight / 2; }
    if (scroll) $(".map-lower").scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }
  function reset() { Object.assign(mapState, { field: null, topic: null, sel: null }); update("root"); $("#dl-filter").value = ""; drawList(); side(null); }
  function side(item) {
    const el = $("#map-side");
    if (!item) { el.innerHTML = `<p class="hint">${esc(at("map_pick"))}</p>`; return; }
    if (item.type === "group") {
      const list = G.domains.filter(d => d.group === item.g.id && d.n_main > 0);
      el.innerHTML = `<h3><i class="dot" style="background:${gColor[item.g.id]}"></i>${esc(name(item.g))}</h3>
        <p class="hint">${esc(at("n_domains", { n: list.length }))} · ${esc(at("n_sets", { n: groupN(item.g.id) }))}</p>
        <p class="hint">${esc(at("map_pick_topic"))}</p>`;
    } else if (item.type === "domain") {
      const d = item.d;
      el.innerHTML = `<p class="hint">${esc(name(grp[d.group]))}</p><h3><i class="dot" style="background:${gColor[d.group]}"></i>${esc(name(d))}</h3>
        <p>${esc(d["scope_" + lang] || d.scope_ko || "")}</p>
        <p class="hint">${esc(at("n_main", { n: d.n_main }))}<br>${esc(at("n_all", { n: d.n }))}</p>`;
    } else {
      const x = item.x;
      el.innerHTML = `<p class="hint">${esc(at("main_topic"))}: ${esc(name(dom[x.domains[0]]))}</p><h3>${esc(L(x, "title"))}</h3>
        ${x.domains.length > 1 ? `<p class="hint">${esc(at("also_in"))}: ${x.domains.slice(1).map(d => esc(name(dom[d]))).join(", ")}</p>` : ""}
        <h4>${esc(at("similar"))}</h4>
        <ul class="side-list">${x.similar.map(([j, c]) => `<li><a href="#" data-ds="${esc(j)}">${esc(L(ds[j], "title"))}</a>
          <small>${esc(ds[j].domains[0] === x.domains[0] ? at("same_topic") : name(dom[ds[j].domains[0]]))} · ${c.toFixed(2)}</small></li>`).join("")}</ul>
        <div class="btn-row"><a class="btn btn-blue btn-sm" href="#/dataset/${esc(x.id)}">${esc(at("view"))}</a>
          <button type="button" class="chat-btn" data-chat="${esc(x.id)}">${typeof AI_ICON === "string" ? AI_ICON : ""}${esc(t("chat_open"))}</button></div>`;
    }
    el.querySelectorAll("[data-ds]").forEach(a => a.onclick = e => { e.preventDefault(); selectDataset(a.dataset.ds); });
  }
  function toggleFs() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (wrap.classList.contains("fs-fallback")) { wrap.classList.remove("fs-fallback"); onFs(); return; }
    if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => { wrap.classList.add("fs-fallback"); onFs(); });
    else { wrap.classList.add("fs-fallback"); onFs(); }
  }
  function onFs() {
    const on = document.fullscreenElement === wrap || wrap.classList.contains("fs-fallback");
    wrap.classList.toggle("is-fs", on);
    $("#m-full").textContent = at(on ? "map_exit" : "map_full");
    update();
  }

  $("#m-full").onclick = toggleFs;
  $("#m-reset").onclick = reset;
  $("#dl-filter").oninput = drawList;
  $("#map-q").onchange = e => {
    const q = e.target.value.trim(); if (!q) return;
    const x = G.datasets.find(d => L(d, "title") === q) || G.datasets.find(d => L(d, "title").includes(q));
    if (x) selectDataset(x.id);
  };
  mapCtx = { onFs, update: () => { if (document.body.contains(wrap)) update(); else mapCtx = null; }, toggleFs, rt: 0 };
  update("root"); drawList();
  if (focus && ds[focus]) selectDataset(focus);                                           // #/about/map/<dataset id>
  else side(mapState.sel && ds[mapState.sel] ? { type: "dataset", x: ds[mapState.sel] } : mapState.topic ? { type: "domain", d: dom[mapState.topic] } : mapState.field ? { type: "group", g: grp[mapState.field] } : null);
}

// ---------- page 3: how the data was prepared ----------
// One real dataset followed through every step. Each example is a small preview (the first lines, faded out);
// pressing it opens the whole excerpt in a dialog, so long HTML or JSON never fills the page.
const PREP_EXAMPLES = [["html", "filetree"], ["page"], ["manual"], ["record"], ["card", "chunks"]];
async function pagePrep(seq) {
  const P = await aboutData("prep");
  if (seq !== navSeq) return;
  const c = P.counts, ex = P.examples || {}, title = lang === "en" && P.title_en ? `${P.title_ko} (${P.title_en})` : P.title_ko;
  const vars = { n: fmt(c.datasets), m: fmt(c.manuals), chunk: fmt(c.chunk_chars), cards: fmt(c.cards), chunks: fmt(c.chunks) };
  const fill = s => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  const meta = (k, e) => k === "chunks" ? at("ex_chunks", { n: e.count, s: Math.min(e.count, 3) })
    : e.shown < e.lines ? at("ex_part", { n: fmt(e.lines), s: fmt(e.shown) }) : at("ex_all", { n: fmt(e.lines) });
  const card = k => {
    const e = ex[k]; if (!e) return "";
    const head = e.text.split("\n").slice(0, 9).join("\n");
    return `<button type="button" class="ex-card" data-ex="${k}" aria-haspopup="dialog">
      <span class="ex-thumb" aria-hidden="true"><code>${esc(head)}</code></span>
      <span class="ex-cap"><b>${esc(at("ex")[k])}</b><small>${esc(meta(k, e))}</small></span>
      <span class="ex-open">${esc(at("ex_open"))}</span></button>`;
  };
  view(`
  <section class="about-head"><h1>${esc(at("p_title"))}</h1><p class="lead">${esc(at("p_intro", { title }))}</p>
    <p class="hint"><a href="${esc(P.url || "https://www.aihub.or.kr/")}" target="_blank" rel="noopener">${esc(at("ex_source"))}: ${esc(P.title_ko || "")} ↗</a></p></section>
  <ol class="prep">${at("p_steps").map(([h, p], i) => `<li class="panel prep-step">
      <div class="prep-text"><span class="prep-n">${i + 1}</span><div><h3>${esc(h)}</h3><p>${esc(fill(p))}</p></div></div>
      <div class="ex-row">${(PREP_EXAMPLES[i] || []).map(card).join("")}</div></li>`).join("")}</ol>
  <p class="prep-next"><a class="btn btn-line" href="#/about/method">${esc(at("p_next"))} →</a></p>
  <dialog class="ex-dlg" id="ex-dlg" aria-labelledby="ex-dlg-t"><header><div><h3 id="ex-dlg-t"></h3><small id="ex-dlg-m"></small></div>
    <button type="button" class="chat-x" id="ex-dlg-x" aria-label="${esc(at("ex_close"))}">×</button></header><pre id="ex-dlg-b"></pre></dialog>`);
  const dlg = $("#ex-dlg");
  document.querySelectorAll(".ex-card").forEach(b => b.onclick = () => {
    const k = b.dataset.ex, e = ex[k];
    $("#ex-dlg-t").textContent = at("ex")[k];
    $("#ex-dlg-m").textContent = meta(k, e);
    $("#ex-dlg-b").textContent = e.text + (k !== "chunks" && e.shown < e.lines ? "\n" + at("ex_cut", { n: fmt(e.lines - e.shown) }) : "");
    $("#ex-dlg-b").scrollTop = 0;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  });
  $("#ex-dlg-x").onclick = () => (dlg.close ? dlg.close() : dlg.removeAttribute("open"));
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });     // click outside the box closes it
}

// ---------- page 4: how relevance is calculated ----------
const TEX = {
  cos: String.raw`\cos(\mathbf{q},\mathbf{d}) = \frac{\mathbf{q}\cdot\mathbf{d}}{\lVert\mathbf{q}\rVert\,\lVert\mathbf{d}\rVert} = \sum_{i=1}^{n} q_i\, d_i \quad (\lVert\mathbf{q}\rVert=\lVert\mathbf{d}\rVert=1)`,
  rrf: (k, w) => String.raw`\mathrm{RRF}(d) = \sum_{\ell \in \text{4 lists}} \frac{w_\ell}{${k} + \mathrm{rank}_\ell(d)}, \qquad w_{\text{meaning}} = ${w.card_vec},\; w_{\text{word}} = ${w.card_bm25}`,
  sim: (lo, hi) => String.raw`s = \mathrm{clip}\!\left(\frac{\max(\cos_{\text{card}},\cos_{\text{piece}}) - ${lo}}{${hi} - ${lo}},\,0,\,1\right)`,
  interest: sh => String.raw`I_{\text{text}} = ${sh}\, s + ${(1 - sh).toFixed(1)}\, \frac{\mathrm{RRF}(d)}{\mathrm{RRF}_{\text{best}}}`,
  prof: String.raw`p = \mathrm{clip}\!\left(\frac{\cos(\mathbf{m},\mathbf{d}) - \mathrm{median}_m}{\max_m - \mathrm{median}_m},\,0,\,1\right)`,
  major: sh => String.raw`M = ${(1 - sh).toFixed(1)}\, f + ${sh}\, p`,
  score: String.raw`\text{relevance} = 10 \times \frac{w_I\, I + w_M\, M}{w_I + w_M}`,
  mmr: lam => String.raw`\text{next} = \arg\max_{d}\; \Big[\, ${lam}\, \frac{\text{relevance}(d)}{10} - ${(1 - lam).toFixed(2)}\, \max_{d' \in \text{picked}} \cos(d, d') \Big]`,
};
function texBlock(tex) { return `<div class="tex" data-tex="${esc(tex)}"><code>${esc(tex)}</code></div>`; }

async function pageMethod(seq) {
  const m = await aboutData("method");
  if (seq !== navSeq) return;
  const r = m.ranking, s = m.search, wi = r.weights.with_text, wc = r.weights.no_text, it = r.interest, mj = r.major;
  const fitRows = [["core_main", mj.core_main], ["core_other", mj.core_other], ["related_main", mj.related_main], ["related_other", mj.related_other], ["none", 0]];
  // worked example from the live settings
  const ex = (() => {
    const sim = Math.min(1, Math.max(0, (0.74 - it.sim_low) / (it.sim_high - it.sim_low)));
    const I = it.sim_share * sim + (1 - it.sim_share) * 0.8, M = (1 - mj.profile_share) * mj.core_main + mj.profile_share * 0.6;
    return { sim, I, M, score: 10 * (wi.interest * I + wi.major * M) / (wi.interest + wi.major) };
  })();
  view(`
  <section class="about-head"><h1>${esc(at("m_title"))}</h1><p class="lead">${esc(at("m_intro"))}</p>
    <p class="hint">${esc(at("m_prep"))} <a href="#/about/prep">${esc(at("sub_prep"))} →</a></p></section>
  <section class="panel"><h3>${esc(at("flow_title"))}</h3>
    <ol class="flow">${at("flow").map(x => `<li>${esc(x)}</li>`).join("")}</ol></section>
  <section class="panel cos-panel"><div><h3>${esc(at("cos_title"))}</h3><p>${esc(at("cos_text"))}</p></div>${cosSvg()}</section>
  <section class="panel" id="calc"><h3>${esc(at("calc_title"))}</h3><p class="hint">${esc(at("calc_intro"))}</p>${calcHTML()}</section>
  <section class="panel detail-sec"><h2 class="h-sec">${esc(at("m_detail"))}</h2>
    <h3>${esc(at("d_embed"))}</h3><p>${esc(at("d_embed_t", { chunk: fmt(s.chunk_chars), cards: fmt(m.counts.cards), chunks: fmt(m.counts.chunks), model: s.embedding.model, dim: s.embedding.output_dim }))}</p>
    ${texBlock(TEX.cos)}
    <h3>${esc(at("d_search"))}</h3><p>${esc(at("d_search_t", { cand: s.candidates }))}</p>
    ${texBlock(TEX.rrf(s.rrf_k, s.weights))}
    <h3>${esc(at("d_interest"))}</h3><p>${esc(at("d_interest_t", { lo: it.sim_low, hi: it.sim_high, cm: it.chip_main, co: it.chip_other, ts: it.text_share, cs: +(1 - it.text_share).toFixed(1) }))}</p>
    ${texBlock(TEX.sim(it.sim_low, it.sim_high))}${texBlock(TEX.interest(it.sim_share))}
    <h3>${esc(at("d_major"))}</h3><p>${esc(at("d_major_t"))}</p>
    <table class="facts fit"><tr><th>${esc(at("fit_table")[0])}</th><th>${esc(at("fit_table")[1])} f</th></tr>${fitRows.map(([k, v]) => `<tr><td>${esc(at("fit_" + k))}</td><td>${v}</td></tr>`).join("")}</table>
    ${texBlock(TEX.prof)}${texBlock(TEX.major(mj.profile_share))}
    <h3>${esc(at("d_score"))}</h3><p>${esc(at("d_score_t", { wi: wi.interest, wm: wi.major, ci: wc.interest, cm2: wc.major }))}</p>
    ${texBlock(TEX.score)}
    <div class="example"><b>${esc(at("d_example"))}</b> ${esc(at("d_example_t"))}
      ${texBlock(String.raw`s = \frac{0.74 - ${it.sim_low}}{${it.sim_high} - ${it.sim_low}} = ${ex.sim.toFixed(2)},\quad I = ${it.sim_share}\times${ex.sim.toFixed(2)} + ${(1 - it.sim_share).toFixed(1)}\times 0.8 = ${ex.I.toFixed(2)}`)}
      ${texBlock(String.raw`M = ${(1 - mj.profile_share).toFixed(1)}\times ${mj.core_main} + ${mj.profile_share}\times 0.6 = ${ex.M.toFixed(2)},\quad \text{relevance} = 10\times\frac{${wi.interest}\times${ex.I.toFixed(2)} + ${wi.major}\times${ex.M.toFixed(2)}}{${wi.interest}+${wi.major}} = ${ex.score.toFixed(1)}`)}</div>
    <h3>${esc(at("d_label"))}</h3><p>${esc(at("d_label_t", { ks: s.match_label.korean.strong, kp: s.match_label.korean.partial, es: s.match_label.english.strong, ep: s.match_label.english.partial }))}</p>
    <h3>${esc(at("d_mmr"))}</h3><p>${esc(at("d_mmr_t", { lam: r.diversity.mmr_lambda }))}</p>
    ${texBlock(TEX.mmr(r.diversity.mmr_lambda))}
    <h3>${esc(at("d_map"))}</h3><p>${esc(at("d_map_t"))} <a href="#/about/map">${esc(at("sub_map"))}</a></p>
    <h3>${esc(at("d_eval"))}</h3><p>${esc(at("d_eval_t"))}</p>
    <h3>${esc(at("d_limits"))}</h3><ul class="plain">${at("limits").map(x => `<li>${esc(x)}</li>`).join("")}</ul>
  </section>`);
  bindCalc(r);
  // nicer formulas when KaTeX loads; the plain TeX stays readable if it does not
  try {
    loadCss(KATEX + "katex.min.css"); await loadScript(KATEX + "katex.min.js");
    if (seq !== navSeq || !window.katex) return;
    document.querySelectorAll(".tex[data-tex]").forEach(el => { try { window.katex.render(el.dataset.tex, el, { displayMode: true, throwOnError: false, output: "html" }); el.setAttribute("role", "img"); el.setAttribute("aria-label", el.dataset.tex); } catch (e) { /* keep plain text */ } });
  } catch (e) { /* offline: plain formulas stay */ }
}

function cosSvg() {
  // two small angles (similar meaning) and one large angle (different meaning), drawn from one origin
  const arrow = (deg, len, color, label) => {
    const a = -deg * Math.PI / 180, x = Math.cos(a) * len, y = Math.sin(a) * len;
    return `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="2.5" marker-end="url(#ah-${color.slice(1)})"/>
      <text x="${(x * 1.08).toFixed(1)}" y="${(y * 1.08 - 4).toFixed(1)}" class="cos-l" text-anchor="${deg > 70 ? "middle" : "start"}">${esc(label)}</text>`;
  };
  const ko = lang === "ko";
  const marker = c => `<marker id="ah-${c.slice(1)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${c}"/></marker>`;
  return `<svg class="cos-svg" viewBox="-20 -170 250 190" role="img" aria-label="${esc(at("cos_title"))}">
    <defs>${marker("#378aff")}${marker("#999999")}</defs>
    <line x1="-10" y1="0" x2="220" y2="0" stroke="#e5eaee"/>
    <path d="M60,0 A60,60 0 0 0 ${(60 * Math.cos(-20 * Math.PI / 180)).toFixed(1)},${(60 * Math.sin(-20 * Math.PI / 180)).toFixed(1)}" fill="none" stroke="#378aff" stroke-width="1.5"/>
    <text x="68" y="-8" class="cos-a">${ko ? "작은 각도 = 비슷함" : "small angle = similar"}</text>
    ${arrow(0, 170, "#378aff", ko ? "강아지" : "puppy")}${arrow(20, 160, "#378aff", ko ? "반려견" : "dog")}${arrow(85, 130, "#999999", ko ? "자동차" : "car")}</svg>`;
}

function calcHTML() {
  const sl = (id, label, min, max, step, val) => `<label class="cl"><span>${esc(label)} <output id="o-${id}">${val}</output></span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  const opt = (id, label, opts) => `<label class="cl"><span>${esc(label)}</span><select id="${id}">${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></label>`;
  return `<div class="calc"><div class="calc-in">
    <label class="cl cl-check"><input type="checkbox" id="c-text" checked> ${esc(at("c_text"))}</label>
    ${sl("c-cos", at("c_cos"), 0.4, 0.95, 0.01, 0.74)}${sl("c-rank", at("c_rank"), 0, 1, 0.05, 0.8)}
    ${opt("c-chip", at("c_chip"), [["none", at("chip_none")], ["main", at("chip_main")], ["other", at("chip_other")]])}
    ${opt("c-fit", at("c_fit"), ["core_main", "core_other", "related_main", "related_other", "none"].map(k => [k, at("fit_" + k)]))}
    ${sl("c-prof", at("c_prof"), 0, 1, 0.05, 0.6)}
  </div><div class="calc-out" aria-live="polite">
    <div class="co-row"><span>${esc(at("c_interest"))}</span><span class="co-bar"><i id="b-i"></i></span><b id="v-i"></b></div>
    <div class="co-row"><span>${esc(at("c_major"))}</span><span class="co-bar"><i id="b-m"></i></span><b id="v-m"></b></div>
    <div class="co-score"><span>${esc(at("c_score"))}</span><b id="v-s"></b><small>/10</small></div>
    <code id="c-formula"></code>
  </div></div>`;
}

function bindCalc(r) {
  const it = r.interest, mj = r.major;
  const upd = () => {
    const text = $("#c-text").checked, cos = +$("#c-cos").value, rank = +$("#c-rank").value, chip = $("#c-chip").value;
    const fit = $("#c-fit").value === "none" ? 0 : mj[$("#c-fit").value], prof = +$("#c-prof").value;
    $("#o-c-cos").textContent = cos.toFixed(2); $("#o-c-rank").textContent = rank.toFixed(2); $("#o-c-prof").textContent = prof.toFixed(2);
    document.querySelectorAll("#calc input[type=range]").forEach(r => r.style.setProperty("--p", (100 * (r.value - r.min) / (r.max - r.min)) + "%"));
    $("#c-cos").disabled = $("#c-rank").disabled = !text;
    const s = Math.min(1, Math.max(0, (cos - it.sim_low) / (it.sim_high - it.sim_low)));
    const ti = text ? it.sim_share * s + (1 - it.sim_share) * rank : null;
    const ci = chip === "none" ? null : chip === "main" ? it.chip_main : it.chip_other;
    const I = ti !== null && ci !== null ? it.text_share * ti + (1 - it.text_share) * ci : (ti ?? ci);
    const M = (1 - mj.profile_share) * fit + mj.profile_share * prof;
    const w = r.weights[text ? "with_text" : "no_text"];
    const parts = I === null ? [["major", M]] : [["interest", I], ["major", M]];
    const score = 10 * parts.reduce((a, [k, v]) => a + w[k] * v, 0) / parts.reduce((a, [k]) => a + w[k], 0);
    $("#b-i").style.width = ((I ?? 0) * 100) + "%"; $("#v-i").textContent = I === null ? "—" : I.toFixed(2);
    $("#b-m").style.width = (M * 100) + "%"; $("#v-m").textContent = M.toFixed(2);
    $("#v-s").textContent = score.toFixed(1);
    $("#c-formula").textContent = I === null ? `10 × ${M.toFixed(2)} = ${score.toFixed(1)}`
      : `10 × (${w.interest} × ${I.toFixed(2)} + ${w.major} × ${M.toFixed(2)}) / ${(w.interest + w.major).toFixed(1)} = ${score.toFixed(1)}`;
  };
  document.querySelectorAll("#calc input, #calc select").forEach(el => el.addEventListener("input", upd));
  upd();
}

window.About = {
  async render(seq, sub, extra) {
    const page = ABOUT_PAGES.includes(sub) ? sub : "aihub";
    setFrame("page_about", at("sub_" + page));
    if (page === "map") return pageMap(seq, extra);
    if (page === "method") return pageMethod(seq);
    if (page === "prep") return pagePrep(seq);
    return pageAihub(seq);
  },
};
