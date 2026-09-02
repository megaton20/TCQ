// The shared Socket.io connection (window.appSocket) is initialized in
// layout.ejs's <head>, before any page content parses - this file just
// consumes it, since page-specific inline scripts further down the page
// (leaderboard.ejs, staff/checkin.ejs) also rely on it existing early.

// --- Global page loading overlay + button spinners ---
// Shown on any real navigation (link click) or form submission, so buttons
// that trigger payments, votes, or other async work always give feedback
// and can't be double-clicked while the request is in flight.
function ensurePageLoader() {
  let overlay = document.getElementById('page-loader');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'page-loader';
    overlay.className = 'fixed inset-0 bg-white/80 backdrop-blur-sm z-[9999] hidden flex items-center justify-center';
    overlay.innerHTML = '<div class="flex flex-col items-center gap-3">' +
      '<div class="w-10 h-10 border-4 border-carnival-green border-t-transparent rounded-full animate-spin"></div>' +
      '<p class="text-carnival-green font-semibold text-sm">Loading...</p></div>';
    document.body.appendChild(overlay);
  }
  return overlay;
}

function showPageLoader() {
  ensurePageLoader().classList.remove('hidden');
}

function setButtonLoading(btn) {
  if (!btn || btn.disabled) return;
  btn.dataset.originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('opacity-70', 'cursor-not-allowed');
  btn.innerHTML = '<span class="inline-flex items-center gap-2">' +
    '<span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>' +
    'Processing...</span>';
}

document.addEventListener('DOMContentLoaded', () => {
  ensurePageLoader();

  // If the browser restores this page from bfcache (e.g. hitting Back),
  // the loader could still be showing from just before the user navigated
  // away - hide it so they're not stuck looking at a spinner.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      const overlay = document.getElementById('page-loader');
      if (overlay) overlay.classList.add('hidden');
    }
  });

  const socket = window.appSocket;

  // Auto-dismiss flash messages after 5s
  document.querySelectorAll('.bg-green-100, .bg-red-100').forEach(el => {
    if (el.closest('main')) {
      setTimeout(() => { el.style.transition = 'opacity 0.5s'; el.style.opacity = '0'; }, 5000);
    }
  });

  // Loader on same-site link navigation (skip anchors, new tabs, downloads,
  // mailto/tel, and modified clicks that open a new tab)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || link.target === '_blank' || link.hasAttribute('download')) return;
    if (/^(mailto:|tel:|javascript:)/.test(href)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    showPageLoader();
  });

  // Loader + button spinner on form submission
  document.addEventListener('submit', (e) => {
    const form = e.target;
    showPageLoader();
    const submitBtn = form.querySelector('button[type="submit"], button:not([type])');
    setButtonLoading(submitBtn);
  });

  // --- Live vote counts, everywhere they appear ---
  // Any element with data-vote-count="<contestantId>" gets kept in sync in
  // real time - this covers the home page grids, the full contestants
  // list, and the contestant detail page, all from one shared handler.
  // (The leaderboard page has its own richer re-ranking logic and listens
  // to a separate "leaderboard:update" event instead.)
  const voteEls = document.querySelectorAll('[data-vote-count]');
  if (voteEls.length) {
    const joined = new Set();
    voteEls.forEach(el => {
      const id = el.getAttribute('data-vote-count');
      if (id && !joined.has(id)) {
        socket.emit('join:contestant', id);
        joined.add(id);
      }
    });

    socket.on('vote:new', (data) => {
      document.querySelectorAll(`[data-vote-count="${data.contestantId}"]`).forEach(el => {
        const suffix = el.getAttribute('data-vote-suffix') || '';
        el.textContent = Number(data.contestantVoteCount).toLocaleString() + suffix;
      });
    });
  }

  // --- Live "your ticket was scanned" update ---
  // A wrapper element with data-ticket-live="<ticketId>" on the ticket-view
  // page joins that ticket's private room; when staff check it (or a table
  // guest on it) in, we tell the person to hang tight for their wristband
  // and refresh shortly after so the new status/roster reflects reality.
  const ticketEl = document.querySelector('[data-ticket-live]');
  if (ticketEl) {
    const ticketId = ticketEl.getAttribute('data-ticket-live');
    socket.emit('join:ticket', ticketId);

    socket.on('ticket:status_update', (data) => {
      if (data.ticketId !== ticketId) return;
      const banner = document.createElement('div');
      banner.innerHTML = '<p class="font-bold mb-0.5">Your ticket was just scanned!</p>' +
        '<p class="text-sm font-normal">Please wait to receive your wristband before heading inside.</p>';
      banner.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm rounded-2xl p-4 text-center shadow-xl bg-green-100 text-green-800';
      document.body.appendChild(banner);
      if (navigator.vibrate) navigator.vibrate(120);
      setTimeout(() => location.reload(), 2200);
    });
  }
});
