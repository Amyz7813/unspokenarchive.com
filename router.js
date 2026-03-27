/* ============================================================
   UnspokenArchive — Router
   Hash-based SPA routing. No server required.
   Routes: / | /archive | /write | /story/:id |
           /advice | /terminology | /crisis | /terms
   ============================================================ */

const ROUTES = {
  '/':            'renderHome',
  '/archive':     'renderArchive',
  '/write':       'renderWrite',
  '/story':       'renderStoryDetail',
  '/advice':      'renderAdvice',
  '/terminology': 'renderTerminology',
  '/crisis':      'renderCrisis',
  '/terms':       'renderTerms'
};

/* Active hero rotation interval — cleared on each navigation */
let _heroInterval = null;
function clearHeroInterval() {
  if (_heroInterval) { clearInterval(_heroInterval); _heroInterval = null; }
}
window._setHeroInterval = (id) => { _heroInterval = id; };

function updateActiveNav() {
  const hash = window.location.hash || '#/';
  document.querySelectorAll('nav a[data-nav]').forEach(link => {
    const matches = link.getAttribute('href') === hash ||
                    (hash.startsWith('#/story') && link.getAttribute('href') === '#/archive');
    link.classList.toggle('text-gold', matches);
    link.classList.toggle('text-muted', !matches);
  });
}

function router() {
  clearHeroInterval();

  const hash = window.location.hash || '#/';
  const path = hash.slice(1) || '/';
  const parts = path.split('/').filter(Boolean);

  /* Root gets special treatment — parts is empty */
  let route, id;
  if (parts.length === 0) {
    route = '/'; id = null;
  } else if (parts.length === 1) {
    route = '/' + parts[0]; id = null;
  } else {
    route = '/' + parts[0]; id = parts[1];
  }

  const fnName = ROUTES[route] || 'renderHome';

  if (typeof window[fnName] === 'function') {
    window[fnName](id);
  } else {
    window.renderHome();
  }

  /* Re-initialise Lucide icons after every DOM rebuild */
  if (window.lucide) lucide.createIcons();
  updateActiveNav();
  window.scrollTo({ top: 0, behavior: 'instant' });

  /* Close mobile menu */
  const mm = document.getElementById('mobile-menu');
  if (mm) mm.classList.add('hidden');
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);

/* Mobile menu toggle — event delegation on document */
document.addEventListener('click', e => {
  const toggle = e.target.closest('#menu-toggle');
  const mm = document.getElementById('mobile-menu');
  if (!mm) return;
  if (toggle) {
    mm.classList.toggle('hidden');
  } else if (!mm.classList.contains('hidden') && !mm.contains(e.target)) {
    mm.classList.add('hidden');
  }
});
