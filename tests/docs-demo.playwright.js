// playwright-cli -s=aside-ux run-code --filename=.../tests/docs-demo.playwright.js
async (page) => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('http://localhost:8927/aside-tweaks/');
    await page.evaluate(theme => document.body.dataset.aimProfile = theme === 'dark' ? 'n1-dark' : 'n1', theme);
    const color = await page.locator('#palette').evaluate(el => getComputedStyle(el).backgroundColor);
    const brightness = color.match(/\d+/g).slice(0, 3).reduce((sum, n) => sum + Number(n), 0) / 3;
    assert(theme === 'dark' ? brightness < 100 : brightness > 200, 'theme did not change palette pixels: ' + color);
    const foreground = await page.locator('#palette .title').first().evaluate(el => getComputedStyle(el).color);
    const fgBrightness = foreground.match(/\d+/g).slice(0, 3).reduce((sum, n) => sum + Number(n), 0) / 3;
    assert(theme === 'dark' ? fgBrightness > 180 : fgBrightness < 100, 'palette text lacks contrast: ' + foreground);
    assert(await page.locator('[data-release-date]').textContent() === '2026-10-03', 'release date drift');
    await page.locator('[data-mode="review"]').click();
    assert(await page.locator('#palette').getAttribute('data-demo-state') === 'inspect', 'missing inspect');
    assert(await page.locator('#demo-confirm').count() === 0, 'confirmation shown before preview');
    await page.locator('#demo-preview').click();
    assert(await page.locator('#palette').getAttribute('data-demo-state') === 'preview', 'missing preview');
    assert((await page.locator('#paletteList').innerText()).includes('bookmarked duplicate · stays'), 'missing bookmark protection');
    assert(await page.locator('#paletteList [role="option"]').count() === 5, 'preview must show all 5 tabs');
    await page.locator('#demo-confirm').click();
    assert(await page.locator('#palette').getAttribute('data-demo-state') === 'receipt', 'missing receipt');
    assert((await page.locator('#paletteList').innerText()).includes('2 closed / 3 stays'), 'receipt counts drift');
    await page.locator('#palette').screenshot({ path: '/tmp/codex-screenshots/aside-demo-' + theme + '.png' });
    await page.locator('#demo-reset').click();
    assert(await page.locator('#palette').getAttribute('data-demo-state') === 'inspect', 'reset failed');
    await page.locator('[data-mode="palette"]').click();
    assert(!(await page.locator('#paletteList').innerText()).includes('aside product map'), 'All shows unrelated recent notes');
    await page.locator('#scopes button').filter({ hasText: /^notes$/ }).click();
    assert((await page.locator('#paletteList').innerText()).includes('aside product map'), 'explicit Notes scope failed');
    await page.locator('[data-mode="keep"]').click();
    await page.locator('[data-demo-bookmark]').waitFor();
    assert(await page.locator('#bookmarks .aside-tab').count() === 3, 'keep does not append at bottom');
    assert(await page.locator('#favorites .favorite').count() === 3, 'keep incorrectly creates Pin square');
    await page.locator('[data-mode="keep"]').click();
    await page.waitForFunction(() => !document.querySelector('[data-demo-bookmark]'));
    console.log('PASS docs ' + theme + ' · inspect/preview/confirm/receipt/reset · scopes · keep/unkeep');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:8927/aside-tweaks/');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile horizontal overflow');
  await page.screenshot({ path: '/tmp/codex-screenshots/aside-demo-mobile.png', fullPage: true });
  await page.goto('http://localhost:8927/aside-tweaks/preview.html');
  await page.locator('[data-mode="review"]').click();
  await page.locator('#demo-preview').click();
  await page.locator('#demo-confirm').click();
  assert((await page.locator('#paletteList').innerText()).includes('2 closed / 3 stays'), 'embedded receipt failed');
  assert(errors.length === 0, 'JS errors: ' + errors.join('; '));
  console.log('PASS mobile and embedded preview · no JS errors');
}
