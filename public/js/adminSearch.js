/**
 * Progressive live search filtering for admin tables (paired with server-side GET ?q= search forms).
 */
document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('[data-table-search-target]');
  if (!inputs.length) return;

  function applyTableFilter(tableId, rawTerm) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const term = rawTerm.trim().toLowerCase();
    const rows = table.querySelectorAll('tbody tr[data-search-row]');
    const emptyRow = table.querySelector('tbody tr[data-empty-search-row]');
    let visibleCount = 0;

    rows.forEach((row) => {
      const hay = (row.dataset.searchText || row.textContent || '').toLowerCase();
      const matched = !term || hay.includes(term);
      row.classList.toggle('hidden', !matched);
      if (matched) visibleCount += 1;
    });

    if (emptyRow) {
      emptyRow.classList.toggle('hidden', !(rows.length > 0 && visibleCount === 0));
    }
  }

  inputs.forEach((input) => {
    const targetId = input.getAttribute('data-table-search-target');
    if (!targetId) return;

    input.addEventListener('input', () => {
      const value = input.value;
      document
        .querySelectorAll(`[data-table-search-target="${targetId}"]`)
        .forEach((sibling) => {
          if (sibling !== input) sibling.value = value;
        });
      applyTableFilter(targetId, value);
    });
  });
});
