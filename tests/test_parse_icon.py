"""Icon address read from an AI Hub dataset page header (processing.parse_aihub.parse_icon)."""
from processing.parse_aihub import parse_icon

BASE = "https://www.aihub.or.kr"
PAGE = """<div class="dataHead"><div class="contentWrap"><span class="icon">
<img src="/web-nas/aihub21/files/public/DATA_SET202205100230118940" alt="x"></span><h3>t</h3></div></div>
<div class="slick-slide"><span class="img"><img src="/web-nas/aihub21/files/public/OTHER"></span></div>"""


def test_relative_icon_becomes_full_address():
    assert parse_icon(PAGE, BASE) == BASE + "/web-nas/aihub21/files/public/DATA_SET202205100230118940"


def test_related_data_images_are_ignored():
    page = PAGE.replace('<span class="icon">', '<span class="noicon">')
    assert parse_icon(page, BASE) is None


def test_full_address_kept_and_empty_src_is_none():
    assert parse_icon(PAGE.replace('src="/web', 'src="https://cdn.example/web'), BASE).startswith("https://cdn.example/")
    assert parse_icon('<div class="dataHead"><span class="icon"><img src=""></span></div>', BASE) is None
