"""All genre links must fit without a scroll container, including during reveal."""
from pathlib import Path
from playwright.sync_api import sync_playwright
out = Path('artifacts/mechanical-ui')
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    for reduced in ['no-preference', 'reduce']:
        page.emulate_media(reduced_motion=reduced)
        for width in [320, 390, 768, 1024, 1440]:
            page.set_viewport_size({'width': width, 'height': 900})
            page.goto('http://localhost:3000')
            page.wait_for_load_state('networkidle')
            rail = page.locator('.genre-links')
            rail.scroll_into_view_if_needed()
            page.wait_for_timeout(2300)
            result = rail.evaluate('''e => {
                const r = e.getBoundingClientRect();
                return {count:e.children.length, scroll:e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1,
                visible:[...e.children].every(a => {const b=a.getBoundingClientRect(); return b.left >= r.left-1 && b.right <= r.right+1 && b.top >= r.top-1 && b.bottom <= r.bottom+1 && Number(getComputedStyle(a).opacity) > .99;})};
            }''')
            assert result['count'] == 10, result
            assert not result['scroll'] and result['visible'], (width, reduced, result)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            if reduced == 'no-preference' and width in [390,1440]:
                page.screenshot(path=str(out / f'genres-{width}.png'))
    print('PASS: all 10 genres fully visible, no rail/page overflow at 320/390/768/1024/1440, with normal and reduced motion')
    browser.close()
