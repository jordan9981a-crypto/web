import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class FakeClassList {
  #values = new Set();

  add(value) { this.#values.add(value); }
  remove(value) { this.#values.delete(value); }
  contains(value) { return this.#values.has(value); }
  toggle(value) {
    if (this.#values.has(value)) {
      this.#values.delete(value);
      return false;
    }
    this.#values.add(value);
    return true;
  }
}

class FakeElement {
  constructor(attributes = {}) {
    this.attributes = new Map(Object.entries(attributes));
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.focused = false;
  }

  addEventListener(type, listener) { this.listeners.set(type, listener); }
  dispatch(type, event = {}) { this.listeners.get(type)?.({ currentTarget: this, ...event }); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  focus() { this.focused = true; }
}

async function loadSite({ withMenu = true, withFilters = true } = {}) {
  const documentElement = new FakeElement();
  const toggle = withMenu ? new FakeElement({ 'aria-expanded': 'false' }) : null;
  const navigation = withMenu ? new FakeElement() : null;
  const navLink = withMenu ? new FakeElement() : null;
  const filters = withFilters ? [
    new FakeElement({ 'data-year-filter': 'all', 'aria-pressed': 'true' }),
    new FakeElement({ 'data-year-filter': '2026', 'aria-pressed': 'false' }),
    new FakeElement({ 'data-year-filter': '2025', 'aria-pressed': 'false' }),
  ] : [];
  const years = withFilters ? [
    new FakeElement({ 'data-year': '2026' }),
    new FakeElement({ 'data-year': '2025' }),
  ] : [];
  const document = {
    documentElement,
    querySelector(selector) {
      return ({ '.nav-toggle': toggle, '.main-navigation': navigation })[selector] ?? null;
    },
    querySelectorAll(selector) {
      if (selector === '.main-navigation a') return navLink ? [navLink] : [];
      if (selector === '[data-year-filter]') return filters;
      if (selector === '.publication-year[data-year]') return years;
      return [];
    },
    addEventListener(type, listener) { this.keydown = type === 'keydown' ? listener : null; },
  };
  const source = await readFile(new URL('../src/scripts/site.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, { document });
  return { document, documentElement, toggle, navigation, navLink, filters, years };
}

test('site client behavior marks JavaScript, controls the mobile menu, and handles Escape', async () => {
  const { document, documentElement, toggle, navigation, navLink } = await loadSite();

  assert.equal(documentElement.classList.contains('js'), true);
  toggle.dispatch('click');
  assert.equal(navigation.classList.contains('is-open'), true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');

  navLink.dispatch('click');
  assert.equal(navigation.classList.contains('is-open'), false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');

  toggle.dispatch('click');
  document.keydown({ key: 'Escape' });
  assert.equal(navigation.classList.contains('is-open'), false);
  assert.equal(toggle.focused, true);
});

test('site client behavior filters publication years and restores all years', async () => {
  const { filters, years } = await loadSite();

  filters[1].dispatch('click');
  assert.deepEqual(filters.map((filter) => filter.getAttribute('aria-pressed')), ['false', 'true', 'false']);
  assert.equal(years[0].hidden, false);
  assert.equal(years[1].hidden, true);

  filters[0].dispatch('click');
  assert.deepEqual(filters.map((filter) => filter.getAttribute('aria-pressed')), ['true', 'false', 'false']);
  assert.deepEqual(years.map((year) => year.hidden), [false, false]);
});

test('site client behavior tolerates pages without menus or publication filters', async () => {
  const { documentElement } = await loadSite({ withMenu: false, withFilters: false });
  assert.equal(documentElement.classList.contains('js'), true);
});
