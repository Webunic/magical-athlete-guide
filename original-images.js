(() => {
  const VERSION = '1.1.1';
  const titleToId = new Map();
  let mappingReady = false;

  function upgradeThumb(thumb) {
    if (!(thumb instanceof HTMLElement) || thumb.tagName === 'IMG') return;
    const article = thumb.closest('.card');
    const title = article?.querySelector('h3')?.textContent?.trim();
    const id = title ? titleToId.get(title) : null;
    if (!id) return;

    const image = document.createElement('img');
    image.className = thumb.className;
    image.src = `./assets/cards/${id}.png?v=${VERSION}`;
    image.alt = title;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = 942;
    image.height = 500;
    image.dataset.source = 'original-rulebook';
    thumb.replaceWith(image);
  }

  function upgradeAll(root = document) {
    if (!mappingReady) return;
    root.querySelectorAll?.('.card .thumb').forEach(upgradeThumb);
  }

  const observer = new MutationObserver(records => {
    if (!mappingReady) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.('.thumb')) upgradeThumb(node);
        upgradeAll(node);
      }
    }
  });

  observer.observe(document.documentElement, {childList: true, subtree: true});

  fetch('./cards.json')
    .then(response => {
      if (!response.ok) throw new Error(`cards.json: ${response.status}`);
      return response.json();
    })
    .then(cards => {
      cards.forEach(card => {
        titleToId.set(card.ru, card.id);
        titleToId.set(card.en, card.id);
      });
      mappingReady = true;
      upgradeAll();
      const version = document.querySelector('.version');
      if (version) version.textContent = `Magical Athlete Companion v${VERSION}`;
    })
    .catch(error => console.error('Не удалось подключить оригинальные изображения карт.', error));
})();
