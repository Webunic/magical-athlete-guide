(() => {
  const VERSION = '1.1.2';
  const originalByTitle = new Map();
  let mappingReady = false;

  function addOriginalText(article) {
    if (!mappingReady || !(article instanceof HTMLElement)) return;

    const body = article.matches('.card') ? article.querySelector('.card-body') : article.closest('.card')?.querySelector('.card-body');
    if (!body) return;

    const labels = [...body.querySelectorAll('.label')];
    if (labels.some(label => label.textContent.trim() === 'Оригинал')) return;

    const title = body.querySelector('h3')?.textContent?.trim();
    const original = title ? originalByTitle.get(title) : null;
    if (!original) return;

    const translationLabel = labels.find(label => label.textContent.trim() === 'Перевод');
    const translationText = translationLabel?.nextElementSibling;
    if (!translationText) return;

    const originalLabel = document.createElement('div');
    originalLabel.className = 'label';
    originalLabel.textContent = 'Оригинал';

    const originalText = document.createElement('p');
    originalText.className = 'original';
    originalText.textContent = original;

    translationText.after(originalLabel, originalText);
  }

  function upgradeAll(root = document) {
    if (!mappingReady) return;
    if (root instanceof HTMLElement && root.matches('.card')) addOriginalText(root);
    root.querySelectorAll?.('.card').forEach(addOriginalText);
  }

  const observer = new MutationObserver(records => {
    if (!mappingReady) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement) upgradeAll(node);
      }
    }
  });

  observer.observe(document.documentElement, {childList: true, subtree: true});

  fetch(`./cards.json?v=${VERSION}`)
    .then(response => {
      if (!response.ok) throw new Error(`cards.json: ${response.status}`);
      return response.json();
    })
    .then(cards => {
      cards.forEach(card => {
        originalByTitle.set(card.ru, card.original);
        originalByTitle.set(card.en, card.original);
      });
      mappingReady = true;
      upgradeAll();
    })
    .catch(error => console.error('Не удалось восстановить оригинальный текст карт.', error));
})();
