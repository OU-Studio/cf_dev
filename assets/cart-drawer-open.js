// Opens the cart drawer on demand and wires common triggers.
// Also flashes <body>.itemadded for 4s on successful add-to-cart.
(() => {
  const getDrawer = () => document.querySelector('cart-drawer');

  function openDrawer() {
    const d = getDrawer();
    if (!d) return;
    if (typeof d.open === 'function') d.open(); else d.setAttribute('open', '');
  }
  function closeDrawer() {
    const d = getDrawer();
    if (!d) return;
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  }

   // --- itemadded flash ---
  const CLASS = 'itemadded';
  function flashItemAdded() {
    document.body.classList.add(CLASS);
  }

  // A) Header icon trigger
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-cart]');
    if (!t) return;
    e.preventDefault();
    openDrawer();
  });

  // Fallback: header links to /cart
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href*="/cart"]');
    if (!link || !link.closest('header')) return;
    e.preventDefault();
    openDrawer();
  });

  // B) Open on cart updates + flash on add (with robust wiring + logs)
  function wirePubSub() {
    if (!(window.PUB_SUB_EVENTS?.cartUpdate && typeof window.subscribe === 'function')) return false;

    if (!window.__cartDrawerOpenSub) {
      window.__cartDrawerOpenSub = subscribe(PUB_SUB_EVENTS.cartUpdate, (evt) => {
        // Debug once so we can see payload shape
        if (!window.__loggedCartEvt) {
          console.log('[cartUpdate evt]', evt);
          window.__loggedCartEvt = true;
        }

        // Let cart.js swap DOM, then open
        requestAnimationFrame(openDrawer);

        // Most Dawn adds: evt.source === 'product-form' or it carries productVariantId
        // If your theme differs, the debug log above will reveal keys to check.
        if (evt && (evt.source === 'product-form' || 'productVariantId' in evt)) {
          flashItemAdded();
        }
      });
    }
    return true;
  }

  // Retry until pub/sub is ready (some bundles load late)
  if (!wirePubSub()) {
    const retry = setInterval(() => { if (wirePubSub()) clearInterval(retry); }, 120);
    setTimeout(() => clearInterval(retry), 10000); // stop after 10s
  }

  // C) Close on overlay / [data-drawer-close]
  document.addEventListener('click', (e) => {
    if (e.target.id === 'CartDrawer-Overlay' || e.target.closest('[data-drawer-close]')) closeDrawer();
  });

  // D) Fallback: intercept /cart/add to flash even if pub/sub isn't available
  const addUrl = (window.routes?.cart_add_url) || '/cart/add';
  const _fetch = window.fetch;
  window.fetch = function patchedFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = (init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();

    const isAdd = url.includes(addUrl) && method !== 'GET';
    if (!isAdd) return _fetch.apply(this, arguments);

    return _fetch.apply(this, arguments).then((res) => {
      // Clone to peek at JSON; ignore errors
      res.clone().json?.().then((data) => {
        if (data && !data.status) {
          // successful add → flash
          flashItemAdded();
        }
      }).catch(() => {});
      return res;
    });
  };

  // Debug helpers
  window.__openCartDrawer = openDrawer;
  window.__closeCartDrawer = closeDrawer;
  window.flashItemAdded = flashItemAdded;
})();
