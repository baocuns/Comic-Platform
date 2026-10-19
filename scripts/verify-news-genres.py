"""Regression for homepage worlds and editorial 3D panels."""
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('artifacts/mechanical-ui')
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    world = page.locator('.genre-links a').first
    href = world.get_attribute('href')
    slug = href.split('genre=')[1]
    name = world.inner_text().replace('↗', '').strip()
    with page.expect_response(lambda r: '/comics?' in r.url and 'genre=' in r.url) as response:
        world.click()
    assert f'genre={slug}' in response.value.url
    page.wait_for_load_state('networkidle')
    assert 'bg-amber-500 text-white' in page.get_by_role('button', name=name, exact=False).get_attribute('class')
    page.get_by_role('button', name='Tất cả', exact=True).click()
    page.wait_for_url('**/comics')
    page.go_back()
    page.wait_for_url('**/comics?genre=*')
    page.wait_for_load_state('networkidle')
    assert 'bg-amber-500 text-white' in page.get_by_role('button', name=name, exact=False).get_attribute('class')
    page.reload()
    page.wait_for_load_state('networkidle')
    assert 'bg-amber-500 text-white' in page.get_by_role('button', name=name, exact=False).get_attribute('class')
    page.goto('http://localhost:3000/comics?search=H%C3%B4m')
    with page.expect_response(lambda r: '/comics?' in r.url and 'search=' in r.url):
        page.reload()
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    section = page.locator('.mech-news')
    section.scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    def transforms():
        return page.locator('[data-news-plane]').evaluate_all('(els) => els.map(e => getComputedStyle(e).transform)')
    assert len(transforms()) > 0
    before = transforms()
    page.wait_for_timeout(650)
    assert all(a != b for a, b in zip(before, transforms())), 'Every news panel should move in 3D'
    page.screenshot(path=str(out / 'news-desktop.png'))
    page.get_by_role('button', name='Dừng chuyển động', exact=True).click()
    section.scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    before = transforms()
    page.wait_for_timeout(500)
    assert before == transforms(), 'Pause should stop editorial motion'
    page.get_by_role('button', name='Bật chuyển động', exact=True).click()
    section.scroll_into_view_if_needed()
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(1000)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(out / 'news-mobile.png'))
    page.emulate_media(reduced_motion='reduce')
    page.reload()
    page.wait_for_load_state('networkidle')
    section.scroll_into_view_if_needed()
    before = transforms()
    page.wait_for_timeout(600)
    assert before == transforms(), 'Reduced motion should stop news motion'
    assert not errors, errors
    print('PASS: genre navigation/API/filter/back/reload, search API, news 3D, pause, mobile overflow, reduced motion, no page errors')
    browser.close()
