/* =============================================
   CINEVAULT — script.js
   OMDB API powered movie discovery app
   ============================================= */

const API_KEY = '7f81cc77'; // free OMDB API key — replace with your own at https://www.omdbapi.com/apikey.aspx
const BASE_URL = 'https://www.omdbapi.com/';

/* ── STATE ── */
let state = {
  query: '',
  page: 1,
  totalResults: 0,
  movies: [],
  watchlist: JSON.parse(localStorage.getItem('cinevault_wl') || '[]'),
  activeTab: 'search',
  viewMode: 'grid',
  filters: { genre: '', year: '', language: '', rating: '', sort: '' },
  popularMovies: [],
  lastSearch: '',
  isLoading: false,
};

/* ── POPULAR MOVIE TITLES (for the strip) ── */
const POPULAR_TITLES = [
  'Avengers Endgame', 'Inception', 'Interstellar', 'The Dark Knight',
  'Dune', 'Spider-Man No Way Home', 'Top Gun Maverick', 'Oppenheimer',
  'Parasite', 'Joker', 'The Batman', 'Avatar', 'Everything Everywhere',
  'Barbie', 'Mission Impossible', 'John Wick', 'Mad Max Fury Road',
  'Blade Runner 2049', 'The Revenant', '1917'
];

/* ── DOM REFS ── */
const $  = id => document.getElementById(id);
const searchInput       = $('searchInput');
const suggestionsDD     = $('suggestionsDropdown');
const moviesGrid        = $('moviesGrid');
const skeletonGrid      = $('skeletonGrid');
const loadMoreWrapper   = $('loadMoreWrapper');
const loadMoreBtn       = $('loadMoreBtn');
const emptyState        = $('emptyState');
const watchlistEmpty    = $('watchlistEmpty');
const errorState        = $('errorState');
const statusText        = $('statusText');
const resultCount       = $('resultCount');
const filterGenre       = $('filterGenre');
const filterYear        = $('filterYear');
const filterLanguage    = $('filterLanguage');
const filterRating      = $('filterRating');
const filterSort        = $('filterSort');
const filterClear       = $('filterClear');
const filterChips       = $('filterChips');
const modalOverlay      = $('modalOverlay');
const modalClose        = $('modalClose');
const modalInner        = $('modalInner');
const themeToggle       = $('themeToggle');
const wlBadge           = $('wlBadge');
const wlBadgeTab        = $('wlBadgeTab');
const watchlistNavBtn   = $('watchlistNavBtn');
const tabSearch         = $('tabSearch');
const tabWatchlist      = $('tabWatchlist');
const viewGrid          = $('viewGrid');
const viewList          = $('viewList');
const scrollTopBtn      = $('scrollTop');
const popularStrip      = $('popularStrip');
const stripLeft         = $('stripLeft');
const stripRight        = $('stripRight');
const cursorSpotlight   = $('cursorSpotlight');

/* ── TYPEWRITER ── */
const typewriterEl = $('typewriterEl');
const typewriterWords = ['Tells a Story.', 'Matters.', 'Is Cinema.', 'Lives Here.', 'Inspires.'];
let twIndex = 0, twChar = 0, twDeleting = false;
function typewriterTick() {
  const word = typewriterWords[twIndex];
  if (!twDeleting) {
    typewriterEl.textContent = word.slice(0, ++twChar);
    if (twChar === word.length) { twDeleting = true; setTimeout(typewriterTick, 1600); return; }
  } else {
    typewriterEl.textContent = word.slice(0, --twChar);
    if (twChar === 0) { twDeleting = false; twIndex = (twIndex + 1) % typewriterWords.length; }
  }
  setTimeout(typewriterTick, twDeleting ? 55 : 100);
}
typewriterTick();

/* ── CURSOR SPOTLIGHT ── */
document.addEventListener('mousemove', e => {
  cursorSpotlight.style.left = e.clientX + 'px';
  cursorSpotlight.style.top  = e.clientY + 'px';
});

/* ── SCROLL TO TOP ── */
window.addEventListener('scroll', () => {
  scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
});
scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ── THEME ── */
const savedTheme = localStorage.getItem('cinevault_theme') || 'dark';
if (savedTheme === 'light') applyLight();
function applyLight() {
  document.body.classList.remove('dark');
  document.body.classList.add('light');
  themeToggle.querySelector('.theme-icon').textContent = '🌙';
}
function applyDark() {
  document.body.classList.remove('light');
  document.body.classList.add('dark');
  themeToggle.querySelector('.theme-icon').textContent = '☀️';
}
themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.contains('light');
  isLight ? applyDark() : applyLight();
  localStorage.setItem('cinevault_theme', isLight ? 'dark' : 'light');
});

/* ── API ── */
async function fetchMovies(query, page = 1) {
  const url = `${BASE_URL}?apikey=${API_KEY}&s=${encodeURIComponent(query)}&page=${page}&type=movie`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

async function fetchMovieDetail(imdbID) {
  const url = `${BASE_URL}?apikey=${API_KEY}&i=${imdbID}&plot=full`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

/* ── SEARCH ── */
let debounceTimer;
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearTimeout(debounceTimer);
  if (q.length < 2) { closeSuggestions(); return; }
  debounceTimer = setTimeout(() => fetchSuggestions(q), 300);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = searchInput.value.trim();
    if (q) { closeSuggestions(); doSearch(q); }
  }
  if (e.key === 'Escape') closeSuggestions();
});

/* Trending tags */
document.querySelectorAll('.tag').forEach(tag => {
  tag.addEventListener('click', () => {
    searchInput.value = tag.dataset.query;
    doSearch(tag.dataset.query);
  });
});

async function fetchSuggestions(q) {
  try {
    const data = await fetchMovies(q, 1);
    if (data.Response === 'True') renderSuggestions(data.Search.slice(0, 6));
    else closeSuggestions();
  } catch { closeSuggestions(); }
}

function renderSuggestions(movies) {
  suggestionsDD.innerHTML = movies.map(m => `
    <div class="suggestion-item" data-id="${m.imdbID}" data-title="${m.Title}">
      <img class="suggestion-poster" src="${m.Poster !== 'N/A' ? m.Poster : ''}" 
           onerror="this.style.display='none'" alt="${m.Title}">
      <div class="suggestion-info">
        <div class="suggestion-title">${m.Title}</div>
        <div class="suggestion-year">${m.Year}</div>
      </div>
      <span class="suggestion-icon">›</span>
    </div>
  `).join('');
  suggestionsDD.classList.add('open');

  suggestionsDD.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      searchInput.value = item.dataset.title;
      closeSuggestions();
      doSearch(item.dataset.title);
    });
  });
}

function closeSuggestions() {
  suggestionsDD.classList.remove('open');
  suggestionsDD.innerHTML = '';
}

document.addEventListener('click', e => {
  if (!e.target.closest('#searchWrapper')) closeSuggestions();
});

async function doSearch(query, append = false) {
  if (state.isLoading) return;
  state.isLoading = true;
  state.query = query;

  if (!append) {
    state.page = 1;
    state.movies = [];
    state.lastSearch = query;
    showSkeleton(8);
    hideAll();
  } else {
    loadMoreBtn.textContent = 'Loading…';
    loadMoreBtn.disabled = true;
  }

  switchTab('search');

  try {
    const data = await fetchMovies(query, state.page);
    if (data.Response === 'True') {
      state.totalResults = parseInt(data.totalResults, 10);
      const filtered = applyFilters(data.Search);
      const sorted = applySort(filtered);
      state.movies = append ? [...state.movies, ...sorted] : sorted;
      hideSkeleton();
      renderMovies(state.movies, !append);
      updateStatus();
      updateLoadMore();
      if (!append && !state.skipScroll) {
        document.querySelector('.main-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      state.skipScroll = false;
    } else {
      hideSkeleton();
      if (!append) showEmpty();
      statusText.textContent = '🎭 No results found';
      resultCount.textContent = '';
      loadMoreWrapper.style.display = 'none';
    }
  } catch (err) {
    hideSkeleton();
    showError('Connection Error', 'Could not reach the movie database. Check your internet connection.');
  } finally {
    state.isLoading = false;
    loadMoreBtn.textContent = 'Load More';
    loadMoreBtn.disabled = false;
  }
}

/* ── FILTERS ── */
function applyFilters(movies) {
  return movies.filter(m => {
    if (state.filters.year) {
      const yr = parseInt(m.Year);
      if (state.filters.year === '2020s' && yr < 2020) return false;
      if (state.filters.year === '2010s' && (yr < 2010 || yr >= 2020)) return false;
      if (state.filters.year === '2000s' && (yr < 2000 || yr >= 2010)) return false;
      if (state.filters.year === '1990s' && (yr < 1990 || yr >= 2000)) return false;
      if (state.filters.year === 'older' && yr >= 1990) return false;
    }
    return true;
  });
}

function applySort(movies) {
  const s = state.filters.sort;
  if (!s) return movies;
  const arr = [...movies];
  if (s === 'year_desc') return arr.sort((a, b) => parseInt(b.Year) - parseInt(a.Year));
  if (s === 'year_asc')  return arr.sort((a, b) => parseInt(a.Year) - parseInt(b.Year));
  if (s === 'title_asc') return arr.sort((a, b) => a.Title.localeCompare(b.Title));
  if (s === 'title_desc') return arr.sort((a, b) => b.Title.localeCompare(a.Title));
  return arr;
}

[filterGenre, filterYear, filterLanguage, filterRating, filterSort].forEach(sel => {
  sel.addEventListener('change', () => {
    state.filters.genre    = filterGenre.value;
    state.filters.year     = filterYear.value;
    state.filters.language = filterLanguage.value;
    state.filters.rating   = filterRating.value;
    state.filters.sort     = filterSort.value;
    renderFilterChips();
    if (state.lastSearch) doSearch(state.lastSearch);
  });
});

filterClear.addEventListener('click', () => {
  filterGenre.value = filterYear.value = filterLanguage.value = filterRating.value = filterSort.value = '';
  state.filters = { genre: '', year: '', language: '', rating: '', sort: '' };
  filterChips.innerHTML = '';
  if (state.lastSearch) doSearch(state.lastSearch);
});

function renderFilterChips() {
  const labels = {
    genre: filterGenre.options[filterGenre.selectedIndex]?.text,
    year:  filterYear.options[filterYear.selectedIndex]?.text,
    language: filterLanguage.options[filterLanguage.selectedIndex]?.text,
    rating: filterRating.options[filterRating.selectedIndex]?.text,
    sort:  filterSort.options[filterSort.selectedIndex]?.text,
  };
  filterChips.innerHTML = Object.entries(state.filters)
    .filter(([, v]) => v)
    .map(([k, v]) => `
      <span class="filter-chip">
        ${labels[k]}
        <button class="chip-remove" data-key="${k}">✕</button>
      </span>
    `).join('');

  filterChips.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      state.filters[key] = '';
      const selMap = { genre: filterGenre, year: filterYear, language: filterLanguage, rating: filterRating, sort: filterSort };
      selMap[key].value = '';
      renderFilterChips();
      if (state.lastSearch) doSearch(state.lastSearch);
    });
  });
}

/* ── RENDER MOVIE CARDS ── */
function renderMovies(movies, replace = true) {
  if (replace) moviesGrid.innerHTML = '';
  if (!movies.length) { showEmpty(); return; }

  hideAll();
  moviesGrid.style.display = state.viewMode === 'grid' ? 'grid' : 'grid';
  if (state.viewMode === 'list') moviesGrid.classList.add('list-view');
  else moviesGrid.classList.remove('list-view');

  movies.forEach((m, i) => {
    const inWL = state.watchlist.some(w => w.imdbID === m.imdbID);
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.style.animationDelay = `${Math.min(i, 6) * 0.05 + 0.05}s`;
    card.innerHTML = `
      <div class="card-poster-wrap">
        ${m.Poster && m.Poster !== 'N/A'
          ? `<img class="card-poster" src="${m.Poster}" alt="${m.Title}" loading="lazy">`
          : `<div class="card-no-poster">🎬<span>No Image</span></div>`}
        <span class="card-type">Movie</span>
        ${m.imdbRating ? `<span class="card-rating">⭐ ${m.imdbRating}</span>` : ''}
        <button class="card-wl-btn ${inWL ? 'saved' : ''}" data-id="${m.imdbID}" title="${inWL ? 'Remove from watchlist' : 'Add to watchlist'}">
          ${inWL ? '🔖' : '＋'}
        </button>
        <div class="card-overlay">
          <div class="overlay-text">
            ${m.Title}
            <span class="overlay-hint">Click for details</span>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${m.Title}</div>
        <div class="card-year">${m.Year}</div>
      </div>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('.card-wl-btn')) return;
      openModal(m.imdbID);
    });

    card.querySelector('.card-wl-btn').addEventListener('click', e => {
      e.stopPropagation();
      toggleWatchlist(m, card.querySelector('.card-wl-btn'));
    });

    moviesGrid.appendChild(card);
  });
}

/* ── LOAD MORE ── */
loadMoreBtn.addEventListener('click', () => {
  state.page++;
  doSearch(state.lastSearch, true);
});

function updateLoadMore() {
  const shown = state.movies.length;
  if (shown < state.totalResults && state.totalResults > 10) {
    loadMoreWrapper.style.display = 'block';
    loadMoreBtn.innerHTML = `<span>Load More</span><span class="btn-arrow">↓</span>`;
    loadMoreBtn.disabled = false;
  } else {
    loadMoreWrapper.style.display = 'none';
  }
}

/* ── STATUS ── */
function updateStatus() {
  const total = state.movies.length;
  statusText.textContent = total
    ? `Showing ${total} result${total !== 1 ? 's' : ''} for "${state.lastSearch}"`
    : '✨ Search above or explore popular movies';
  resultCount.textContent = state.totalResults ? `${state.totalResults.toLocaleString()} total` : '';
}

/* ── SKELETON ── */
function showSkeleton(n = 8) {
  skeletonGrid.style.display = 'grid';
  skeletonGrid.innerHTML = Array(n).fill(`
    <div class="skeleton-card">
      <div class="skeleton-poster"></div>
      <div class="skeleton-body">
        <div class="skeleton-line wide"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>
  `).join('');
}
function hideSkeleton() { skeletonGrid.style.display = 'none'; skeletonGrid.innerHTML = ''; }

/* ── STATES ── */
function hideAll() {
  emptyState.style.display = 'none';
  watchlistEmpty.style.display = 'none';
  errorState.style.display = 'none';
  moviesGrid.style.display = 'grid';
}
function showEmpty() {
  moviesGrid.style.display = 'none';
  emptyState.style.display = 'block';
  loadMoreWrapper.style.display = 'none';
  resultCount.textContent = '';
}
function showWatchlistEmpty() {
  moviesGrid.style.display = 'none';
  watchlistEmpty.style.display = 'block';
}
function showError(title, msg) {
  moviesGrid.style.display = 'none';
  errorState.style.display = 'block';
  $('errorTitle').textContent = title;
  $('errorMsg').textContent = msg;
}

/* ── MODAL ── */
async function openModal(imdbID) {
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  modalInner.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--text-muted)">Loading…</div>`;

  try {
    const m = await fetchMovieDetail(imdbID);
    if (m.Response !== 'True') throw new Error('Not found');
    const inWL = state.watchlist.some(w => w.imdbID === m.imdbID);
    const stars = ratingToStars(m.imdbRating);
    modalInner.innerHTML = `
      <div class="modal-hero">
        <div class="modal-poster">
          ${m.Poster && m.Poster !== 'N/A'
            ? `<img src="${m.Poster}" alt="${m.Title}">`
            : `<div class="modal-poster-placeholder">🎬</div>`}
        </div>
        <div class="modal-info">
          <div class="modal-title">${m.Title}</div>
          <div class="modal-meta">
            ${m.Year !== 'N/A' ? `<span class="meta-pill">${m.Year}</span>` : ''}
            ${m.Rated !== 'N/A' ? `<span class="meta-pill">${m.Rated}</span>` : ''}
            ${m.Runtime !== 'N/A' ? `<span class="meta-pill">⏱ ${m.Runtime}</span>` : ''}
            ${m.Genre !== 'N/A' ? m.Genre.split(',').map(g => `<span class="meta-pill gold">${g.trim()}</span>`).join('') : ''}
          </div>
          ${m.imdbRating !== 'N/A' ? `
          <div class="modal-rating-row">
            <span class="stars">${stars}</span>
            <span class="rating-val">${m.imdbRating}</span>
            <span class="rating-max">/10</span>
            <span style="font-size:0.75rem;color:var(--text-dim);margin-left:4px">(${m.imdbVotes || ''} votes)</span>
          </div>` : ''}
          <p class="modal-plot">${m.Plot !== 'N/A' ? m.Plot : 'No plot available.'}</p>
          <button class="modal-wl-btn ${inWL ? 'saved' : ''}" id="modalWlBtn" data-id="${m.imdbID}">
            ${inWL ? '🔖 In Watchlist' : '＋ Add to Watchlist'}
          </button>
        </div>
      </div>
      <div class="modal-divider"></div>
      <div class="modal-details">
        ${detailItem('Director', m.Director)}
        ${detailItem('Cast', m.Actors)}
        ${detailItem('Writer', m.Writer)}
        ${detailItem('Language', m.Language)}
        ${detailItem('Country', m.Country)}
        ${detailItem('Awards', m.Awards)}
        ${detailItem('Box Office', m.BoxOffice)}
        ${detailItem('Released', m.Released)}
      </div>
    `;

    $('modalWlBtn').addEventListener('click', () => {
      const btn = $('modalWlBtn');
      const movieStub = { imdbID: m.imdbID, Title: m.Title, Year: m.Year, Poster: m.Poster };
      toggleWatchlist(movieStub, btn, true);
    });
  } catch {
    modalInner.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--text-muted)">Failed to load movie details.</div>`;
  }
}

function detailItem(label, val) {
  if (!val || val === 'N/A') return '';
  return `<div class="detail-item"><label>${label}</label><span>${val}</span></div>`;
}

function ratingToStars(rating) {
  const r = parseFloat(rating);
  if (isNaN(r)) return '';
  const full = Math.round(r / 2);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

/* ── WATCHLIST ── */
function toggleWatchlist(movie, btn, isModal = false) {
  const idx = state.watchlist.findIndex(w => w.imdbID === movie.imdbID);
  if (idx === -1) {
    state.watchlist.push(movie);
    if (btn) { btn.classList.add('saved'); btn.innerHTML = isModal ? '🔖 In Watchlist' : '🔖'; btn.title = 'Remove from watchlist'; }
  } else {
    state.watchlist.splice(idx, 1);
    if (btn) { btn.classList.remove('saved'); btn.innerHTML = isModal ? '＋ Add to Watchlist' : '＋'; btn.title = 'Add to watchlist'; }
  }
  localStorage.setItem('cinevault_wl', JSON.stringify(state.watchlist));
  updateWLBadge();
  if (state.activeTab === 'watchlist') renderWatchlist();
}

function updateWLBadge() {
  const n = state.watchlist.length;
  wlBadge.textContent = n;
  wlBadgeTab.textContent = n;
}
updateWLBadge();

watchlistNavBtn.addEventListener('click', () => switchTab('watchlist'));

function renderWatchlist() {
  hideAll();
  if (!state.watchlist.length) { showWatchlistEmpty(); return; }
  renderMovies(state.watchlist);
  statusText.textContent = `Your watchlist — ${state.watchlist.length} movie${state.watchlist.length !== 1 ? 's' : ''}`;
  resultCount.textContent = '';
  loadMoreWrapper.style.display = 'none';
}

/* ── TABS ── */
tabSearch.addEventListener('click', () => switchTab('search'));
tabWatchlist.addEventListener('click', () => switchTab('watchlist'));

function switchTab(tab) {
  state.activeTab = tab;
  tabSearch.classList.toggle('active', tab === 'search');
  tabWatchlist.classList.toggle('active', tab === 'watchlist');
  if (tab === 'watchlist') {
    renderWatchlist();
  } else {
    if (state.movies.length) renderMovies(state.movies);
    else { hideAll(); showEmpty(); statusText.textContent = '✨ Search above or explore popular movies'; }
    updateStatus();
    updateLoadMore();
  }
}

/* ── VIEW TOGGLE ── */
viewGrid.addEventListener('click', () => {
  state.viewMode = 'grid';
  viewGrid.classList.add('active');
  viewList.classList.remove('active');
  if (state.activeTab === 'watchlist') renderWatchlist();
  else if (state.movies.length) renderMovies(state.movies);
});
viewList.addEventListener('click', () => {
  state.viewMode = 'list';
  viewList.classList.add('active');
  viewGrid.classList.remove('active');
  if (state.activeTab === 'watchlist') renderWatchlist();
  else if (state.movies.length) renderMovies(state.movies);
});

/* ── POPULAR STRIP ── */
async function loadPopularStrip() {
  const titles = POPULAR_TITLES.slice(0, 20);
  const results = await Promise.allSettled(titles.map(t => fetchMovies(t, 1)));

  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value.Response === 'True') {
      const m = r.value.Search[0];
      if (!m) return;
      const card = document.createElement('div');
      card.className = 'strip-card';
      card.innerHTML = `
        ${m.Poster && m.Poster !== 'N/A'
          ? `<img src="${m.Poster}" alt="${m.Title}" loading="lazy">`
          : `<div style="width:100%;height:196px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:2rem">🎬</div>`}
        <span class="strip-card-rating">⭐</span>
        <div class="strip-card-title">${m.Title}</div>
      `;
      card.addEventListener('click', () => openModal(m.imdbID));
      popularStrip.appendChild(card);
      state.popularMovies.push(m);
    }
  });

  /* Build hero poster reel from popular movies */
  buildPosterReel();
}

/* ── POSTER REEL (hero background) ── */
function buildPosterReel() {
  const reel = $('posterReel');
  const posters = state.popularMovies
    .filter(m => m.Poster && m.Poster !== 'N/A')
    .map(m => m.Poster);

  // Duplicate for seamless loop
  [...posters, ...posters].forEach(src => {
    const img = document.createElement('img');
    img.className = 'reel-poster';
    img.src = src;
    img.alt = '';
    img.loading = 'lazy';
    reel.appendChild(img);
  });
}

/* ── STRIP ARROW SCROLL ── */
let stripOffset = 0;
const STRIP_SCROLL = 320;
stripRight.addEventListener('click', () => {
  const wrap = document.querySelector('.popular-strip-wrap');
  wrap.scrollBy({ left: STRIP_SCROLL, behavior: 'smooth' });
});
stripLeft.addEventListener('click', () => {
  const wrap = document.querySelector('.popular-strip-wrap');
  wrap.scrollBy({ left: -STRIP_SCROLL, behavior: 'smooth' });
});

/* ── INIT ── */
loadPopularStrip();
// Kickoff: show popular titles as initial search results (no scroll)
state.skipScroll = true;
doSearch('Marvel');