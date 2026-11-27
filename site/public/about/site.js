const menu = document.querySelector('.mobile-menu');
const menuButton = menu.querySelector('summary');

document.addEventListener('click', (event) => {
  if (menu.open && (!menu.contains(event.target) || event.target.closest('a'))) {
    menu.open = false;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu.open) {
    menu.open = false;
    menuButton.focus();
  }
});

const caseLinks = document.querySelector('.case-links');
const tabs = Array.from(caseLinks.querySelectorAll('a'));
const panels = tabs.map((tab) => document.querySelector(tab.hash));
caseLinks.setAttribute('role', 'tablist');

function selectCase(index) {
  tabs.forEach((tab, position) => {
    const selected = position === index;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panels[position].hidden = !selected;
  });
}

tabs.forEach((tab, index) => {
  const panel = panels[index];
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', panel.id);
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', tab.id);
  panel.tabIndex = 0;
  tab.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectCase(index);
    history.replaceState(null, '', tab.hash);
  });
  tab.addEventListener('keydown', (event) => {
    let next;
    switch (event.key) {
      case 'ArrowRight': next = (index + 1) % tabs.length; break;
      case 'ArrowLeft': next = (index - 1 + tabs.length) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  });
});

function caseFromUrl() {
  return tabs.findIndex((tab) => tab.hash === location.hash);
}
selectCase(Math.max(caseFromUrl(), 0));
window.addEventListener('hashchange', () => {
  const index = caseFromUrl();
  if (index >= 0) selectCase(index);
});
