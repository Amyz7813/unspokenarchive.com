/* ============================================================
   UnspokenArchive — AI Content Generation
   Uses the Anthropic Messages API directly from the browser.

   IMPORTANT: Users must supply their own Anthropic API key.
   Keys are stored in localStorage under 'ua_api_key'.
   Never deploy a key in public source code.
   ============================================================ */

const AI = {
  endpoint: 'https://api.anthropic.com/v1/messages',
  model: 'claude-sonnet-4-20250514',

  getKey: () => localStorage.getItem('ua_api_key') || '',
  setKey: (k) => localStorage.setItem('ua_api_key', k.trim()),
  clearKey: () => localStorage.removeItem('ua_api_key'),

  async call(userPrompt, maxTokens = 2000) {
    const key = AI.getKey();
    if (!key) throw new Error('NO_KEY');

    const res = await fetch(AI.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: AI.model,
        max_tokens: maxTokens,
        system: 'You are a compassionate content writer for UnspokenArchive, a human-centered mental health story archive. All content must be emotionally authentic, respectful, and safe. Always return ONLY valid JSON — no markdown, no code fences, no preamble.',
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `API error ${res.status}`;
      throw new Error(msg);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    // Strip any accidental markdown fences
    return text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  },

  /* ---- Generate stories ---------------------------------------- */
  async generateStories(category, count = 3) {
    const prompt = `Generate ${count} anonymous first-person emotional stories for a mental health archive called UnspokenArchive.
Category: "${category}"

Requirements:
- Each story is 150–300 words, raw, honest, first-person
- Written as if by a real anonymous person sharing their experience
- No clinical language — these are personal narratives
- Some may reference professional help positively
- Trigger warnings: include only if the content involves suicide, self-harm, abuse, eating disorders, or substance use

Return ONLY a JSON array, e.g.:
[
  {
    "title": "Optional short evocative title",
    "content": "Full story text here...",
    "triggerWarnings": ["keyword if needed"]
  }
]`;

    const raw = await AI.call(prompt, 3000);
    const parsed = JSON.parse(raw);
    const now = new Date().toISOString();

    return parsed.map((s, i) => ({
      id: `ai_s_${Date.now()}_${i}`,
      title: s.title || '',
      content: s.content || '',
      category,
      readingTime: readingTime(s.content),
      createdAt: now,
      reactions: { heart: 0, hug: 0, meToo: 0, strength: 0 },
      triggerWarnings: Array.isArray(s.triggerWarnings) ? s.triggerWarnings : [],
      aiGenerated: true
    }));
  },

  /* ---- Generate advice tips ------------------------------------ */
  async generateTips(category, count = 3) {
    const prompt = `Generate ${count} practical advice tips for people struggling with "${category}".
These tips come from people with lived experience — not therapists. They should feel personal, real, and honest.

Return ONLY a JSON array:
[
  {
    "title": "Short memorable title (5 words max)",
    "content": "The actual tip, 60–120 words, first-person or direct",
    "contributor": "Brief anonymous descriptor e.g. '3 years sober', 'anxiety since age 15', 'widowed at 44'"
  }
]`;

    const raw = await AI.call(prompt, 2000);
    const parsed = JSON.parse(raw);
    const now = new Date().toISOString();

    return parsed.map((t, i) => ({
      id: `ai_t_${Date.now()}_${i}`,
      title: t.title || '',
      content: t.content || '',
      category,
      contributor: t.contributor || 'Anonymous',
      createdAt: now,
      aiGenerated: true
    }));
  },

  /* ---- Generate terminology entry ------------------------------ */
  async generateTerm(term) {
    const prompt = `Create a mental health terminology entry for the word or phrase: "${term}"

Heaviness levels:
- green: neutral, educational
- yellow: moderate emotional weight
- orange: heavy, significant distress
- red: extremely serious (suicide, self-harm, severe trauma)

Return ONLY a single JSON object:
{
  "term": "${term}",
  "definition": "Clear, compassionate definition in 2–3 sentences",
  "heaviness": "green|yellow|orange|red",
  "correctUsage": "One example of respectful, accurate usage",
  "incorrectUsage": "One example of harmful or trivialising misuse (with brief note why)"
}`;

    const raw = await AI.call(prompt, 800);
    return JSON.parse(raw);
  },

  /* ---- Shared UI helpers --------------------------------------- */
  hasKey: () => !!AI.getKey(),

  /* Render the API key prompt banner */
  keyBanner(onSave) {
    return `
      <div class="ai-key-banner bg-gold/5 border border-gold/20 rounded-2xl p-6 text-center space-y-4">
        <p class="text-sm text-white/50">To generate content with AI, enter your Anthropic API key. It is stored only in your browser.</p>
        <div class="flex gap-3 max-w-md mx-auto">
          <input type="password" id="ai-key-input" placeholder="sk-ant-api03-..." class="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-gold/50 text-white/80">
          <button id="ai-key-save" class="px-5 py-2 bg-gold text-black font-bold text-xs rounded-xl hover:opacity-90 transition-opacity uppercase tracking-widest">Save</button>
        </div>
        <p class="text-[11px] text-white/20">Your key is never sent to UnspokenArchive. It is used only to call api.anthropic.com directly from your browser.</p>
      </div>`;
  },

  bindKeyBanner(onSave) {
    const btn = document.getElementById('ai-key-save');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const val = document.getElementById('ai-key-input')?.value?.trim();
      if (!val) return;
      AI.setKey(val);
      if (typeof onSave === 'function') onSave();
    });
  },

  /* Wraps an async generate action with loading/error UI */
  async withUI(btnId, statusId, action) {
    const btn = document.getElementById(btnId);
    const status = document.getElementById(statusId);
    if (!btn || !status) return;
    btn.disabled = true;
    btn.textContent = 'Generating…';
    status.textContent = '';
    status.className = '';
    try {
      await action();
      status.textContent = 'Content added successfully.';
      status.className = 'text-xs text-green-400';
    } catch (err) {
      if (err.message === 'NO_KEY') {
        status.textContent = 'No API key set. Enter your key above.';
      } else if (err.message.includes('invalid_api_key') || err.message.includes('401')) {
        status.textContent = 'Invalid API key. Check your key and try again.';
        AI.clearKey();
      } else {
        status.textContent = `Error: ${err.message}`;
      }
      status.className = 'text-xs text-red-400';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate with AI';
    }
  }
};
