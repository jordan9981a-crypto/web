document.documentElement.classList.add('js');

const toggle = document.querySelector('.nav-toggle');
const navigation = document.querySelector('.main-navigation');

function closeMenu({ focusToggle = false } = {}) {
  if (!toggle || !navigation) return;
  navigation.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
  if (focusToggle) toggle.focus();
}

if (toggle && navigation) {
  toggle.addEventListener('click', () => {
    const isOpen = navigation.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  for (const link of document.querySelectorAll('.main-navigation a')) {
    link.addEventListener('click', () => closeMenu());
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navigation.classList.contains('is-open')) closeMenu({ focusToggle: true });
  });
}

const filterButtons = document.querySelectorAll('[data-year-filter]');
const publicationYears = document.querySelectorAll('.publication-year[data-year]');

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    const selectedYear = button.getAttribute('data-year-filter');
    for (const filter of filterButtons) {
      filter.setAttribute('aria-pressed', String(filter === button));
    }
    for (const yearSection of publicationYears) {
      yearSection.hidden = selectedYear !== 'all' && yearSection.getAttribute('data-year') !== selectedYear;
    }
  });
}
