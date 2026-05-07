/* Entry screen — track CTA clicks + monument card selection. */
(function () {
  document.querySelectorAll('[data-event]').forEach((el) => {
    el.addEventListener('click', () => {
      window.rcTrack && window.rcTrack(el.dataset.event, {
        href: el.getAttribute('href') || null
      });
    });
  });

  /* Cover both legacy `.card` and new `.monument-card` markups. */
  document.querySelectorAll('.card[data-monument], .monument-card[data-monument]').forEach((card) => {
    const monument = card.dataset.monument;
    const isActive = card.classList.contains('is-active');
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      window.rcTrack && window.rcTrack('monument_picked', {
        monument,
        was_active: isActive
      });
      if (isActive) {
        window.location.href = `/game.html?monument=${monument}`;
      }
    });
  });
})();
