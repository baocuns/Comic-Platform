"""Browser regression checks for the cinematic manga homepage."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('artifacts/mechanical-ui')
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    page.get_by_role('heading', name='Đang được khám phá', exact=True).wait_for()
    page.wait_for_timeout(1800)
    moving = ['.cinema-frame', '.slice-far', '.slice-near', '.folio-leaf']
    def transforms():
        return [page.locator(selector).evaluate('(el) => getComputedStyle(el).transform') for selector in moving]
    page.get_by_role('button', name='Lật trang truyện', exact=True).click()
    page.wait_for_timeout(700)
    first = transforms()
    page.screenshot(path=str(out / 'desktop.png'))
    page.wait_for_timeout(650)
    assert all(a != b for a, b in zip(first, transforms())), 'Independent scene planes and page should move'
    page.screenshot(path=str(out / 'desktop-page-turn.png'))
    page.get_by_role('button', name='Truyện tiếp theo', exact=True).click()
    page.wait_for_timeout(550)
    page.screenshot(path=str(out / 'desktop-transition.png'))
    page.wait_for_timeout(1500)
    assert page.get_by_role('button', name='Truyện tiêu điểm 2', exact=True).get_attribute('aria-pressed') == 'true'
    assert page.locator('.cinema-cover').evaluate('(el) => Number(getComputedStyle(el).opacity)') == 1
    page.get_by_role('button', name='Dừng chuyển động', exact=True).click()
    stopped = transforms()
    page.wait_for_timeout(400)
    assert stopped == transforms(), 'Pause should stop scene and page animation'
    page.get_by_role('button', name='Truyện tiếp theo', exact=True).click()
    assert page.get_by_role('button', name='Truyện tiêu điểm 3', exact=True).get_attribute('aria-pressed') == 'true'
    page.get_by_role('button', name='Bật chuyển động', exact=True).click()
    page.get_by_role('textbox', name='Tìm tên truyện hoặc tác giả').fill('Hôm nay')
    page.get_by_role('button', name='Tìm truyện', exact=True).click()
    page.wait_for_url('**/comics?search=*')
    assert 'search=H%C3%B4m%20nay' in page.url
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    page.get_by_role('button', name='Tìm kiếm', exact=True).click()
    page.get_by_role('textbox').first.wait_for()
    page.keyboard.press('Escape')
    for width in [390, 768, 1024]:
        page.set_viewport_size({"width": width, "height": 844})
        page.wait_for_timeout(500)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Overflow at {width}'
        page.screenshot(path=str(out / f'viewport-{width}.png'), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path=str(out / 'mobile.png'), full_page=True)
    page.emulate_media(reduced_motion='reduce')
    page.reload()
    page.wait_for_load_state('networkidle')
    reduced = transforms()
    page.wait_for_timeout(350)
    assert reduced == transforms(), 'Reduced motion should stop all ambient transforms'
    page.get_by_role('button', name='Truyện tiếp theo', exact=True).click()
    assert page.get_by_role('button', name='Truyện tiêu điểm 2', exact=True).get_attribute('aria-pressed') == 'true'
    assert page.locator('#hero-title').is_visible()
    assert not errors, errors
    print(json.dumps({"independent_3d_planes": "pass", "hinged_page": "pass", "story_transition": "pass", "pause": "pass", "search_route": "pass", "search_modal": "opened", "responsive_widths": [390, 768, 1024, 1440], "reduced_motion": "pass", "page_errors": errors}, ensure_ascii=False))
    browser.close()
