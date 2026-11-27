const menu = document.querySelector('.mobile-menu');
if (menu) {
  const menuButton = menu.querySelector('summary');
  document.addEventListener('click', (event) => {
    if (menu.open && (!menu.contains(event.target) || event.target.closest('a'))) {
      menu.open = false;
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menuButton?.focus();
    }
  });
}

const filterButtons = Array.from(document.querySelectorAll('.filter-pill'));
const projectGroups = Array.from(document.querySelectorAll('.project-group'));

if (filterButtons.length && projectGroups.length) {
  const applyFilter = (category) => {
    filterButtons.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.cat === category));
    });
    projectGroups.forEach((group) => {
      group.hidden = category !== 'all' && group.dataset.cat !== category;
    });
  };

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyFilter(btn.dataset.cat || 'all');
    });
  });

  applyFilter('all');
}
