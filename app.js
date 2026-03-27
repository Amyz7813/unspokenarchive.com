/* ============================================================
   UnspokenArchive — Application Views
   All views render into #app-root via innerHTML.
   Events are bound with bindEvents() after each render
   using data-action attributes — no inline onclick handlers.
   ============================================================ */

const appRoot = document.getElementById('app-root');

/* ============================================================
   Shared component builders
   ============================================================ */

function buildTriggerWarnings(warnings) {
  if (!warnings || warnings.length === 0) return '';
  const badges = warnings.map(w => `<span class="tw-badge">⚠ ${escHtml(w)}</span>`).join('');
  return `<div class="flex flex-wrap gap-2 mb-4">${badges}</div>`;
}

function buildStoryCard(story, compact = false) {
  const tw = buildTriggerWarnings(story.triggerWarnings);
  const preview = story.content.length > 200
    ? story.content.slice(0, 200).trim() + '…'
    : story.content;

  return `
    <div class="story-card fade-in" data-action="open-story" data-id="${escHtml(story.id)}">
      <div class="flex justify-between items-start mb-5">
        <span class="cat-chip active" style="border-radius:4px;">${escHtml(story.category)}</span>
        <span class="font-sans text-[10px] text-white/25 uppercase tracking-widest">${story.readingTime || 1} min read</span>
      </div>
      ${tw}
      <h3 class="font-display text-xl italic mb-3 text-white/90 group-hover:text-gold transition-colors leading-snug">
        ${escHtml(story.title || 'Untitled')}
      </h3>
      <p class="text-white/50 italic text-sm leading-relaxed flex-grow mb-6">
        &ldquo;${escHtml(preview)}&rdquo;
      </p>
      <div class="flex justify-between items-center border-t border-white/5 pt-5 mt-auto">
        <div class="flex gap-4 font-sans text-white/30 text-xs">
          <span>❤ ${story.reactions?.heart ?? 0}</span>
          <span>🤗 ${story.reactions?.hug ?? 0}</span>
          <span>👥 ${story.reactions?.meToo ?? 0}</span>
        </div>
        <div class="flex gap-1">
          <button class="p-2 text-white/20 hover:text-gold transition-colors" data-action="share-twitter" data-title="${escHtml(story.title)}" data-id="${escHtml(story.id)}" title="Share on Twitter">
            <i data-lucide="twitter" class="w-3.5 h-3.5"></i>
          </button>
          <button class="p-2 text-white/20 hover:text-gold transition-colors" data-action="copy-link" data-id="${escHtml(story.id)}" title="Copy link">
            <i data-lucide="link" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    </div>`;
}

function buildReactionButton(icon, label, type, count, storyId) {
  return `
    <button class="reaction-btn" data-action="react" data-id="${escHtml(storyId)}" data-type="${type}">
      <div class="reaction-icon">${icon}</div>
      <span class="font-sans text-[10px] uppercase tracking-widest text-white/30">${label}</span>
      <span class="count">${count}</span>
    </button>`;
}

function buildCategoryChips(active, allCategories, actionName) {
  return ['All', ...allCategories].map(cat => `
    <button class="cat-chip ${cat === active ? 'active' : ''}" data-action="${actionName}" data-cat="${escHtml(cat)}">${escHtml(cat)}</button>
  `).join('');
}

/* ============================================================
   Event binding — attach after every innerHTML swap
   ============================================================ */

function bindEvents(root) {
  (root || appRoot).querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', handleAction);
  });
  /* Search inputs use 'input' event */
  const searchEl = (root || appRoot).querySelector('[data-search]');
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      const action = searchEl.dataset.search;
      if (action === 'archive') renderArchive(archiveState.cat, e.target.value);
      if (action === 'advice')  renderAdvice(adviceState.cat, e.target.value);
      if (action === 'terms')   renderTerminology(e.target.value);
    });
  }
}

function handleAction(e) {
  e.stopPropagation();
  const el = e.currentTarget;
  const { action, id, type, cat, title } = el.dataset;

  switch (action) {
    case 'open-story':
      window.location.hash = `#/story/${id}`;
      break;
    case 'react':
      addReaction(id, type);
      break;
    case 'share-twitter':
      shareOnTwitter(title, id);
      break;
    case 'share-facebook':
      shareOnFacebook(id);
      break;
    case 'copy-link':
      copyLink(id);
      break;
    case 'random-story': {
      const s = randomStory();
      if (s) window.location.hash = `#/story/${s.id}`;
      break;
    }
    case 'filter-archive':
      renderArchive(cat, '');
      break;
    case 'filter-advice':
      renderAdvice(cat, '');
      break;
    case 'generate-stories':
      runGenerateStories(cat);
      break;
    case 'generate-tips':
      runGenerateTips(cat);
      break;
    case 'generate-term':
      runGenerateTerm(el.dataset.term);
      break;
  }
}

/* ============================================================
   Sharing helpers
   ============================================================ */

function storyUrl(id) {
  return `${location.origin}${location.pathname}#/story/${id}`;
}

function shareOnTwitter(title, id) {
  const text = encodeURIComponent(`"${title || 'A story from UnspokenArchive'}" — Read it:`);
  const url  = encodeURIComponent(storyUrl(id));
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener');
}

function shareOnFacebook(id) {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storyUrl(id))}`, '_blank', 'noopener');
}

function copyLink(id) {
  navigator.clipboard?.writeText(storyUrl(id)).then(() => {
    showToast('Link copied.');
  }).catch(() => {
    /* Fallback for non-HTTPS or older browsers */
    const ta = document.createElement('textarea');
    ta.value = storyUrl(id);
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Link copied.');
  });
}

function showToast(msg) {
  const t = document.getElementById('ua-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('opacity-100');
  setTimeout(() => t.classList.remove('opacity-100'), 2400);
}

/* ============================================================
   Reactions — fixed (previously undefined)
   ============================================================ */

function addReaction(id, type) {
  const story = State.stories.find(s => s.id === id);
  if (!story) return;
  if (!story.reactions[type] && story.reactions[type] !== 0) return;
  story.reactions[type]++;
  State.save.stories();
  /* Re-render just the reaction section without full page reload */
  const counts = appRoot.querySelectorAll('.reaction-btn .count');
  const order = ['heart', 'hug', 'meToo', 'strength'];
  order.forEach((t, i) => {
    if (counts[i]) counts[i].textContent = story.reactions[t];
  });
}

/* ============================================================
   AI generation runners
   ============================================================ */

async function runGenerateStories(cat) {
  await AI.withUI('ai-gen-btn', 'ai-gen-status', async () => {
    const newStories = await AI.generateStories(cat || 'Recovery', 3);
    State.stories.unshift(...newStories);
    State.save.stories();
    renderArchive('All', '');
  });
}

async function runGenerateTips(cat) {
  await AI.withUI('ai-tip-btn', 'ai-tip-status', async () => {
    const newTips = await AI.generateTips(cat || 'Anxiety', 3);
    State.tips.push(...newTips);
    State.save.tips();
    renderAdvice(adviceState.cat, '');
  });
}

async function runGenerateTerm(term) {
  if (!term) return;
  const btn = document.getElementById(`gen-term-${term.replace(/\s/g,'_')}`);
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    const entry = await AI.generateTerm(term);
    const existing = State.terms.findIndex(t => t.term.toLowerCase() === term.toLowerCase());
    if (existing >= 0) State.terms[existing] = entry;
    else State.terms.push(entry);
    State.save.terms();
    renderTerminology('');
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Generate'; }
    showToast('AI error: ' + err.message);
  }
}

/* ============================================================
   Reading progress bar
   ============================================================ */

function attachReadingProgress() {
  const bar = document.getElementById('reading-progress');
  if (!bar) return;
  const handler = () => {
    const scrollTop = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = docH > 0 ? (scrollTop / docH * 100) + '%' : '0%';
  };
  window.addEventListener('scroll', handler, { passive: true });
  window._cleanupProgress = () => window.removeEventListener('scroll', handler);
}

/* ============================================================
   VIEW: Home
   ============================================================ */

const archiveState = { cat: 'All', search: '' };
const adviceState  = { cat: 'All' };

window.renderHome = function() {
  if (window._cleanupProgress) { window._cleanupProgress(); window._cleanupProgress = null; }

  const preview = State.stories
    .slice().sort(() => Math.random() - 0.5)
    .slice(0, 6);

  const previewCards = preview.map(s => buildStoryCard(s)).join('');

  appRoot.innerHTML = `
    <div id="reading-progress" style="display:none"></div>

    <!-- Hero -->
    <section class="pt-44 pb-20 px-6 text-center fade-in">
      <div class="space-y-8 max-w-4xl mx-auto">
        <h1 class="font-display text-7xl md:text-9xl italic leading-none tracking-tighter">
          Unspoken<br><span class="text-gold">Archive</span>
        </h1>
        <p id="hero-phrase" class="hero-phrase text-xl md:text-2xl text-white/40 max-w-xl mx-auto font-light italic leading-relaxed">
          Tell me.
        </p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
          <a href="#/archive" class="px-10 py-4 bg-gold text-black font-bold rounded-full hover:opacity-90 transition-opacity font-sans text-sm uppercase tracking-widest">Enter Archive</a>
          <a href="#/write" class="px-10 py-4 border border-white/10 rounded-full hover:bg-white/4 transition-colors font-sans text-sm uppercase tracking-widest text-white/60">Share a Story</a>
          <button class="px-10 py-4 border border-gold/20 rounded-full hover:bg-gold/5 transition-colors font-sans text-sm uppercase tracking-widest text-gold/60" data-action="random-story">Random Story</button>
        </div>
      </div>
    </section>

    <!-- Story preview grid -->
    <section class="px-6 pb-24 max-w-7xl mx-auto">
      <div class="flex items-center justify-between mb-10">
        <h2 class="font-display text-3xl italic text-white/70">Recent Voices</h2>
        <a href="#/archive" class="font-sans text-xs uppercase tracking-widest text-gold/60 hover:text-gold transition-colors">View all →</a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${previewCards}
      </div>
    </section>

    <!-- Community reminder -->
    <section class="px-6 py-20 border-t border-white/5">
      <div class="max-w-3xl mx-auto text-center space-y-8">
        <h2 class="font-display text-4xl italic text-white/80">Anonymity is the whole point.</h2>
        <ul class="space-y-3 text-white/40 font-sans text-sm">
          <li class="flex items-center justify-center gap-3"><i data-lucide="check" class="w-4 h-4 text-gold/60"></i> No accounts required to read</li>
          <li class="flex items-center justify-center gap-3"><i data-lucide="check" class="w-4 h-4 text-gold/60"></i> No names collected — ever</li>
          <li class="flex items-center justify-center gap-3"><i data-lucide="check" class="w-4 h-4 text-gold/60"></i> No tracking technologies or cookies</li>
          <li class="flex items-center justify-center gap-3"><i data-lucide="check" class="w-4 h-4 text-gold/60"></i> No data selling</li>
          <li class="flex items-center justify-center gap-3"><i data-lucide="check" class="w-4 h-4 text-gold/60"></i> No algorithms, no popularity ranking</li>
        </ul>
      </div>
    </section>

    <!-- CTA -->
    <section class="px-6 py-20 border-t border-white/5">
      <div class="max-w-2xl mx-auto text-center space-y-6">
        <p class="font-display text-3xl md:text-4xl italic text-white/60 leading-relaxed">
          &ldquo;Someone out there needs the story you survived.&rdquo;
        </p>
        <div class="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <a href="#/archive" class="px-8 py-4 border border-white/10 rounded-full hover:bg-white/4 transition-colors font-sans text-sm uppercase tracking-widest text-white/50">Read Stories</a>
          <a href="#/write" class="px-8 py-4 bg-gold text-black font-bold rounded-full hover:opacity-90 transition-opacity font-sans text-sm uppercase tracking-widest">Write a Story</a>
        </div>
      </div>
    </section>
  `;

  bindEvents();

  /* Hero phrase rotation */
  let phraseIdx = 0;
  const el = document.getElementById('hero-phrase');
  const interval = setInterval(() => {
    if (!el || !document.contains(el)) { clearInterval(interval); return; }
    el.classList.add('fading');
    setTimeout(() => {
      phraseIdx = (phraseIdx + 1) % HERO_PHRASES.length;
      el.textContent = HERO_PHRASES[phraseIdx];
      el.classList.remove('fading');
    }, 500);
  }, 5000);
  window._setHeroInterval(interval);
};

/* ============================================================
   VIEW: Archive
   ============================================================ */

window.renderArchive = function(cat = archiveState.cat, search = archiveState.search) {
  archiveState.cat = cat;
  archiveState.search = search;

  const query = (search || '').toLowerCase().trim();
  const filtered = State.stories.filter(s => {
    const matchesCat = cat === 'All' || s.category === cat;
    const matchesSearch = !query ||
      s.title?.toLowerCase().includes(query) ||
      s.content?.toLowerCase().includes(query) ||
      s.category?.toLowerCase().includes(query);
    return matchesCat && matchesSearch;
  });

  const chips = buildCategoryChips(cat, CATEGORIES, 'filter-archive');

  let storiesHtml;
  if (filtered.length === 0) {
    storiesHtml = `
      <div class="col-span-full py-24 text-center space-y-6 fade-in">
        <div class="w-16 h-16 bg-white/4 rounded-full flex items-center justify-center mx-auto">
          <i data-lucide="book-open" class="w-7 h-7 text-white/20"></i>
        </div>
        <h3 class="font-display text-3xl italic text-white/60">This page is still waiting for its story.</h3>
        <p class="text-white/30 max-w-md mx-auto font-sans text-sm leading-relaxed">
          We couldn't find anything matching those filters. Perhaps you're the one meant to write it.
        </p>
        <div class="flex gap-4 justify-center pt-4">
          <button class="px-6 py-3 border border-white/10 rounded-full text-xs uppercase tracking-widest font-sans text-white/40 hover:bg-white/4 transition-colors" data-action="filter-archive" data-cat="All">Clear filters</button>
          <a href="#/write" class="px-6 py-3 bg-gold text-black font-bold rounded-full text-xs uppercase tracking-widest font-sans hover:opacity-90 transition-opacity">Share your story</a>
        </div>
      </div>`;
  } else {
    storiesHtml = filtered.map(s => buildStoryCard(s)).join('');
  }

  appRoot.innerHTML = `
    <div class="pt-32 pb-24 px-6 max-w-7xl mx-auto fade-in">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div class="space-y-3">
          <h1 class="font-display text-5xl italic">The Archive</h1>
          <p class="text-white/35 max-w-xl font-sans text-sm leading-relaxed">
            A collective memory of human experience. ${State.stories.length} stories, shared anonymously.
          </p>
        </div>
        <button class="flex items-center gap-2 px-5 py-2.5 border border-gold/20 text-gold/60 rounded-full text-xs uppercase tracking-widest font-sans hover:bg-gold/5 transition-colors self-start md:self-auto" data-action="random-story">
          <i data-lucide="shuffle" class="w-3.5 h-3.5"></i> Random Story
        </button>
      </div>

      <!-- Search -->
      <div class="relative mb-8">
        <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none"></i>
        <input
          type="search"
          class="archive-search pl-11"
          placeholder="Search stories…"
          value="${escHtml(search)}"
          data-search="archive"
          aria-label="Search stories"
        >
      </div>

      <!-- Category filters -->
      <div class="flex flex-wrap gap-2 mb-10">
        ${chips}
      </div>

      <!-- Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${storiesHtml}
      </div>
    </div>
  `;

  bindEvents();
};

/* ============================================================
   VIEW: Story Detail
   ============================================================ */

window.renderStoryDetail = function(id) {
  if (window._cleanupProgress) { window._cleanupProgress(); window._cleanupProgress = null; }

  const story = State.stories.find(s => s.id === id);
  if (!story) {
    appRoot.innerHTML = `<div class="pt-48 text-center space-y-4"><p class="text-white/40">Story not found.</p><a href="#/archive" class="text-gold underline">Back to Archive</a></div>`;
    return;
  }

  const quote = randomItem(QUOTES);
  const tw = buildTriggerWarnings(story.triggerWarnings);

  appRoot.innerHTML = `
    <div id="reading-progress"></div>
    <div class="pt-32 pb-32 px-6 max-w-3xl mx-auto fade-in">

      <!-- Top bar -->
      <div class="flex justify-between items-center mb-12">
        <a href="#/archive" class="inline-flex items-center gap-2 text-white/35 hover:text-gold transition-colors font-sans text-sm group">
          <i data-lucide="arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition-transform"></i> Back
        </a>
        <div class="flex items-center gap-2">
          <span class="font-sans text-[10px] uppercase tracking-widest text-white/20 mr-2">Share</span>
          <button class="w-9 h-9 rounded-full bg-white/4 flex items-center justify-center hover:bg-gold hover:text-black transition-all text-white/30" data-action="share-twitter" data-title="${escHtml(story.title)}" data-id="${escHtml(story.id)}" title="Twitter">
            <i data-lucide="twitter" class="w-3.5 h-3.5"></i>
          </button>
          <button class="w-9 h-9 rounded-full bg-white/4 flex items-center justify-center hover:bg-gold hover:text-black transition-all text-white/30" data-action="share-facebook" data-id="${escHtml(story.id)}" title="Facebook">
            <i data-lucide="facebook" class="w-3.5 h-3.5"></i>
          </button>
          <button class="w-9 h-9 rounded-full bg-white/4 flex items-center justify-center hover:bg-gold hover:text-black transition-all text-white/30" data-action="copy-link" data-id="${escHtml(story.id)}" title="Copy link">
            <i data-lucide="link" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>

      <!-- Story -->
      <article class="space-y-14">
        <header class="space-y-6">
          <div class="flex items-center gap-4 flex-wrap">
            <span class="cat-chip active" style="border-radius:4px;">${escHtml(story.category)}</span>
            <span class="font-sans text-[10px] uppercase tracking-widest text-white/25">${story.readingTime || 1} min read</span>
          </div>
          ${tw}
          <h1 class="font-display text-5xl md:text-6xl lg:text-7xl italic leading-tight text-white/90">
            ${escHtml(story.title || 'Untitled')}
          </h1>
          <p class="font-sans text-xs uppercase tracking-widest text-white/20">
            Archive entry · ${formatDate(story.createdAt)}
          </p>
        </header>

        <!-- Content -->
        <div class="relative">
          <div class="absolute -left-8 top-0 font-display text-7xl text-gold/8 select-none pointer-events-none leading-none">&ldquo;</div>
          <p class="font-serif text-xl md:text-2xl leading-relaxed text-white/75 italic drop-cap story-content">
            ${escHtml(story.content)}
          </p>
          <div class="absolute -right-4 bottom-0 font-display text-7xl text-gold/8 select-none pointer-events-none leading-none">&rdquo;</div>
        </div>

        <!-- Reactions -->
        <div class="pt-12 border-t border-white/5">
          <p class="font-sans text-[10px] uppercase tracking-widest text-white/20 text-center mb-8">Respond to this story</p>
          <div class="flex justify-center gap-6 md:gap-10 flex-wrap">
            ${buildReactionButton('❤️', 'Empathy',   'heart',    story.reactions.heart,    story.id)}
            ${buildReactionButton('🤗', 'Support',   'hug',      story.reactions.hug,      story.id)}
            ${buildReactionButton('👥', 'Me Too',    'meToo',    story.reactions.meToo,    story.id)}
            ${buildReactionButton('🌙', 'Strength',  'strength', story.reactions.strength, story.id)}
          </div>
        </div>

        <!-- Moment of Reflection -->
        <div class="pt-12 border-t border-white/5 space-y-5">
          <div class="text-center space-y-2">
            <p class="font-sans text-[10px] uppercase tracking-widest text-white/20">A moment of reflection</p>
            <p class="font-display text-xl italic text-white/40" id="reflection-prompt">
              What part of this story resonated with you most?
            </p>
          </div>
          <textarea
            class="reflection-textarea"
            placeholder="This space is just for you. Nothing you write here is saved or shared."
            aria-label="Private reflection space"
            rows="4"
          ></textarea>
          <p class="font-sans text-[10px] text-white/15 text-center">Private · Not saved · Not shared</p>
        </div>

        <!-- Closing quote -->
        <div class="pt-16 text-center space-y-4">
          <div class="w-10 h-px bg-gold/20 mx-auto"></div>
          <p class="font-display text-2xl md:text-3xl italic text-white/20 leading-relaxed max-w-lg mx-auto">
            &ldquo;${escHtml(quote)}&rdquo;
          </p>
        </div>
      </article>
    </div>
  `;

  bindEvents();
  attachReadingProgress();

  /* Rotate reflection prompts */
  const prompts = [
    "What part of this story resonated with you most?",
    "What feeling does this story evoke in you?",
    "What would you want the author of this story to know?",
    "Has anything in your own life felt like this?"
  ];
  const promptEl = document.getElementById('reflection-prompt');
  if (promptEl) promptEl.textContent = randomItem(prompts);
};

/* ============================================================
   VIEW: Write
   ============================================================ */

window.renderWrite = function() {
  const catOptions = CATEGORIES.map(c =>
    `<option value="${escHtml(c)}">${escHtml(c)}</option>`
  ).join('');

  appRoot.innerHTML = `
    <div class="pt-32 pb-24 px-6 max-w-2xl mx-auto fade-in">
      <div class="text-center mb-14 space-y-4">
        <h1 class="font-display text-5xl italic">Share Your Truth</h1>
        <p class="text-white/35 font-sans text-sm leading-relaxed max-w-md mx-auto">
          Your story will be archived anonymously. Do not include names, addresses, or identifying information.
        </p>
      </div>

      <!-- Privacy reminder -->
      <div class="bg-white/2 border border-white/6 rounded-2xl p-5 mb-8 font-sans text-xs text-white/35 space-y-1.5">
        <p class="font-bold uppercase tracking-widest text-white/20 mb-3">Before you write</p>
        <p>· Stories are anonymous — do not include your real name.</p>
        <p>· No images of any kind. Contact <a href="mailto:helparchive@unspokenarchive.org" class="text-gold/60 hover:text-gold">helparchive@unspokenarchive.org</a> for image requests.</p>
        <p>· Please respect the Terms &amp; Standards of this community.</p>
      </div>

      <div class="bg-surface border border-white/6 rounded-3xl p-8 md:p-10 space-y-7">
        <form id="story-form" novalidate class="space-y-7">
          <div class="space-y-2">
            <label class="font-sans text-[10px] uppercase tracking-widest text-white/25 font-bold">Title <span class="normal-case">(optional)</span></label>
            <input id="f-title" type="text" class="story-input" placeholder="Give your story a name…" maxlength="120">
          </div>

          <div class="space-y-2">
            <label class="font-sans text-[10px] uppercase tracking-widest text-white/25 font-bold">Your Story <span class="text-red-400">*</span></label>
            <textarea id="f-content" class="story-textarea" placeholder="What have you been carrying?" aria-required="true"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-5">
            <div class="space-y-2">
              <label class="font-sans text-[10px] uppercase tracking-widest text-white/25 font-bold">Category</label>
              <select id="f-category" class="story-input appearance-none cursor-pointer">
                <option value="">— choose —</option>
                ${catOptions}
              </select>
            </div>
            <div class="space-y-2">
              <label class="font-sans text-[10px] uppercase tracking-widest text-white/25 font-bold">Trigger Warnings <span class="normal-case">(optional)</span></label>
              <input id="f-tw" type="text" class="story-input" placeholder="e.g. self-harm, grief" title="Separate multiple warnings with commas">
            </div>
          </div>

          <p id="form-error" class="hidden font-sans text-xs text-red-400"></p>

          <button type="submit" class="w-full py-5 bg-gold text-black font-bold rounded-2xl hover:opacity-90 transition-opacity font-sans text-sm uppercase tracking-widest shadow-xl shadow-gold/10">
            Archive Story
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('story-form').addEventListener('submit', e => {
    e.preventDefault();
    const errEl = document.getElementById('form-error');
    const content = document.getElementById('f-content').value.trim();
    if (!content) {
      errEl.textContent = 'Please write your story before archiving it.';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');

    const title = document.getElementById('f-title').value.trim();
    const category = document.getElementById('f-category').value || 'Recovery';
    const twRaw = document.getElementById('f-tw').value;
    const triggerWarnings = twRaw.split(',').map(t => t.trim()).filter(Boolean);

    const newStory = {
      id: `user_${Date.now()}`,
      title: title || 'Untitled',
      content,
      category,
      readingTime: readingTime(content),
      createdAt: new Date().toISOString(),
      reactions: { heart: 0, hug: 0, meToo: 0, strength: 0 },
      triggerWarnings
    };

    State.stories.unshift(newStory);
    State.save.stories();
    showToast('Story archived.');
    window.location.hash = '#/story/' + newStory.id;
  });

  bindEvents();
};

/* ============================================================
   VIEW: Advice Library
   ============================================================ */

window.renderAdvice = function(cat = adviceState.cat, search = '') {
  adviceState.cat = cat;

  const query = (search || '').toLowerCase();
  const filtered = State.tips.filter(t => {
    const matchesCat = cat === 'All' || t.category === cat;
    const matchesSearch = !query ||
      t.title?.toLowerCase().includes(query) ||
      t.content?.toLowerCase().includes(query);
    return matchesCat && matchesSearch;
  });

  const chips = buildCategoryChips(cat, ADVICE_CATEGORIES, 'filter-advice');

  const tipsHtml = filtered.length === 0 ? `
    <div class="col-span-full py-20 text-center space-y-4">
      <p class="font-display text-2xl italic text-white/30">No tips in this category yet.</p>
      <a href="#/write" class="inline-block mt-4 px-6 py-3 bg-gold text-black font-bold rounded-full text-xs uppercase tracking-widest font-sans">Share Your Experience</a>
    </div>` :
  filtered.map(tip => `
    <div class="bg-surface border border-white/6 rounded-2xl p-7 space-y-4 fade-in">
      <div class="flex items-start justify-between gap-4">
        <span class="cat-chip">${escHtml(tip.category)}</span>
      </div>
      <h3 class="font-display text-xl italic text-white/85">${escHtml(tip.title)}</h3>
      <p class="text-white/55 text-sm leading-relaxed">${escHtml(tip.content)}</p>
      <p class="font-sans text-[11px] text-white/25 italic border-t border-white/5 pt-4">
        — ${escHtml(tip.contributor || 'Anonymous')}
      </p>
    </div>
  `).join('');

  const hasKey = AI.hasKey();

  appRoot.innerHTML = `
    <div class="pt-32 pb-24 px-6 max-w-6xl mx-auto fade-in">
      <div class="mb-14 space-y-3">
        <h1 class="font-display text-5xl italic">How Do I Continue?</h1>
        <p class="text-white/35 font-sans text-sm max-w-xl leading-relaxed">
          Practical advice from people who have lived it. Not therapists — people.
        </p>
      </div>

      <!-- AI panel -->
      <div class="mb-10 p-6 bg-white/2 border border-white/6 rounded-2xl space-y-4">
        <p class="font-sans text-[10px] uppercase tracking-widest text-white/20">Generate with AI</p>
        ${hasKey ? `
          <div class="flex flex-wrap items-center gap-3">
            <select id="ai-tip-cat" class="story-input max-w-xs py-2">
              ${ADVICE_CATEGORIES.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
            </select>
            <button id="ai-tip-btn" class="px-5 py-2 bg-gold text-black font-bold rounded-xl text-xs uppercase tracking-widest font-sans hover:opacity-90 transition-opacity" data-action="generate-tips">Generate with AI</button>
            <button class="text-xs text-white/20 hover:text-red-400 transition-colors font-sans" id="clear-ai-key">Remove key</button>
          </div>
          <p id="ai-tip-status" class="font-sans text-xs"></p>
        ` : AI.keyBanner(() => renderAdvice(adviceState.cat, ''))}
      </div>

      <!-- Search -->
      <div class="relative mb-7">
        <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none"></i>
        <input type="search" class="archive-search pl-11" placeholder="Search advice…" value="${escHtml(search)}" data-search="advice" aria-label="Search advice">
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-2 mb-10">${chips}</div>

      <!-- Tips grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${tipsHtml}</div>
    </div>
  `;

  bindEvents();
  if (hasKey) {
    AI.bindKeyBanner(null);
    /* Wire up generate button manually */
    const genBtn = document.getElementById('ai-tip-btn');
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        const cat = document.getElementById('ai-tip-cat')?.value || 'Anxiety';
        adviceState.cat = cat;
        runGenerateTips(cat);
      });
    }
    const clearBtn = document.getElementById('clear-ai-key');
    if (clearBtn) clearBtn.addEventListener('click', () => { AI.clearKey(); renderAdvice(adviceState.cat, ''); });
  } else {
    AI.bindKeyBanner(() => renderAdvice(adviceState.cat, ''));
  }
};

/* ============================================================
   VIEW: Terminology Guide
   ============================================================ */

window.renderTerminology = function(search = '') {
  const query = (search || '').toLowerCase();
  const filtered = State.terms.filter(t =>
    !query || t.term?.toLowerCase().includes(query) || t.definition?.toLowerCase().includes(query)
  );

  const hwLabel = { green: 'Neutral', yellow: 'Moderate', orange: 'Heavy', red: 'Serious' };
  const hwClass = { green: 'hw-green', yellow: 'hw-yellow', orange: 'hw-orange', red: 'hw-red' };
  const dotClass = { green: 'hw-dot-green', yellow: 'hw-dot-yellow', orange: 'hw-dot-orange', red: 'hw-dot-red' };

  const termsHtml = filtered.length === 0 ?
    `<p class="col-span-full text-center text-white/30 font-display text-2xl italic py-16">No terms found.</p>` :
    filtered.map(t => `
      <div class="bg-surface border border-white/6 rounded-2xl p-7 space-y-4 fade-in">
        <div class="flex items-start justify-between gap-3">
          <h3 class="font-display text-2xl italic text-white/90">${escHtml(t.term)}</h3>
          <span class="inline-flex items-center px-3 py-1 rounded-full border text-[10px] font-bold font-sans uppercase tracking-widest flex-shrink-0 ${hwClass[t.heaviness] || 'hw-yellow'}">
            <span class="hw-dot ${dotClass[t.heaviness] || 'hw-dot-yellow'}"></span>
            ${hwLabel[t.heaviness] || 'Moderate'}
          </span>
        </div>
        <p class="text-white/60 text-sm leading-relaxed">${escHtml(t.definition)}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-4">
          <div>
            <p class="font-sans text-[10px] uppercase tracking-widest text-green-400/60 font-bold mb-1.5">✓ Correct usage</p>
            <p class="text-white/40 text-xs italic leading-relaxed">${escHtml(t.correctUsage)}</p>
          </div>
          <div>
            <p class="font-sans text-[10px] uppercase tracking-widest text-red-400/60 font-bold mb-1.5">✗ Avoid</p>
            <p class="text-white/40 text-xs italic leading-relaxed">${escHtml(t.incorrectUsage)}</p>
          </div>
        </div>
      </div>
    `).join('');

  const hasKey = AI.hasKey();

  /* Suggest terms not yet in the guide */
  const SUGGESTED = ['Self-compassion','Psychosis','Mania','Boundary','Attachment','Grief','Resilience','Validation','Shame','Avoidance'];
  const existing = new Set(State.terms.map(t => t.term.toLowerCase()));
  const suggestions = SUGGESTED.filter(s => !existing.has(s.toLowerCase()));

  appRoot.innerHTML = `
    <div class="pt-32 pb-24 px-6 max-w-6xl mx-auto fade-in">
      <div class="mb-14 space-y-3">
        <h1 class="font-display text-5xl italic">Mental Health Terminology</h1>
        <p class="text-white/35 font-sans text-sm max-w-xl leading-relaxed">
          An A–Z guide to mental health language. Understanding words protects people.
        </p>
      </div>

      <!-- Heaviness legend -->
      <div class="flex flex-wrap gap-3 mb-10">
        <span class="inline-flex items-center px-3 py-1 rounded-full border hw-green text-[10px] font-bold font-sans uppercase tracking-widest"><span class="hw-dot hw-dot-green"></span>Neutral</span>
        <span class="inline-flex items-center px-3 py-1 rounded-full border hw-yellow text-[10px] font-bold font-sans uppercase tracking-widest"><span class="hw-dot hw-dot-yellow"></span>Moderate</span>
        <span class="inline-flex items-center px-3 py-1 rounded-full border hw-orange text-[10px] font-bold font-sans uppercase tracking-widest"><span class="hw-dot hw-dot-orange"></span>Heavy</span>
        <span class="inline-flex items-center px-3 py-1 rounded-full border hw-red text-[10px] font-bold font-sans uppercase tracking-widest"><span class="hw-dot hw-dot-red"></span>Serious</span>
      </div>

      <!-- AI panel -->
      ${suggestions.length > 0 ? `
      <div class="mb-10 p-6 bg-white/2 border border-white/6 rounded-2xl space-y-4">
        <p class="font-sans text-[10px] uppercase tracking-widest text-white/20">Generate missing entries with AI</p>
        ${hasKey ? `
          <div class="flex flex-wrap gap-2">
            ${suggestions.slice(0,8).map(s => `
              <button class="cat-chip" data-action="generate-term" data-term="${escHtml(s)}" id="gen-term-${s.replace(/\s/g,'_')}">${escHtml(s)}</button>
            `).join('')}
          </div>
          <p class="font-sans text-xs text-white/20">Click a term to generate its entry with Claude.</p>
          <button class="text-xs text-white/20 hover:text-red-400 transition-colors font-sans" id="clear-ai-key-t">Remove API key</button>
        ` : AI.keyBanner(() => renderTerminology(search))}
      </div>` : ''}

      <!-- Search -->
      <div class="relative mb-10">
        <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none"></i>
        <input type="search" class="archive-search pl-11" placeholder="Search terms…" value="${escHtml(search)}" data-search="terms" aria-label="Search terminology">
      </div>

      <!-- Terms grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${termsHtml}</div>
    </div>
  `;

  bindEvents();
  const clearT = document.getElementById('clear-ai-key-t');
  if (clearT) clearT.addEventListener('click', () => { AI.clearKey(); renderTerminology(search); });
  if (!hasKey) AI.bindKeyBanner(() => renderTerminology(search));
};

/* ============================================================
   VIEW: Crisis Support
   ============================================================ */

window.renderCrisis = function() {
  const rows = CRISIS_RESOURCES.map(r => `
    <div class="bg-surface border border-white/6 rounded-2xl p-6 space-y-4 fade-in">
      <h3 class="font-display text-xl italic text-white/80">${escHtml(r.country)}</h3>
      ${r.lines.map(l => `
        <div class="border-t border-white/5 pt-3">
          <p class="font-sans font-bold text-sm text-white/70">${escHtml(l.name)}</p>
          <p class="text-gold font-sans font-bold text-lg mt-0.5">${escHtml(l.contact)}</p>
          <p class="font-sans text-xs text-white/30 mt-0.5">${escHtml(l.note)}</p>
        </div>
      `).join('')}
    </div>
  `).join('');

  const intl = CRISIS_INTERNATIONAL.map(o => `
    <a href="${escHtml(o.url)}" target="_blank" rel="noopener" class="block bg-surface border border-gold/10 rounded-xl px-5 py-4 hover:border-gold/30 transition-colors">
      <p class="font-sans text-sm text-white/60 hover:text-white/85 transition-colors">${escHtml(o.name)}</p>
      <p class="font-sans text-xs text-gold/40 mt-1 truncate">${escHtml(o.url)}</p>
    </a>
  `).join('');

  appRoot.innerHTML = `
    <div class="pt-32 pb-24 px-6 max-w-6xl mx-auto fade-in">
      <div class="mb-14 space-y-4">
        <div class="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full">
          <i data-lucide="heart-pulse" class="w-4 h-4 text-red-400"></i>
          <span class="font-sans text-xs text-red-400 uppercase tracking-widest font-bold">Crisis Resources</span>
        </div>
        <h1 class="font-display text-5xl italic">If you need help right now</h1>
        <p class="text-white/40 font-sans text-sm max-w-xl leading-relaxed">
          You are not alone. These lines are staffed by people who want to listen.
          If you are in immediate danger, please call your local emergency services.
        </p>
      </div>

      <!-- Country resources -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
        ${rows}
      </div>

      <!-- International -->
      <div class="border-t border-white/5 pt-12 space-y-5">
        <h2 class="font-display text-2xl italic text-white/50">International Organisations</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          ${intl}
        </div>
      </div>
    </div>
  `;

  bindEvents();
};

/* ============================================================
   VIEW: Terms & Conditions
   ============================================================ */

window.renderTerms = function() {
  appRoot.innerHTML = `
    <div class="pt-32 pb-24 px-6 max-w-2xl mx-auto fade-in">
      <h1 class="font-display text-5xl italic mb-12">Terms &amp; Standards</h1>

      <div class="space-y-12 text-white/55 leading-relaxed font-sans text-sm">

        <section class="space-y-3">
          <h2 class="font-display text-2xl italic text-white/80">Our promise to you</h2>
          <p>UnspokenArchive is a quiet space, not a platform. We do not use engagement algorithms, popularity rankings, or tracking technologies of any kind. We do not use cookies. We do not sell data. Browsing is anonymous by default.</p>
        </section>

        <section class="space-y-3">
          <h2 class="font-display text-2xl italic text-white/80">Respectful communication</h2>
          <p>Every person who contributes to this archive deserves to be treated with dignity. When participating, you agree to speak respectfully, avoid language designed to harm, and honour the courage it takes to share a difficult experience.</p>
        </section>

        <section class="space-y-3">
          <h2 class="font-display text-2xl italic text-white/80">Prohibited content</h2>
          <p>The following are not permitted under any circumstances:</p>
          <ul class="space-y-2 ml-4 border-l border-white/8 pl-5">
            <li>Hate speech, discrimination, or dehumanising language of any kind</li>
            <li>Harassment, bullying, or targeted personal attacks</li>
            <li>Content that encourages, glorifies, or provides instruction for self-harm or suicide</li>
            <li>Content that sexualises or targets minors</li>
            <li>Spam, advertising, or promotional material</li>
            <li>Personal information of any other individual without their explicit consent</li>
          </ul>
        </section>

        <section class="space-y-3">
          <h2 class="font-display text-2xl italic text-white/80">Image policy</h2>
          <p>Images of any kind are not permitted in user submissions. This is a text archive. If you believe an image is necessary for your submission, please contact <a href="mailto:helparchive@unspokenarchive.org" class="text-gold/70 hover:text-gold transition-colors">helparchive@unspokenarchive.org</a> for review. All image requests are reviewed manually.</p>
        </section>

        <section class="space-y-3">
          <h2 class="font-display text-2xl italic text-white/80">Anonymity and privacy</h2>
          <p>When you submit a story, do not include your real name, location, or any identifying details about other people. While your submission is anonymous to other users, please treat this space as if anything you write could be read by anyone. Do not include information that could put you or someone else at risk.</p>
        </section>

        <section class="space-y-3">
          <h2 class="font-display text-2xl italic text-white/80">Moderation</h2>
          <p>Content that violates these standards may be removed without notice. Repeated violations may result in removal of all content associated with a submission. We do this not to silence, but to protect the safety of this space for everyone who needs it.</p>
        </section>

        <section class="space-y-3">
          <h2 class="font-display text-2xl italic text-white/80">Mental health language</h2>
          <p>We ask all contributors to use mental health terminology carefully and respectfully. Please consult our <a href="#/terminology" class="text-gold/70 hover:text-gold transition-colors">Terminology Guide</a> if you are unsure how to discuss a topic without causing harm.</p>
        </section>

        <section class="space-y-3">
          <h2 class="font-display text-2xl italic text-white/80">Contact</h2>
          <p>For questions, content concerns, or image requests:<br>
          <a href="mailto:helparchive@unspokenarchive.org" class="text-gold/70 hover:text-gold transition-colors">helparchive@unspokenarchive.org</a></p>
        </section>

      </div>
    </div>
  `;
  bindEvents();
};
