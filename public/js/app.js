/**
 * NovaMart - Full-Stack E-Commerce Client Application
 * Implements UML Actors: Customer, Admin, Payment Gateway, Delivery Service
 */

(function () {
  // Application State
  const state = {
    user: null,
    token: localStorage.getItem('novamart_token') || null,
    cart: JSON.parse(localStorage.getItem('novamart_cart') || '[]'),
    appliedCoupon: null,
    products: [],
    categories: [],
    activeCategory: 'all',
    maxPrice: null,
    offerLabel: null,
    searchQuery: '',
    sortBy: 'featured',
    activeTab: 'store',
    adminTab: 'customers',
    customers: [],
    customerFilter: 'all',
    orders: [],
    payments: [],
    emails: [],
    reports: null,
    activeOrderTracking: null,
    registrationSettings: {
      allowPublicRegistration: true,
      requireAdminApproval: true
    }
  };

  // API Client Helper
  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.error || 'API Request Failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Indian Rupee Currency Formatter
  function formatINR(val) {
    return '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  window.formatINR = formatINR;

  // Available Promotional Coupons
  const AVAILABLE_COUPONS = {
    'WELCOME10': { type: 'percent', value: 10, minOrder: 0, desc: '10% off entire order' },
    'FESTIVE20': { type: 'percent', value: 20, minOrder: 0, desc: '20% festive special discount' },
    'FLAT500': { type: 'flat', value: 500, minOrder: 1500, desc: 'Flat ₹500 off on orders ₹1,500+' },
    'FREESHIP': { type: 'shipping', value: 99, minOrder: 0, desc: 'Free express shipping (saves ₹99)' },
    'MEGA50': { type: 'percent', value: 50, minOrder: 0, desc: '50% mega savings discount' }
  };

  function calculateTotals(subtotal, coupon) {
    let discount = 0;
    let shipping = subtotal >= 999 || subtotal === 0 ? 0 : 99;

    if (coupon) {
      if (coupon.type === 'percent') {
        discount = Math.round((subtotal * coupon.value) / 100);
      } else if (coupon.type === 'flat') {
        discount = Math.min(coupon.value, subtotal);
      } else if (coupon.type === 'shipping') {
        discount = shipping;
        shipping = 0;
      }
    }

    const discountedSubtotal = Math.max(0, subtotal - (coupon?.type === 'shipping' ? 0 : discount));
    const tax = parseFloat((discountedSubtotal * 0.18).toFixed(2));
    const total = parseFloat((discountedSubtotal + shipping + tax).toFixed(2));

    return {
      subtotal,
      discount,
      shipping,
      tax,
      total
    };
  }

  // Password Visibility Toggle Helper
  window.togglePasswordVisibility = function (inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (btn) {
      btn.title = isPassword ? 'Hide password' : 'Show password';
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      btn.innerHTML = isPassword
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
          </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400 hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>`;
    }
  };

  // Coupon Action Handlers
  window.applyCoupon = function (code) {
    const key = (code || '').trim().toUpperCase();
    const couponInfo = AVAILABLE_COUPONS[key];
    if (!couponInfo) {
      showToast(`Invalid coupon code "${code}". Try WELCOME10, FESTIVE20 or FLAT500.`, 'error');
      return;
    }

    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (couponInfo.minOrder && subtotal < couponInfo.minOrder) {
      showToast(`Coupon ${key} requires a minimum order of ${formatINR(couponInfo.minOrder)}`, 'warning');
      return;
    }

    state.appliedCoupon = { code: key, ...couponInfo };
    showToast(`Coupon "${key}" applied! You save money on this order.`, 'success');
    renderCheckoutModal();
  };

  window.applyCouponFromInput = function () {
    const input = document.getElementById('coupon-input');
    if (!input || !input.value.trim()) {
      showToast('Please enter a coupon code first.', 'warning');
      return;
    }
    window.applyCoupon(input.value.trim());
  };

  window.removeCoupon = function () {
    state.appliedCoupon = null;
    showToast('Coupon removed.', 'info');
    renderCheckoutModal();
  };

  // Toast Notification
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Check if an identical toast message is already showing to prevent ugly multi-stacking
    const existing = Array.from(container.children).find(c => c.textContent.includes(message));
    if (existing) {
      return;
    }

    // Keep at most 2 toasts active simultaneously
    while (container.children.length >= 2) {
      container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠️';
    if (type === 'warning') icon = '🔔';

    toast.innerHTML = `
      <div class="font-bold text-base">${icon}</div>
      <div class="flex-1">${message}</div>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('active'));

    setTimeout(() => {
      toast.classList.remove('active');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- INITIALIZATION ---
  async function loadPublicSettings() {
    try {
      const data = await api('/api/settings/public');
      if (data.settings) {
        state.registrationSettings = data.settings;
      }
    } catch {
      // Fallback to default settings
    }
  }

  async function init() {
    setupEventListeners();
    await loadPublicSettings();
    await checkAuth();
    await loadCategories();
    await loadProducts();
    if (state.user && state.user.role === 'admin') {
      await loadEmails();
      await loadAdminCustomers();
    }

    // Check URL parameters for verification tokens or direct order tracking
    const params = new URLSearchParams(window.location.search);
    if (params.has('verify_token')) {
      handleVerifyToken(params.get('verify_token'));
    }
    if (params.has('track_order')) {
      window.trackOrderById(params.get('track_order'));
    }
    if (params.has('login_email')) {
      window.openAuthModal('login', params.get('login_email'));
    }

    renderCart();
  }

  // Verify email token link
  async function handleVerifyToken(token) {
    try {
      const res = await api(`/api/auth/verify-token?token=${encodeURIComponent(token)}`);
      showToast(res.message, 'success');
      window.openAuthModal('login', res.email);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Check Current Authentication
  async function checkAuth() {
    if (!state.token) {
      renderAuthNav();
      return;
    }
    try {
      const data = await api('/api/auth/me');
      // If user was previously saved as the John demo customer, clear it so visitor starts as guest
      if (data.user && data.user.email === 'john@example.com') {
        state.token = null;
        state.user = null;
        localStorage.removeItem('novamart_token');
        renderAuthNav();
        return;
      }
      state.user = data.user;
      renderAuthNav();
      checkAccountAlert();
      if (state.activeTab === 'admin' && state.user.role !== 'admin') {
        window.switchTab('store');
      }
    } catch {
      state.token = null;
      state.user = null;
      localStorage.removeItem('novamart_token');
      renderAuthNav();
      if (state.activeTab === 'admin') {
        window.switchTab('store');
      }
    }
  }

  function renderAuthNav() {
    const container = document.getElementById('auth-actions');
    const adminNavBtn = document.getElementById('nav-admin-btn');
    const adminLoginBtn = document.getElementById('nav-admin-login-btn');
    const storeNavBtn = document.getElementById('nav-store-btn');
    const adminMailboxBtn = document.getElementById('admin-mailbox-btn');
    const footerMailboxLink = document.getElementById('footer-admin-mailbox');
    const isAdmin = Boolean(state.user && state.user.role === 'admin');

    // Only display Admin Panel, Storefront switcher, and Transaction Mailbox when logged in as admin
    if (adminLoginBtn) {
      adminLoginBtn.classList.toggle('hidden', isAdmin);
    }
    if (adminNavBtn) {
      if (isAdmin) {
        adminNavBtn.classList.remove('hidden');
      } else {
        adminNavBtn.classList.add('hidden');
      }
    }
    if (storeNavBtn) {
      if (isAdmin) {
        storeNavBtn.classList.remove('hidden');
      } else {
        storeNavBtn.classList.add('hidden');
      }
    }
    if (adminMailboxBtn) {
      if (isAdmin) {
        adminMailboxBtn.classList.remove('hidden');
        loadEmails();
      } else {
        adminMailboxBtn.classList.add('hidden');
      }
    }
    if (footerMailboxLink) {
      if (isAdmin) {
        footerMailboxLink.classList.remove('hidden');
      } else {
        footerMailboxLink.classList.add('hidden');
      }
    }

    if (!container) return;

    if (state.user) {
      const isPending = state.user.status === 'pending_approval';

      container.innerHTML = `
        <div class="flex items-center gap-2">
          <button onclick="window.openTrackOrderModal()" class="text-left text-white hover:outline hover:outline-1 hover:outline-white p-1 rounded leading-tight hidden lg:block cursor-pointer" title="Returns & Orders">
            <div class="text-[10px] text-slate-300">Returns</div>
            <div class="text-xs font-bold text-white">& Orders</div>
          </button>

          <!-- Circular Profile Avatar for Authenticated User -->
          <div class="flex items-center gap-1.5 p-1 rounded-full sm:rounded-lg text-white">
            <div class="w-8 h-8 rounded-full ${isAdmin ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black border-2 border-white' : 'bg-slate-700 text-white font-bold border-2 border-slate-500'} flex items-center justify-center text-xs shadow-xs" title="${escapeHtml(state.user.name)} (${state.user.role})">
              ${escapeHtml(state.user.name.charAt(0).toUpperCase())}
            </div>
            <div class="text-left hidden sm:block leading-tight">
              <div class="text-[10px] text-slate-300">Hello, ${escapeHtml(state.user.name.split(' ')[0])}</div>
              <div class="text-xs font-bold text-white flex items-center gap-1">
                Account & Lists
                ${isAdmin ? '<span class="px-1.5 py-0.2 rounded text-[9px] bg-[#f2b880] text-slate-950 font-black uppercase">Admin</span>' : ''}
                ${isPending ? '<span class="px-1.5 py-0.2 rounded text-[9px] bg-amber-400 text-slate-950 font-bold">Pending</span>' : ''}
              </div>
            </div>
          </div>

          <button onclick="window.logout()" class="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-800 border border-slate-700" title="Sign Out">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          </button>
        </div>
      `;
    } else {
      // Guest State with Circular Login Option in Top Right Corner
      container.innerHTML = `
        <div class="flex items-center gap-2">
          <button onclick="window.openTrackOrderModal()" class="text-left text-white hover:outline hover:outline-1 hover:outline-white p-1 rounded leading-tight hidden lg:block cursor-pointer" title="Returns & Orders">
            <div class="text-[10px] text-slate-300">Returns</div>
            <div class="text-xs font-bold text-white">& Orders</div>
          </button>

          <!-- Sleek Circular Login Avatar in Top Right Corner -->
          <button onclick="window.openAuthModal('login')" class="flex items-center gap-2 p-1 rounded-full sm:rounded-lg hover:outline hover:outline-1 hover:outline-white text-white transition cursor-pointer group" title="Account & Sign In">
            <div class="w-8 h-8 rounded-full bg-[#24483d] border-2 border-slate-500 group-hover:border-[#f05d5e] group-hover:bg-[#315d50] flex items-center justify-center text-white shadow-xs transition">
              <svg class="w-4 h-4 text-slate-300 group-hover:text-[#f2b880]" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="text-left leading-tight hidden sm:block">
              <div class="text-[10px] text-slate-300">Hello, sign in</div>
              <div class="text-xs font-bold text-white flex items-center gap-0.5">
                Account & Lists
                <svg class="w-3 h-3 text-slate-300" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
              </div>
            </div>
          </button>
        </div>
      `;
    }
  }

  function checkAccountAlert() {
    const banner = document.getElementById('account-alert-banner');
    if (!banner) return;
    if (state.user && state.user.status === 'pending_approval') {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  // ==========================================
  // PRODUCTS & CATEGORIES
  // ==========================================

  const CATEGORY_ICONS = {
    'all': '🛍️',
    'cat_wearables': '⌚',
    'cat_audio': '🎧',
    'cat_electronics': '💻',
    'cat_fashion': '👕',
    'cat_home': '🏠',
    'cat_beauty': '✨',
    'cat_sports': '🏃',
    'wearables': '⌚',
    'audio': '🎧',
    'electronics': '💻',
    'fashion': '👕',
    'home': '🏠',
    'beauty': '✨',
    'sports': '🏃',
    'accessories': '🎒'
  };

  async function loadCategories() {
    try {
      const data = await api('/api/categories');
      state.categories = data.categories || [];
      renderCategoryPills();
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }

  function renderCategoryPills() {
    const container = document.getElementById('category-pills');
    if (!container) return;

    let html = `
      <button onclick="window.filterCategory('all')" class="category-pill whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold border ${state.activeCategory === 'all' ? 'active' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 shadow-xs'}">
        🛍️ All Items
      </button>
    `;

    for (const cat of state.categories) {
      const isActive = state.activeCategory === cat.id || 
        (state.activeCategory === 'shoes' && cat.id === 'cat_fashion') ||
        (state.activeCategory === 'tshirt' && cat.id === 'cat_fashion') ||
        (state.activeCategory === 'gaming' && cat.id === 'cat_electronics');
      const icon = CATEGORY_ICONS[cat.id] || '📦';
      html += `
        <button onclick="window.filterCategory('${cat.id}')" class="category-pill whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold border ${isActive ? 'active' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 shadow-xs'}">
          ${icon} ${escapeHtml(cat.name)} <span class="opacity-70 text-[10px] ml-0.5">(${cat.itemCount})</span>
        </button>
      `;
    }

    container.innerHTML = html;
  }

  async function loadProducts() {
    try {
      let query = `/api/products?sortBy=${state.sortBy}`;
      if (state.activeCategory && state.activeCategory !== 'all') {
        query += `&category=${encodeURIComponent(state.activeCategory)}`;
      }
      if (state.maxPrice) {
        query += `&maxPrice=${encodeURIComponent(state.maxPrice)}`;
      }
      if (state.searchQuery) {
        query += `&search=${encodeURIComponent(state.searchQuery)}`;
      }

      const data = await api(query);
      state.products = data.products || [];
      renderProductGrid();
    } catch (err) {
      console.error('Failed to load products', err);
    }
  }

  function renderProductGrid() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    if (!state.products.length) {
      if (state.searchQuery) {
        grid.innerHTML = `
          <div class="col-span-full py-16 px-4 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold border border-amber-200">🔍</div>
            <h3 class="text-lg font-bold text-slate-900">No results found for "${escapeHtml(state.searchQuery)}"</h3>
            <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">We couldn't find any products matching your search query. Try checking your spelling or search for "headphones", "shoes", "smartwatch", or "t-shirt".</p>
            <button onclick="window.clearSearch()" class="mt-4 px-5 py-2.5 rounded-lg bg-[#f2b880] hover:bg-[#f3a847] text-slate-900 text-xs font-bold transition shadow-xs">
              Clear Search &amp; Show All Deals
            </button>
          </div>
        `;
        return;
      }
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          <p class="text-base font-semibold">No products found matching your search criteria.</p>
          <button onclick="window.filterCategory('all')" class="mt-3 btn-amazon-cart text-xs py-1.5 px-4 font-bold">Reset Filters</button>
        </div>
      `;
      return;
    }

    let searchBannerHtml = '';
    if (state.searchQuery) {
      searchBannerHtml = `
        <div class="col-span-full bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-900 shadow-2xs">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2.5 py-0.5 rounded bg-[#e9a23b] text-slate-900 font-black text-[10px] uppercase tracking-wider">Search Results</span>
            <span class="text-sm font-black text-slate-900">Showing matches for <span class="text-[#b63a45] font-black underline decoration-amber-400">"${escapeHtml(state.searchQuery)}"</span></span>
            <span class="text-slate-600 font-semibold">(${state.products.length} item${state.products.length === 1 ? '' : 's'} found)</span>
          </div>
          <button onclick="window.clearSearch()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800 transition shadow-2xs">
            <span>✕ Clear Search</span>
            <span class="text-slate-400 font-normal">|</span>
            <span class="text-[#2f6f61]">Show Banners</span>
          </button>
        </div>
      `;
    }

    const specialOfferHtml = state.maxPrice ? `
      <div class="col-span-full bg-amber-50 border border-amber-300 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-amber-950 shadow-2xs">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[11px] uppercase">Special Offer</span>
          <span>${escapeHtml(state.offerLabel || ('Deals Under ₹' + state.maxPrice))} &bull; ${state.products.length} products found</span>
        </div>
        <button onclick="window.filterCategory('all')" class="text-[#2f6f61] hover:text-[#c7511f] font-bold underline">
          View All Products &times;
        </button>
      </div>
    ` : '';

    const bannerHtml = searchBannerHtml || specialOfferHtml;

    grid.innerHTML = bannerHtml + state.products.map(p => {
      const isOutOfStock = p.stock <= 0;
      const mrp = Math.round(p.price * 1.35);
      const discountPercent = Math.round(((mrp - p.price) / mrp) * 100);

      return `
        <div class="product-card bg-white p-4 flex flex-col justify-between hover:shadow-lg transition">
          <div>
            <!-- Top Badges & Thumbnail -->
            <div class="relative bg-[#f7f8f8] rounded-xl aspect-square overflow-hidden cursor-pointer flex items-center justify-center p-3" onclick="window.openProductModal('${p.id}')">
              <img src="${p.image}" alt="${escapeHtml(p.name)}" class="w-full h-full object-contain hover:scale-105 transition duration-300">
              
              <!-- Amazon Deal Badges -->
              <div class="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                ${p.featured ? `
                  <span class="badge-deal">Limited time deal</span>
                ` : p.rating >= 4.7 ? `
                  <span class="badge-choice">Nova's <span class="accent">Choice</span></span>
                ` : `
                  <span class="bg-[#24483d] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">Top Rated</span>
                `}
              </div>

              <!-- Quick Rating Badge -->
              <span class="absolute bottom-2.5 right-2.5 bg-white/95 backdrop-blur text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 border border-slate-100">
                <span class="text-[#e9a23b]">★</span> ${p.rating}
              </span>
            </div>

            <!-- Product Category & Title -->
            <div class="mt-3">
              <div class="flex items-center justify-between text-[11px]">
                <span class="font-bold text-[#2f6f61] hover:text-[#c7511f] uppercase tracking-wider">${escapeHtml(p.categoryName || 'General')}</span>
                <span class="badge-prime"><span class="check">✓</span>prime</span>
              </div>
              <h3 class="font-bold text-sm text-[#1d2a25] mt-1 line-clamp-2 hover:text-[#c7511f] cursor-pointer leading-snug" onclick="window.openProductModal('${p.id}')">
                ${escapeHtml(p.name)}
              </h3>
              
              <!-- Stars Display -->
              <div class="flex items-center gap-1.5 mt-1 text-xs">
                <div class="flex text-[#e9a23b] text-xs">
                  ${'★'.repeat(Math.floor(p.rating))}${'☆'.repeat(5 - Math.floor(p.rating))}
                </div>
                <span class="text-[#2f6f61] font-semibold text-[11px] hover:underline cursor-pointer">(${p.reviewCount.toLocaleString('en-IN')})</span>
              </div>
            </div>

            <!-- Pricing & Amazon Savings -->
            <div class="mt-3 pt-2 border-t border-slate-100">
              <div class="flex items-baseline gap-2">
                <span class="text-xs font-black text-[#cc0c39] bg-red-50 px-1.5 py-0.5 rounded">-${discountPercent}%</span>
                <span class="text-xl font-extrabold text-[#1d2a25]">${formatINR(p.price)}</span>
              </div>
              <div class="text-[11px] text-slate-500 mt-0.5">
                M.R.P.: <span class="line-through">${formatINR(mrp)}</span>
              </div>
              
              <!-- Delivery info -->
              <div class="text-[11px] text-[#007600] font-semibold mt-1 flex items-center gap-1">
                <span>FREE Delivery by <strong>Tomorrow, 11 AM</strong></span>
              </div>

              <!-- Coupon Tag -->
              <div class="mt-2">
                <span class="coupon-tag">
                  <span>🏷️</span> Save 10% with coupon <strong>WELCOME10</strong>
                </span>
              </div>
            </div>
          </div>

          <!-- Bottom Add to Cart Button -->
          <div class="mt-4 pt-2">
            ${isOutOfStock ? `
              <div class="w-full text-center py-2 bg-red-50 text-red-600 font-bold text-xs rounded-full border border-red-200">
                Currently Unavailable
              </div>
            ` : `
              <div class="flex items-center gap-2">
                <button onclick="window.addToCart('${p.id}')" class="flex-1 btn-amazon-cart text-xs py-2 font-bold shadow-xs">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                  Add to Cart
                </button>
                ${state.user && state.user.role === 'admin' ? `
                  <button onclick="event.stopPropagation(); window.openEditProductModal('${p.id}')" class="p-2 rounded-full bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 transition" title="Edit Item (Admin)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </button>
                  <button onclick="event.stopPropagation(); window.adminDeleteProduct('${p.id}', '${escapeHtml(p.name)}')" class="p-2 rounded-full bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 transition" title="Delete Item (Admin)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                ` : ''}
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  // Product Details Modal
  window.openProductModal = async function (productId) {
    try {
      const data = await api(`/api/products/${productId}`);
      const p = data.product;
      const reviews = data.reviews || [];
      const modal = document.getElementById('product-modal');
      const content = document.getElementById('product-modal-content');

      const mrp = Math.round(p.price * 1.35);
      const discountPercent = Math.round(((mrp - p.price) / mrp) * 100);

      content.innerHTML = `
        <div class="relative">
          <button onclick="window.closeModals()" class="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-600 flex items-center justify-center shadow">✕</button>
          
          <div class="grid grid-cols-1 md:grid-cols-2">
            <!-- Image Section -->
            <div class="bg-[#f7f8f8] aspect-square flex items-center justify-center p-6">
              <img src="${p.image}" alt="${escapeHtml(p.name)}" class="w-full h-full object-contain">
            </div>

            <!-- Details Section -->
            <div class="p-6 md:p-8 flex flex-col justify-between space-y-4">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-[#2f6f61] hover:text-[#c7511f] uppercase">${escapeHtml(p.categoryName)}</span>
                  <span class="badge-prime text-xs"><span class="check">✓</span>prime</span>
                </div>
                <h2 class="text-xl sm:text-2xl font-bold text-[#1d2a25] mt-1">${escapeHtml(p.name)}</h2>
                
                <div class="flex items-center gap-2 mt-2">
                  <div class="flex text-[#e9a23b]">
                    ${'★'.repeat(Math.round(p.rating))}${'☆'.repeat(5 - Math.round(p.rating))}
                  </div>
                  <span class="text-xs font-bold text-slate-800">${p.rating} / 5</span>
                  <span class="text-xs text-[#2f6f61] hover:underline cursor-pointer">(${p.reviewCount} verified ratings)</span>
                </div>

                <!-- Price Breakdown -->
                <div class="mt-4 pb-3 border-b border-slate-200">
                  <div class="flex items-baseline gap-2">
                    <span class="text-sm font-black text-[#cc0c39] bg-red-50 px-2 py-0.5 rounded">-${discountPercent}%</span>
                    <span class="text-3xl font-extrabold text-[#1d2a25]">${formatINR(p.price)}</span>
                  </div>
                  <div class="text-xs text-slate-500 mt-1">
                    M.R.P.: <span class="line-through">${formatINR(mrp)}</span> <span class="text-slate-400">(Inclusive of all taxes & GST)</span>
                  </div>
                  <div class="mt-2 text-xs text-[#007600] font-bold">
                    ✓ FREE Delivery by Tomorrow, 11 AM
                  </div>
                </div>

                <p class="text-xs text-slate-600 leading-relaxed mt-3">${escapeHtml(p.description)}</p>

                <!-- Coupon Promo Callout -->
                <div class="mt-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs shadow-xs">
                  <div class="flex items-center gap-2">
                    <span class="text-lg">🎟️</span>
                    <div>
                      <div class="font-bold text-emerald-950">Festive Coupon Available!</div>
                      <div class="text-[11px] text-emerald-700">Apply coupon <strong>FESTIVE20</strong> for instant 20% discount</div>
                    </div>
                  </div>
                  <button type="button" onclick="window.addToCart('${p.id}'); window.applyCoupon('FESTIVE20'); window.closeModals(); window.startCheckout();" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs">
                    Apply & Buy
                  </button>
                </div>

                <!-- Stock Indicator -->
                <div class="mt-3 flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full ${p.stock > 0 ? 'bg-[#007600]' : 'bg-red-500'}"></span>
                  <span class="text-xs font-semibold ${p.stock > 0 ? 'text-[#007600]' : 'text-red-600'}">
                    ${p.stock > 0 ? `In Stock (${p.stock} units available)` : 'Currently Sold Out'}
                  </span>
                </div>

                <!-- Specs -->
                ${p.specs && p.specs.length ? `
                  <div class="mt-3 pt-3 border-t border-slate-100">
                    <p class="text-xs font-bold text-slate-700 uppercase">Specifications</p>
                    <div class="flex flex-wrap gap-1.5 mt-2">
                      ${p.specs.map(s => `<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">${escapeHtml(s)}</span>`).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>

              <!-- Action button -->
              <div class="pt-4 border-t border-slate-200">
                ${p.stock > 0 ? `
                  <div class="flex flex-col sm:flex-row gap-2.5">
                    <button onclick="window.addToCart('${p.id}'); window.closeModals(); window.toggleCart();" class="flex-1 btn-amazon-cart text-xs sm:text-sm py-2.5 font-bold shadow-md">
                      Add to Shopping Cart
                    </button>
                    <button onclick="window.addToCart('${p.id}'); window.closeModals(); window.startCheckout();" class="flex-1 btn-amazon-buy text-xs sm:text-sm py-2.5 font-bold shadow-md">
                      Buy Now &rarr;
                    </button>
                  </div>
                ` : `
                  <div class="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold text-center">
                    This item is out of stock. Check back soon.
                  </div>
                `}
                ${state.user && state.user.role === 'admin' ? `
                  <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button onclick="window.closeModals(); window.openEditProductModal('${p.id}');" class="w-full py-2.5 px-4 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                      Edit Item Details (Admin)
                    </button>
                    <button onclick="window.adminDeleteProduct('${p.id}', '${escapeHtml(p.name)}'); window.closeModals();" class="w-full py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      Delete Item from Store (Admin)
                    </button>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Customer Reviews Section (Give Review / Rating Use Case) -->
          <div class="p-6 md:p-8 bg-slate-50 border-t border-slate-200 space-y-6">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-slate-900 text-base">Customer Reviews & Ratings</h3>
                <p class="text-xs text-slate-500">Verified buyer ratings and feedback</p>
              </div>
              <button onclick="window.toggleReviewForm('${p.id}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-blue-600 border border-blue-200 hover:bg-blue-50">
                Write a Review
              </button>
            </div>

            <!-- Review Input Form -->
            <div id="review-form-container" class="hidden bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 class="text-xs font-bold text-slate-800">Submit Your Product Review</h4>
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-600">Your Rating:</span>
                <select id="review-rating" class="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1">
                  <option value="5">⭐⭐⭐⭐⭐ (5 - Outstanding)</option>
                  <option value="4">⭐⭐⭐⭐ (4 - Very Good)</option>
                  <option value="3">⭐⭐⭐ (3 - Average)</option>
                  <option value="2">⭐⭐ (2 - Below Expectations)</option>
                  <option value="1">⭐ (1 - Poor)</option>
                </select>
              </div>
              <textarea id="review-comment" placeholder="Share your experience with this item..." rows="3" class="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"></textarea>
              <div class="flex justify-end gap-2">
                <button onclick="window.toggleReviewForm()" class="px-3 py-1 text-xs text-slate-500 hover:underline">Cancel</button>
                <button onclick="window.submitReview('${p.id}')" class="btn-primary text-xs py-1.5 px-4 font-semibold">Post Review</button>
              </div>
            </div>

            <!-- Review List -->
            <div class="space-y-3">
              ${reviews.length ? reviews.map(r => `
                <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-slate-800">${escapeHtml(r.customerName)}</span>
                      ${r.verifiedPurchase ? '<span class="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">Verified Buyer</span>' : ''}
                    </div>
                    <span class="text-slate-400 text-[11px]">${new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div class="flex text-amber-400 text-xs">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                  <p class="text-xs text-slate-600">${escapeHtml(r.comment)}</p>
                </div>
              `).join('') : '<p class="text-xs text-slate-400 italic">No reviews yet for this product. Be the first to review!</p>'}
            </div>
          </div>
        </div>
      `;

      modal.classList.add('active');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.toggleReviewForm = function () {
    const el = document.getElementById('review-form-container');
    if (el) el.classList.toggle('hidden');
  };

  window.submitReview = async function (productId) {
    if (!state.user) {
      showToast('Please sign in to post a review.', 'warning');
      window.openAuthModal('login');
      return;
    }

    const rating = document.getElementById('review-rating').value;
    const comment = document.getElementById('review-comment').value.trim();

    if (!comment) {
      showToast('Please write a brief comment.', 'error');
      return;
    }

    try {
      await api('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ productId, rating, comment })
      });
      showToast('Review submitted successfully!', 'success');
      window.openProductModal(productId);
      await loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==========================================
  // SHOPPING CART (Add to Cart Use Case)
  // ==========================================

  window.addToCart = function (productId) {
    const prod = state.products.find(p => p.id === productId);
    if (!prod) return;

    if (prod.stock <= 0) {
      showToast('This product is out of stock.', 'error');
      return;
    }

    const existing = state.cart.find(item => item.productId === productId);
    if (existing) {
      if (existing.quantity >= prod.stock) {
        showToast(`Cannot add more. Maximum available stock is ${prod.stock}.`, 'warning');
        return;
      }
      existing.quantity += 1;
    } else {
      state.cart.push({
        productId: prod.id,
        name: prod.name,
        price: prod.price,
        image: prod.image,
        quantity: 1
      });
    }

    saveCart();
    renderCart();
    showToast(`Added "${prod.name}" to cart.`, 'success');
  };

  window.updateCartQty = function (productId, delta) {
    const item = state.cart.find(i => i.productId === productId);
    if (!item) return;

    const prod = state.products.find(p => p.id === productId);
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      state.cart = state.cart.filter(i => i.productId !== productId);
    } else {
      if (prod && newQty > prod.stock) {
        showToast(`Only ${prod.stock} items in stock.`, 'warning');
        return;
      }
      item.quantity = newQty;
    }

    saveCart();
    renderCart();
  };

  window.removeFromCart = function (productId) {
    state.cart = state.cart.filter(i => i.productId !== productId);
    saveCart();
    renderCart();
  };

  function saveCart() {
    localStorage.setItem('novamart_cart', JSON.stringify(state.cart));
  }

  function renderCart() {
    const countBadge = document.getElementById('cart-count-badge');
    const drawerCount = document.getElementById('drawer-cart-count');
    const container = document.getElementById('cart-items-container');
    const subtotalEl = document.getElementById('cart-subtotal');
    const taxEl = document.getElementById('cart-tax');
    const shippingEl = document.getElementById('cart-shipping');
    const totalEl = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    const totalQty = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= 999 || subtotal === 0 ? 0 : 99;
    const tax = subtotal * 0.18;
    const total = subtotal + shipping + tax;

    if (countBadge) countBadge.innerText = totalQty;
    if (drawerCount) drawerCount.innerText = `${totalQty} items`;

    if (subtotalEl) subtotalEl.innerText = formatINR(subtotal);
    if (taxEl) taxEl.innerText = formatINR(tax);
    if (shippingEl) shippingEl.innerText = shipping === 0 ? (subtotal > 0 ? 'FREE' : '₹0.00') : formatINR(shipping);
    if (totalEl) totalEl.innerText = formatINR(total);

    if (!container) return;

    if (!state.cart.length) {
      container.innerHTML = `
        <div class="py-16 text-center text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
          <p class="text-sm font-semibold text-slate-600">Your cart is empty</p>
          <p class="text-xs mt-1">Browse our products and add items to begin.</p>
        </div>
      `;
      if (checkoutBtn) checkoutBtn.disabled = true;
      return;
    }

    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.className = 'w-full btn-amazon-cart text-sm py-3 font-black shadow-md';
      checkoutBtn.innerHTML = `Proceed to Buy (${totalQty} ${totalQty === 1 ? 'item' : 'items'}) &rarr;`;
    }

    const freeShipQualified = subtotal >= 999;
    const shippingProgressHtml = `
      <div class="mb-3 p-2.5 rounded-lg text-xs font-bold ${freeShipQualified ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'} flex items-center gap-2">
        <span>${freeShipQualified ? '✓ Qualified for FREE Express Delivery' : 'Add ' + formatINR(999 - subtotal) + ' more to get FREE Delivery!'}</span>
      </div>
    `;

    container.innerHTML = shippingProgressHtml + state.cart.map(item => `
      <div class="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <img src="${item.image}" alt="${escapeHtml(item.name)}" class="w-14 h-14 object-cover rounded-lg bg-slate-100">
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-bold text-slate-900 truncate">${escapeHtml(item.name)}</h4>
          <p class="text-xs text-[#1d2a25] font-extrabold mt-0.5">${formatINR(item.price)}</p>
          <div class="flex items-center gap-2 mt-2">
            <button onclick="window.updateCartQty('${item.productId}', -1)" class="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-bold">-</button>
            <span class="text-xs font-bold px-1">${item.quantity}</span>
            <button onclick="window.updateCartQty('${item.productId}', 1)" class="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-bold">+</button>
          </div>
        </div>
        <button onclick="window.removeFromCart('${item.productId}')" class="p-1.5 text-slate-400 hover:text-red-500 rounded" title="Remove Item">
          ✕
        </button>
      </div>
    `).join('');
  }

  window.toggleCart = function () {
    const overlay = document.getElementById('cart-drawer-overlay');
    const drawer = document.getElementById('cart-drawer');
    overlay.classList.toggle('active');
    drawer.classList.toggle('active');
  };

  // ==========================================
  // CHECKOUT & PAYMENT GATEWAY SIMULATION
  // (Place Order + Make Payment + Process Payment)
  // ==========================================

  window.startCheckout = function () {
    if (!state.cart.length) {
      showToast('Your cart is empty.', 'warning');
      return;
    }

    if (!state.user) {
      showToast('Please sign in to complete your purchase.', 'warning');
      window.openAuthModal('login');
      return;
    }

    // Check customer verification status
    if (state.user.status === 'pending_approval') {
      showToast('Your account is pending administrator approval before you can place orders.', 'error');
      window.openAuthModal('status_notice');
      return;
    }

    window.toggleCart(); // Close cart drawer
    renderCheckoutModal();
  };

  function renderCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    const content = document.getElementById('checkout-modal-content');

    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totals = calculateTotals(subtotal, state.appliedCoupon);

    content.innerHTML = `
      <div class="relative">
        <button onclick="window.closeModals()" class="absolute top-0 right-0 text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
        
        <div class="flex items-center gap-2 mb-4">
          <div class="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">✓</div>
          <div>
            <h3 class="font-bold text-slate-900 text-lg">Secure Multi-Step Checkout</h3>
            <p class="text-xs text-slate-500">Apply coupons & select payment gateway</p>
          </div>
        </div>

        <form id="checkout-form" onsubmit="window.processOrderCheckout(event)" class="space-y-4">
          
          <!-- 1. Shipping Address -->
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 class="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
              <span>1. Shipping Details</span>
            </h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <input type="text" id="ship-name" placeholder="Full Name" value="${escapeHtml(state.user.name || '')}" required class="p-2 bg-white border border-slate-200 rounded">
              <input type="text" id="ship-phone" placeholder="Phone Number" value="${escapeHtml(state.user.phone || '+91 98765 43210')}" required class="p-2 bg-white border border-slate-200 rounded">
              <input type="text" id="ship-street" placeholder="Street Address" value="${escapeHtml(state.user.address?.street || '42 MG Road, Indiranagar')}" required class="col-span-2 p-2 bg-white border border-slate-200 rounded">
              <input type="text" id="ship-city" placeholder="City" value="${escapeHtml(state.user.address?.city || 'Bengaluru')}" required class="p-2 bg-white border border-slate-200 rounded">
              <input type="text" id="ship-zip" placeholder="PIN Code" value="${escapeHtml(state.user.address?.zip || '560038')}" required class="p-2 bg-white border border-slate-200 rounded">
            </div>
          </div>

          <!-- 2. Apply Coupon / Promo Code (Before Payment) -->
          <div class="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-xl border border-emerald-200 space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>2. Apply Coupon / Discount Code</span>
              </h4>
              ${state.appliedCoupon ? `
                <button type="button" onclick="window.removeCoupon()" class="text-[11px] text-red-600 hover:text-red-700 font-bold flex items-center gap-1 hover:underline">
                  ✕ Remove
                </button>
              ` : ''}
            </div>

            <!-- Coupon Input & Apply Button -->
            <div class="flex gap-2">
              <input type="text" id="coupon-input" placeholder="Enter coupon code (e.g. WELCOME10)" value="${state.appliedCoupon ? state.appliedCoupon.code : ''}" ${state.appliedCoupon ? 'disabled' : ''} class="flex-1 uppercase font-mono font-bold text-xs p-2 bg-white border border-emerald-200 rounded-lg placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              ${state.appliedCoupon ? `
                <div class="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                  ✓ Applied
                </div>
              ` : `
                <button type="button" onclick="window.applyCouponFromInput()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm">
                  Apply
                </button>
              `}
            </div>

            ${state.appliedCoupon ? `
              <div class="p-2.5 bg-white border border-emerald-300 rounded-lg text-xs text-emerald-800 flex items-center justify-between shadow-xs">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[11px]">✓</span>
                  <div>
                    <span class="font-bold text-slate-800 font-mono">${state.appliedCoupon.code}</span>: ${state.appliedCoupon.desc}
                  </div>
                </div>
                <span class="font-bold text-emerald-700 font-mono text-xs">-${formatINR(totals.discount)}</span>
              </div>
            ` : `
              <!-- Quick Coupon Selection Pills -->
              <div class="space-y-1.5 pt-1">
                <p class="text-[11px] font-semibold text-emerald-800">Available Coupons (Click to apply):</p>
                <div class="flex flex-wrap gap-1.5">
                  <button type="button" onclick="window.applyCoupon('WELCOME10')" class="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-[11px] font-bold text-emerald-800 flex items-center gap-1 transition shadow-xs" title="10% off entire order">
                    <span class="font-mono text-emerald-700">WELCOME10</span>
                    <span class="text-[10px] text-slate-500 font-normal">10% OFF</span>
                  </button>
                  <button type="button" onclick="window.applyCoupon('FESTIVE20')" class="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-[11px] font-bold text-emerald-800 flex items-center gap-1 transition shadow-xs" title="20% mega festive discount">
                    <span class="font-mono text-emerald-700">FESTIVE20</span>
                    <span class="text-[10px] text-slate-500 font-normal">20% OFF</span>
                  </button>
                  <button type="button" onclick="window.applyCoupon('FLAT500')" class="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-[11px] font-bold text-emerald-800 flex items-center gap-1 transition shadow-xs" title="Flat ₹500 off on ₹1500+">
                    <span class="font-mono text-emerald-700">FLAT500</span>
                    <span class="text-[10px] text-slate-500 font-normal">₹500 OFF</span>
                  </button>
                  <button type="button" onclick="window.applyCoupon('FREESHIP')" class="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-[11px] font-bold text-emerald-800 flex items-center gap-1 transition shadow-xs" title="Free Delivery">
                    <span class="font-mono text-emerald-700">FREESHIP</span>
                    <span class="text-[10px] text-slate-500 font-normal">Free Ship</span>
                  </button>
                  <button type="button" onclick="window.applyCoupon('MEGA50')" class="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-300 rounded text-[11px] font-bold text-purple-800 flex items-center gap-1 transition shadow-xs" title="50% mega discount">
                    <span class="font-mono text-purple-700">MEGA50</span>
                    <span class="text-[10px] text-purple-500 font-normal">50% OFF</span>
                  </button>
                </div>
              </div>
            `}
          </div>

          <!-- 3. Payment Gateway Selection -->
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold text-slate-800 uppercase">3. Payment Gateway</h4>
              <button type="button" onclick="window.fillDemoCard()" class="text-[11px] text-blue-600 hover:underline font-semibold">Autofill Demo Card</button>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <label class="cursor-pointer border border-blue-500 bg-blue-50/50 p-2.5 rounded-lg flex flex-col items-center text-center">
                <input type="radio" name="paymentMethod" value="Credit Card" checked class="hidden">
                <span class="text-xs font-bold text-blue-900">Credit / Debit</span>
                <span class="text-[10px] text-slate-500">Visa / Mastercard</span>
              </label>
              <label class="cursor-pointer border border-slate-200 bg-white p-2.5 rounded-lg flex flex-col items-center text-center">
                <input type="radio" name="paymentMethod" value="UPI / QR">
                <span class="text-xs font-bold text-slate-700">UPI / QR</span>
                <span class="text-[10px] text-slate-500">Instant App</span>
              </label>
              <label class="cursor-pointer border border-slate-200 bg-white p-2.5 rounded-lg flex flex-col items-center text-center">
                <input type="radio" name="paymentMethod" value="Cash on Delivery">
                <span class="text-xs font-bold text-slate-700">Cash on Delivery</span>
                <span class="text-[10px] text-slate-500">Pay at Door</span>
              </label>
            </div>

            <!-- Card Inputs -->
            <div id="card-inputs" class="space-y-2 text-xs">
              <input type="text" id="card-number" placeholder="Card Number (4242 •••• •••• 4242)" maxlength="19" value="4242 4242 4242 4242" class="w-full p-2 bg-white border border-slate-200 rounded font-mono">
              <div class="grid grid-cols-2 gap-2">
                <input type="text" id="card-exp" placeholder="MM/YY" maxlength="5" value="12/28" class="p-2 bg-white border border-slate-200 rounded font-mono">
                <input type="text" id="card-cvv" placeholder="CVV (123)" maxlength="4" value="882" class="p-2 bg-white border border-slate-200 rounded font-mono">
              </div>
            </div>
          </div>

          <!-- 4. Total Calculation Breakdown -->
          <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
            <div class="flex justify-between text-slate-600">
              <span>Items Subtotal:</span>
              <span class="font-medium text-slate-800">${formatINR(totals.subtotal)}</span>
            </div>
            ${totals.discount > 0 ? `
              <div class="flex justify-between text-emerald-600 font-bold">
                <span>Coupon Discount (${state.appliedCoupon.code}):</span>
                <span>-${formatINR(totals.discount)}</span>
              </div>
            ` : ''}
            <div class="flex justify-between text-slate-600">
              <span>GST (18%):</span>
              <span class="font-medium text-slate-800">${formatINR(totals.tax)}</span>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>Delivery Fee:</span>
              <span class="font-medium text-slate-800">${totals.shipping === 0 ? '<span class="text-emerald-600 font-bold">FREE</span>' : formatINR(totals.shipping)}</span>
            </div>
            <div class="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
              <span>Total Amount to Pay:</span>
              <span class="text-base text-blue-700">${formatINR(totals.total)}</span>
            </div>
          </div>

          <!-- Gateway Spinner and Submit -->
          <button type="submit" id="pay-submit-btn" class="w-full btn-amazon-buy text-sm py-3.5 font-black shadow-md rounded-full">
            Place Order & Pay ${formatINR(totals.total)} &rarr;
          </button>
        </form>
      </div>
    `;

    modal.classList.add('active');
  }

  window.fillDemoCard = function () {
    const num = document.getElementById('card-number');
    const exp = document.getElementById('card-exp');
    const cvv = document.getElementById('card-cvv');
    if (num) num.value = '4242 4242 4242 4242';
    if (exp) exp.value = '08/29';
    if (cvv) cvv.value = '321';
    showToast('Demo payment credentials populated.', 'info');
  };

  window.processOrderCheckout = async function (e) {
    e.preventDefault();
    const btn = document.getElementById('pay-submit-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⚙️</span> Processing with Payment Gateway...`;

    const shipName = document.getElementById('ship-name').value;
    const shipPhone = document.getElementById('ship-phone').value;
    const shipStreet = document.getElementById('ship-street').value;
    const shipCity = document.getElementById('ship-city').value;
    const shipZip = document.getElementById('ship-zip').value;

    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Credit Card';
    const cardNum = document.getElementById('card-number')?.value || '';
    const cardLast4 = cardNum.replace(/\s/g, '').slice(-4) || '4242';

    try {
      // Simulate 1 second payment gateway handshake
      await new Promise(r => setTimeout(r, 900));

      const payload = {
        items: state.cart,
        shippingAddress: {
          name: shipName,
          phone: shipPhone,
          street: shipStreet,
          city: shipCity,
          zip: shipZip
        },
        paymentDetails: {
          method: paymentMethod,
          cardLast4: cardLast4
        },
        couponCode: state.appliedCoupon ? state.appliedCoupon.code : null
      };

      const res = await api('/api/orders/place', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Clear cart and applied coupon
      state.cart = [];
      state.appliedCoupon = null;
      saveCart();
      renderCart();

      // Show Order Success screen
      renderOrderSuccessModal(res.order, res.payment);
      showToast('Order confirmed! Confirmation email dispatched.', 'success');
      await loadProducts();
      await loadEmails();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `Authorize & Pay &rarr;`;
      showToast(err.message, 'error');
    }
  };

  function renderOrderSuccessModal(order, payment) {
    const content = document.getElementById('checkout-modal-content');
    content.innerHTML = `
      <div class="text-center space-y-4 py-4">
        <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto font-black shadow-inner">
          ✓
        </div>
        <div>
          <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider">Payment Gateway Confirmed</span>
          <h3 class="text-2xl font-black text-slate-900 mt-1">Order #${order.id} Placed!</h3>
          <p class="text-xs text-slate-500 mt-1">Thank you ${escapeHtml(order.customerName)}. An official receipt was sent to <strong>${escapeHtml(order.customerEmail)}</strong>.</p>
        </div>

        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-xs space-y-2">
          <div class="flex justify-between">
            <span class="text-slate-500">Gateway Transaction:</span>
            <span class="font-mono font-bold text-slate-800">${payment.gatewayRef}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Tracking Number:</span>
            <span class="font-mono font-bold text-blue-600">${order.trackingNumber}</span>
          </div>
          ${order.discount > 0 ? `
            <div class="flex justify-between text-emerald-600 font-bold">
              <span>Coupon Discount (${escapeHtml(order.coupon || 'PROMO')}):</span>
              <span>-${formatINR(order.discount)}</span>
            </div>
          ` : ''}
          <div class="flex justify-between">
            <span class="text-slate-500">Total Paid:</span>
            <span class="font-bold text-slate-900">${formatINR(order.totalAmount)} (${order.paymentMethod})</span>
          </div>
        </div>

        <div class="flex gap-2 pt-2">
          <button onclick="window.closeModals(); window.trackOrderById('${order.id}')" class="flex-1 btn-primary text-xs py-2.5 font-bold">
            Track Shipment Status Live &rarr;
          </button>
          <button onclick="window.closeModals(); window.openMailbox()" class="btn-secondary text-xs py-2.5">
            Inspect Receipt Email
          </button>
        </div>
      </div>
    `;
  }

  // ==========================================
  // ORDER TRACKING & CANCELLATION
  // (Track Order + Update Delivery Status + Cancel Order)
  // ==========================================

  // ==========================================
  // RETURNS & ORDERS HUB
  // (Order History + Return/Replace Items + Live Tracking)
  // ==========================================

  window.openTrackOrderModal = async function (activeTab = 'orders', targetOrderId = null) {
    const modal = document.getElementById('tracking-modal');
    const content = document.getElementById('tracking-modal-content');
    if (!modal || !content) return;

    modal.classList.add('active');

    // Show loading state while fetching orders
    content.innerHTML = `
      <div class="py-12 text-center text-slate-500 space-y-3">
        <div class="w-8 h-8 border-3 border-[#f05d5e] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-xs font-semibold">Loading your orders and return status...</p>
      </div>
    `;

    try {
      const data = await api('/api/orders').catch(() => ({ orders: [] }));
      const orders = data.orders || [];
      renderReturnsAndOrdersModal(activeTab, targetOrderId, orders);
    } catch {
      renderReturnsAndOrdersModal(activeTab, targetOrderId, []);
    }
  };

  window.openReturnModal = function (orderId) {
    window.openTrackOrderModal('return', orderId);
  };

  function renderReturnsAndOrdersModal(activeTab, targetOrderId, orders) {
    const content = document.getElementById('tracking-modal-content');
    if (!content) return;

    // Header with Amazon-style Navigation Tabs
    const html = `
      <div class="space-y-5">
        <!-- Modal Top Bar -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div class="flex items-center gap-2">
            <span class="text-xl">📦</span>
            <div>
              <h3 class="font-extrabold text-slate-900 text-lg leading-tight">Returns & Orders</h3>
              <p class="text-xs text-slate-500">Track shipments, return or replace delivered products, and check refunds</p>
            </div>
          </div>
          <button onclick="window.closeModals()" class="text-slate-400 hover:text-slate-700 text-xl font-bold p-1">&times;</button>
        </div>

        <!-- 3 Tabs Navigation -->
        <div class="flex items-center gap-2 border-b border-slate-200 text-xs font-bold">
          <button type="button" onclick="window.switchReturnsTab('orders')" class="px-3.5 py-2 border-b-2 transition ${activeTab === 'orders' ? 'border-[#f05d5e] text-[#1d2a25] font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}">
            📦 Your Orders (${orders.length})
          </button>
          <button type="button" onclick="window.switchReturnsTab('return')" class="px-3.5 py-2 border-b-2 transition ${activeTab === 'return' ? 'border-[#f05d5e] text-[#1d2a25] font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}">
            🔄 Return or Replace Items
          </button>
          <button type="button" onclick="window.switchReturnsTab('track')" class="px-3.5 py-2 border-b-2 transition ${activeTab === 'track' ? 'border-[#f05d5e] text-[#1d2a25] font-black' : 'border-transparent text-slate-500 hover:text-slate-800'}">
            🚚 Track by Order ID
          </button>
        </div>

        <!-- Tab Body -->
        <div id="returns-tab-body">
          ${renderReturnsTabBody(activeTab, targetOrderId, orders)}
        </div>
      </div>
    `;

    content.innerHTML = html;
  }

  window.switchReturnsTab = async function (tab, targetOrderId = null) {
    try {
      const data = await api('/api/orders').catch(() => ({ orders: [] }));
      const orders = data.orders || [];
      const body = document.getElementById('returns-tab-body');
      if (body) {
        body.innerHTML = renderReturnsTabBody(tab, targetOrderId, orders);
      } else {
        renderReturnsAndOrdersModal(tab, targetOrderId, orders);
      }
    } catch (err) {
      console.error(err);
    }
  };

  function renderReturnsTabBody(tab, targetOrderId, orders) {
    if (tab === 'orders') {
      return renderYourOrdersList(orders);
    } else if (tab === 'return') {
      return renderReturnRequestForm(orders, targetOrderId);
    } else {
      return renderTrackByIdInput();
    }
  }

  function renderYourOrdersList(orders) {
    if (!orders || !orders.length) {
      return `
        <div class="py-12 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div class="text-3xl">📦</div>
          <h4 class="font-bold text-slate-800 text-sm">No orders found</h4>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">You haven't placed any orders recently. Explore deals on our storefront or track a package by ID.</p>
          <div class="pt-2 flex justify-center gap-2">
            <button onclick="window.closeModals(); window.switchTab('store');" class="btn-amazon-cart text-xs py-2 px-4 font-bold">
              Start Shopping &rarr;
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        ${orders.map(order => {
          const isDelivered = order.orderStatus === 'delivered';
          const hasReturn = Boolean(order.returnInfo);
          const isCancelled = order.orderStatus === 'cancelled';

          return `
            <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:shadow-xs transition">
              <!-- Order Header Strip (Amazon Style) -->
              <div class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                <div class="flex items-center gap-4 sm:gap-6">
                  <div>
                    <div class="text-[10px] text-slate-400 uppercase font-semibold">Order Placed</div>
                    <div class="font-bold text-slate-800">${new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400 uppercase font-semibold">Total</div>
                    <div class="font-extrabold text-slate-900">${formatINR(order.totalAmount)}</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400 uppercase font-semibold">Ship To</div>
                    <div class="font-medium text-slate-800 truncate max-w-[120px]">${escapeHtml(order.customerName || 'Customer')}</div>
                  </div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-400 uppercase font-semibold text-right">Order #</div>
                  <strong class="font-mono text-slate-900">${order.id}</strong>
                </div>
              </div>

              <!-- Order Body -->
              <div class="p-4 space-y-4">
                <!-- Status Badge -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    ${hasReturn ? `
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-xs border border-amber-300">
                        <span>🔄</span> Return Initiated (${escapeHtml(order.returnInfo.returnId)})
                      </span>
                    ` : isDelivered ? `
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs border border-emerald-300">
                        <span>✓</span> Delivered &bull; Return window open
                      </span>
                    ` : isCancelled ? `
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-900 font-bold text-xs border border-red-200">
                        Cancelled &bull; Refund processed
                      </span>
                    ` : `
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 font-bold text-xs border border-blue-200">
                        <span>🚚</span> In Transit &bull; ${escapeHtml(order.orderStatus.replace(/_/g, ' '))}
                      </span>
                    `}
                  </div>
                  <span class="text-[11px] text-slate-400">Carrier: ${escapeHtml(order.deliveryPartner || 'Express')}</span>
                </div>

                <!-- Return Info Box if active -->
                ${hasReturn ? `
                  <div class="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-1">
                    <div class="flex items-center justify-between font-bold">
                      <span>Pickup Scheduled: ${escapeHtml(order.returnInfo.pickupSlot)}</span>
                      <span class="text-emerald-800">${order.returnInfo.resolution === 'replace' ? 'Replacement Dispatched' : 'Full Refund: ' + formatINR(order.returnInfo.refundAmount || order.totalAmount)}</span>
                    </div>
                    <p class="text-[11px] text-amber-800">Reason: ${escapeHtml(order.returnInfo.reason)}</p>
                  </div>
                ` : ''}

                <!-- Items Preview -->
                <div class="space-y-2">
                  ${order.items.map(item => `
                    <div class="flex items-center gap-3">
                      <div class="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden p-1 flex items-center justify-center">
                        <img src="${item.image || 'https://picsum.photos/seed/novamart-static-1/800/800'}" alt="${escapeHtml(item.name)}" class="w-full h-full object-contain">
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-slate-900 truncate">${escapeHtml(item.name)}</p>
                        <p class="text-[11px] text-slate-500">Qty: ${item.quantity} &bull; ${formatINR(item.price)} each</p>
                      </div>
                    </div>
                  `).join('')}
                </div>

                <!-- Action Buttons Strip -->
                <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-2">
                    <button type="button" onclick="window.trackOrderById('${order.id}')" class="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 font-bold text-slate-800">
                      Track Package
                    </button>
                    ${hasReturn ? `
                      <button type="button" onclick="window.viewReturnDetails('${order.id}')" class="px-3.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 font-bold border border-amber-300 hover:bg-amber-200">
                        View Return Details
                      </button>
                    ` : isDelivered ? `
                      <button type="button" onclick="window.openReturnModal('${order.id}')" class="btn-amazon-cart px-3.5 py-1.5 font-bold shadow-xs">
                        🔄 Return or Replace Items
                      </button>
                    ` : !isCancelled ? `
                      <button type="button" onclick="window.openReturnModal('${order.id}')" class="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 font-bold text-slate-700">
                        Return / Replace
                      </button>
                    ` : ''}
                  </div>
                  <div>
                    ${!isCancelled && !isDelivered && !hasReturn ? `
                      <button type="button" onclick="window.cancelCustomerOrder('${order.id}')" class="text-xs text-red-600 hover:underline font-semibold">
                        Cancel Order
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderReturnRequestForm(orders, preselectedOrderId) {
    const eligibleOrders = (orders || []).filter(o => o.orderStatus !== 'cancelled');
    if (!eligibleOrders.length) {
      return `
        <div class="py-12 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div class="text-3xl">🔄</div>
          <h4 class="font-bold text-slate-800 text-sm">No eligible orders for return</h4>
          <p class="text-xs text-slate-500 max-w-sm mx-auto">You do not have any delivered or active orders eligible for return at the moment.</p>
          <button onclick="window.switchReturnsTab('orders')" class="btn-primary text-xs py-2 px-4 font-bold">
            View All Orders
          </button>
        </div>
      `;
    }

    const selectedOrder = eligibleOrders.find(o => o.id === preselectedOrderId) || eligibleOrders[0];

    return `
      <form onsubmit="window.submitReturnRequest(event, '${selectedOrder.id}')" class="space-y-4 max-h-[62vh] overflow-y-auto pr-1 text-xs">
        <!-- Selected Order Banner -->
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div>
            <div class="text-[10px] text-amber-800 uppercase font-extrabold">Returning Items From</div>
            <div class="font-black text-slate-900 text-sm">Order #${selectedOrder.id} &bull; ${formatINR(selectedOrder.totalAmount)}</div>
            <div class="text-[11px] text-slate-600">${selectedOrder.items.map(i => `${escapeHtml(i.name)} (${i.quantity})`).join(', ')}</div>
          </div>
          ${eligibleOrders.length > 1 ? `
            <select onchange="window.switchReturnsTab('return', this.value)" class="text-xs p-1.5 bg-white border border-amber-300 rounded-lg font-bold text-slate-800 focus:outline-none">
              ${eligibleOrders.map(o => `
                <option value="${o.id}" ${o.id === selectedOrder.id ? 'selected' : ''}>Switch to #${o.id}</option>
              `).join('')}
            </select>
          ` : ''}
        </div>

        <!-- Step 1: Reason for return -->
        <div class="space-y-1.5">
          <label class="font-bold text-slate-800 text-xs">1. Why are you returning this item?</label>
          <select id="return-reason" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#f05d5e]">
            <option value="">-- Select a return reason --</option>
            <option value="Defective or does not work properly">Defective or does not work properly</option>
            <option value="Wrong item or size delivered">Wrong item or size delivered</option>
            <option value="Item arrived damaged or in poor condition">Item arrived damaged or in poor condition</option>
            <option value="Missing parts or accessories">Missing parts or accessories</option>
            <option value="Performance or quality not adequate">Performance or quality not adequate</option>
            <option value="Different from website description">Different from website description</option>
            <option value="Better price available elsewhere">Better price available elsewhere</option>
            <option value="Changed mind / No longer needed">Changed mind / No longer needed</option>
          </select>
        </div>

        <!-- Step 2: Choose Resolution (Refund or Replacement) -->
        <div class="space-y-2">
          <label class="font-bold text-slate-800 text-xs">2. Choose your return resolution</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-[#f05d5e] cursor-pointer">
              <input type="radio" name="return_resolution" value="refund" checked class="mt-0.5 text-[#f05d5e] focus:ring-[#f05d5e]">
              <div>
                <strong class="text-slate-900 block font-bold">Refund to Bank / Original Payment</strong>
                <span class="text-[11px] text-slate-500">Full refund of ${formatINR(selectedOrder.totalAmount)} credited within 2-4 business days of pickup</span>
              </div>
            </label>
            <label class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-[#f05d5e] cursor-pointer">
              <input type="radio" name="return_resolution" value="replace" class="mt-0.5 text-[#f05d5e] focus:ring-[#f05d5e]">
              <div>
                <strong class="text-slate-900 block font-bold">Free Replacement Unit</strong>
                <span class="text-[11px] text-slate-500">A brand new replacement item will be dispatched immediately at zero extra cost</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Step 3: Doorstep Pickup Details -->
        <div class="space-y-2.5">
          <label class="font-bold text-slate-800 text-xs">3. Doorstep Pickup Schedule & Address</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span class="text-[11px] text-slate-500 font-semibold">Preferred Pickup Slot</span>
              <select id="return-slot" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#f05d5e]">
                <option value="Tomorrow, 9:00 AM - 1:00 PM (Express)">Tomorrow, 9:00 AM - 1:00 PM (Express)</option>
                <option value="Tomorrow, 2:00 PM - 6:00 PM">Tomorrow, 2:00 PM - 6:00 PM</option>
                <option value="Day after tomorrow, 10:00 AM - 2:00 PM">Day after tomorrow, 10:00 AM - 2:00 PM</option>
              </select>
            </div>
            <div>
              <span class="text-[11px] text-slate-500 font-semibold">Pickup Address</span>
              <input type="text" id="return-address" value="${typeof selectedOrder.shippingAddress === 'object' ? `${selectedOrder.shippingAddress.street || ''}, ${selectedOrder.shippingAddress.city || ''} ${selectedOrder.shippingAddress.zip || ''}` : selectedOrder.shippingAddress}" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#f05d5e]">
            </div>
          </div>
          <div>
            <span class="text-[11px] text-slate-500 font-semibold">Additional Comments (Optional)</span>
            <input type="text" id="return-comments" placeholder="e.g. Left earcup sound crackling / packaging is intact" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          </div>
        </div>

        <!-- Policy Banner -->
        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 flex items-center gap-2">
          <span>🛡️</span>
          <span><strong>NovaMart 7-Day Guarantee:</strong> Free doorstep pickup &bull; Zero return fees &bull; Instant refund processing once collected</span>
        </div>

        <!-- Submit Button -->
        <div class="pt-2">
          <button type="submit" class="w-full btn-amazon-cart py-2.5 font-black text-xs shadow-md">
            Confirm Return & Schedule Free Pickup &rarr;
          </button>
        </div>
      </form>
    `;
  }

  function renderTrackByIdInput() {
    return `
      <div class="py-4 space-y-4">
        <p class="text-xs text-slate-600 leading-relaxed">
          Enter an <strong>Order ID</strong> (e.g. <code class="bg-slate-100 px-1 py-0.5 rounded text-blue-600">ORD-9821</code>) or a <strong>Return Authorization ID</strong> to track real-time logistics milestones, doorstep pickup schedule, and refund disbursements.
        </p>
        <div class="flex gap-2">
          <input type="text" id="track-id-input" placeholder="e.g. ORD-9821 or RET-..." class="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f05d5e]">
          <button type="button" onclick="window.trackOrderById(document.getElementById('track-id-input').value)" class="btn-primary text-xs py-2 px-5 font-bold">
            Search
          </button>
        </div>
        <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
          <span>Need to check recent delivered orders?</span>
          <button type="button" onclick="window.switchReturnsTab('orders')" class="text-blue-700 underline font-bold hover:text-blue-900">
            View Your Orders &rarr;
          </button>
        </div>
      </div>
    `;
  }

  window.submitReturnRequest = async function (event, orderId) {
    event.preventDefault();
    const reason = document.getElementById('return-reason')?.value;
    const resolution = document.querySelector('input[name="return_resolution"]:checked')?.value || 'refund';
    const pickupSlot = document.getElementById('return-slot')?.value;
    const pickupAddress = document.getElementById('return-address')?.value;
    const comments = document.getElementById('return-comments')?.value;

    if (!reason) {
      showToast('Please select a return reason.', 'error');
      return;
    }

    try {
      const data = await api(`/api/orders/${orderId}/return`, {
        method: 'POST',
        body: JSON.stringify({ reason, resolution, pickupSlot, pickupAddress, comments })
      });

      showToast(`Return #${data.returnRecord.returnId} confirmed! Pickup scheduled.`, 'success');
      await loadEmails(); // Update simulated mailbox count

      // Display Return Confirmation Pass
      const body = document.getElementById('returns-tab-body');
      if (body) {
        body.innerHTML = `
          <div class="py-6 text-center space-y-4">
            <div class="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold border border-emerald-300">
              ✓
            </div>
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">Return Confirmed</span>
              <h3 class="text-xl font-black text-slate-900 mt-2">Return Request #${data.returnRecord.returnId}</h3>
              <p class="text-xs text-slate-500 mt-1">A confirmation acknowledgement email has been dispatched to your email address.</p>
            </div>

            <div class="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-left space-y-2">
              <div class="flex justify-between">
                <span class="text-slate-500">Order ID:</span>
                <strong class="font-mono text-slate-900">${orderId}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Return Resolution:</span>
                <strong class="text-emerald-700">${resolution === 'replace' ? 'Free Replacement Unit' : 'Full Refund: ' + formatINR(data.order.totalAmount)}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Scheduled Pickup Slot:</span>
                <strong class="text-blue-700">${escapeHtml(pickupSlot)}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Pickup Location:</span>
                <span class="font-semibold text-slate-800 text-right max-w-[200px] truncate">${escapeHtml(pickupAddress)}</span>
              </div>
            </div>

            <div class="pt-2 flex justify-center gap-3">
              <button type="button" onclick="window.trackOrderById('${orderId}')" class="btn-primary text-xs py-2 px-4 font-bold">
                Track Live Status
              </button>
              <button type="button" onclick="window.switchReturnsTab('orders')" class="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-800">
                Back to Your Orders
              </button>
            </div>
          </div>
        `;
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.viewReturnDetails = function (orderId) {
    window.trackOrderById(orderId);
  };

  window.trackOrderById = async function (orderId) {
    if (!orderId) return;
    try {
      const data = await api(`/api/orders/${encodeURIComponent(orderId.trim())}`);
      renderOrderTrackingView(data.order);
    } catch (err) {
      showToast(err.message || 'Order not found.', 'error');
    }
  };

  function renderOrderTrackingView(order) {
    const modal = document.getElementById('tracking-modal');
    const content = document.getElementById('tracking-modal-content');

    const steps = [
      { key: 'placed', label: 'Order Placed' },
      { key: 'confirmed', label: 'Payment Confirmed' },
      { key: 'processing', label: 'Processing at Hub' },
      { key: 'shipped', label: 'In Transit' },
      { key: 'out_for_delivery', label: 'Out for Delivery' },
      { key: 'delivered', label: 'Delivered' }
    ];

    const currentIdx = steps.findIndex(s => s.key === order.orderStatus);
    const isCancelled = order.orderStatus === 'cancelled';
    const hasReturn = Boolean(order.returnInfo);

    content.innerHTML = `
      <div class="relative space-y-5">
        <div class="flex items-center justify-between pb-2 border-b border-slate-200">
          <button onclick="window.openTrackOrderModal('orders')" class="text-xs text-[#2f6f61] hover:underline font-bold flex items-center gap-1">
            &larr; Back to Returns & Orders
          </button>
          <button onclick="window.closeModals()" class="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
        </div>
        
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span class="text-xs font-bold text-blue-600 uppercase">Live Carrier Status</span>
            <h3 class="text-xl font-black text-slate-900">Order #${order.id}</h3>
            <p class="text-xs text-slate-500">Carrier: <strong>${escapeHtml(order.deliveryPartner || 'Express Logistics')}</strong> &bull; Tracking: <strong class="font-mono text-blue-600">${order.trackingNumber}</strong></p>
          </div>
          <div>
            ${hasReturn ? `
              <span class="px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-xs border border-amber-300">
                🔄 Return: ${escapeHtml(order.returnInfo.returnId)}
              </span>
            ` : ''}
          </div>
        </div>

        ${hasReturn ? `
          <!-- Return Status Milestone Banner -->
          <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-2">
            <div class="flex items-center justify-between font-bold">
              <span class="text-amber-900 flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                Doorstep Return Pickup Scheduled
              </span>
              <span class="text-emerald-700 font-extrabold">${order.returnInfo.resolution === 'replace' ? 'Free Replacement Dispatched' : 'Refund: ' + formatINR(order.returnInfo.refundAmount || order.totalAmount)}</span>
            </div>
            <p class="text-[11px] text-amber-800">
              Pickup Slot: <strong>${escapeHtml(order.returnInfo.pickupSlot)}</strong> &bull; Location: ${escapeHtml(typeof order.returnInfo.pickupAddress === 'object' ? `${order.returnInfo.pickupAddress.street || ''}, ${order.returnInfo.pickupAddress.city || ''}` : order.returnInfo.pickupAddress)}
            </p>
            <p class="text-[10px] text-slate-500">Reason: ${escapeHtml(order.returnInfo.reason)}</p>
          </div>
        ` : ''}

        ${isCancelled ? `
          <div class="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            <strong>Order Status: CANCELLED</strong><br>
            Inventory has been restored and payment marked as refunded.
          </div>
        ` : `
          <!-- Visual Timeline -->
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h4 class="text-xs font-bold text-slate-800 uppercase">Logistics & Tracking Milestones</h4>
            <div class="space-y-0">
              ${order.trackingHistory.map((h, i) => `
                <div class="timeline-step completed">
                  <div class="timeline-dot">✓</div>
                  <div>
                    <div class="flex items-center justify-between">
                      <p class="text-xs font-bold text-slate-800 uppercase">${h.status.replace(/_/g, ' ')}</p>
                      <span class="text-[10px] text-slate-400">${new Date(h.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p class="text-xs text-slate-600">${escapeHtml(h.note)}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">Location: ${escapeHtml(h.location)}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `}

        <!-- Order Items Summary -->
        <div class="border-t border-slate-200 pt-3 text-xs space-y-2">
          <p class="font-bold text-slate-800">Items Ordered (${order.items.length})</p>
          ${order.items.map(i => `
            <div class="flex justify-between items-center text-slate-600">
              <span>${escapeHtml(i.name)} &times; ${i.quantity}</span>
              <span class="font-semibold text-slate-900">${formatINR(i.price * i.quantity)}</span>
            </div>
          `).join('')}
          ${order.discount > 0 ? `
            <div class="flex justify-between items-center text-emerald-600 font-semibold">
              <span>Coupon Discount (${escapeHtml(order.coupon || 'PROMO')}):</span>
              <span>-${formatINR(order.discount)}</span>
            </div>
          ` : ''}
          <div class="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-100">
            <span>Total:</span>
            <span>${formatINR(order.totalAmount)}</span>
          </div>
        </div>

        <!-- Return / Cancel Actions -->
        <div class="pt-2 flex flex-wrap items-center justify-between gap-2">
          ${!hasReturn && order.orderStatus === 'delivered' ? `
            <button onclick="window.openReturnModal('${order.id}')" class="btn-amazon-cart text-xs py-2 px-5 font-black shadow-xs">
              🔄 Return or Replace Items
            </button>
          ` : !hasReturn && !isCancelled ? `
            <button onclick="window.openReturnModal('${order.id}')" class="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-800">
              🔄 Request Return / Replacement
            </button>
          ` : ''}

          ${!isCancelled && order.orderStatus !== 'delivered' && !hasReturn ? `
            <button onclick="window.cancelCustomerOrder('${order.id}')" class="py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition">
              Cancel Order & Refund
            </button>
          ` : ''}
        </div>
      </div>
    `;

    modal.classList.add('active');
  }

  window.cancelCustomerOrder = async function (orderId) {
    if (!confirm('Are you sure you want to cancel this order? Stock will be restored and payment refunded.')) return;
    try {
      await api(`/api/orders/${orderId}/cancel`, { method: 'POST' });
      showToast('Order cancelled. Refund initiated & confirmation email sent.', 'success');
      window.trackOrderById(orderId);
      await loadProducts();
      await loadEmails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ==========================================
  // ADMIN CONTROL PANEL
  // (Manage Customers, Products, Categories, Orders, Payments, Reports)
  // ==========================================

  window.setAdminTab = async function (tab) {
    state.adminTab = tab;
    const tabs = ['customers', 'orders', 'products', 'categories', 'payments', 'reports'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const view = document.getElementById(`admin-subview-${t}`);
      if (btn && view) {
        if (t === tab) {
          btn.classList.add('border-blue-600', 'text-blue-600');
          btn.classList.remove('border-transparent', 'text-slate-600');
          view.classList.remove('hidden');
        } else {
          btn.classList.remove('border-blue-600', 'text-blue-600');
          btn.classList.add('border-transparent', 'text-slate-600');
          view.classList.add('hidden');
        }
      }
    });

    if (tab === 'customers') await loadAdminCustomers();
    if (tab === 'orders') await loadAdminOrders();
    if (tab === 'products') await loadAdminProducts();
    if (tab === 'categories') await loadAdminCategories();
    if (tab === 'payments') await loadAdminPayments();
    if (tab === 'reports') await loadAdminReports();
  };

  // 1. Manage Customers, Users & Registration Settings
  async function loadAdminCustomers() {
    try {
      const data = await api('/api/admin/customers');
      state.customers = data.customers || [];
      if (data.settings) {
        state.registrationSettings = data.settings;
        syncRegistrationSettingsUI();
      }
      renderAdminCustomers();
      updatePendingCounters();
    } catch (err) {
      console.error('Failed to load customers', err);
    }
  }

  function syncRegistrationSettingsUI() {
    const allowEl = document.getElementById('setting-allow-registration');
    const approvalEl = document.getElementById('setting-require-approval');
    if (allowEl) allowEl.checked = state.registrationSettings.allowPublicRegistration !== false;
    if (approvalEl) approvalEl.checked = state.registrationSettings.requireAdminApproval !== false;
  }

  window.adminToggleSetting = async function (key, value) {
    try {
      const res = await api('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ [key]: Boolean(value) })
      });
      if (res.settings) {
        state.registrationSettings = res.settings;
        syncRegistrationSettingsUI();
      }
      showToast(res.message || 'Registration setting updated.', 'success');
    } catch (err) {
      syncRegistrationSettingsUI();
      showToast(err.message, 'error');
    }
  };

  window.openAddUserModal = function () {
    const modal = document.getElementById('admin-user-modal');
    const content = document.getElementById('admin-user-modal-content');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 class="font-bold text-slate-900 text-base">Register New User</h3>
            <p class="text-xs text-slate-500">Create a new customer or administrator account directly.</p>
          </div>
          <button onclick="window.closeModals()" class="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
        </div>

        <form onsubmit="window.saveAdminNewUser(event)" class="space-y-3 text-xs">
          <div>
            <label class="font-semibold text-slate-700">Full Name</label>
            <input type="text" id="admin-u-name" required placeholder="e.g. Priya Nair" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
          </div>
          <div>
            <label class="font-semibold text-slate-700">Email Address</label>
            <input type="email" id="admin-u-email" required placeholder="priya@example.com" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
          </div>
          <div>
            <label class="font-semibold text-slate-700">Password</label>
            <div class="relative mt-1">
              <input type="password" id="admin-u-password" required minlength="4" placeholder="Enter password" class="w-full p-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg">
              <button type="button" id="admin-u-password-toggle" onclick="window.togglePasswordVisibility('admin-u-password', 'admin-u-password-toggle')" class="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400 hover:text-slate-600" title="Show password">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-semibold text-slate-700">Role</label>
              <select id="admin-u-role" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold">
                <option value="customer">Customer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label class="font-semibold text-slate-700">Initial Status</label>
              <select id="admin-u-status" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold">
                <option value="approved">Approved (Active)</option>
                <option value="pending_approval">Pending Approval</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-semibold text-slate-700">Phone</label>
              <input type="text" id="admin-u-phone" placeholder="+91 98765 43210" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
            </div>
            <div>
              <label class="font-semibold text-slate-700">City / State</label>
              <input type="text" id="admin-u-city" placeholder="Bengaluru, Karnataka" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
            </div>
          </div>
          <div class="pt-2 flex justify-end gap-2">
            <button type="button" onclick="window.closeModals()" class="btn-secondary text-xs">Cancel</button>
            <button type="submit" class="btn-primary text-xs font-bold">Register User</button>
          </div>
        </form>
      </div>
    `;

    modal.classList.add('active');
  };

  window.saveAdminNewUser = async function (e) {
    e.preventDefault();
    const name = document.getElementById('admin-u-name').value;
    const email = document.getElementById('admin-u-email').value;
    const password = document.getElementById('admin-u-password').value;
    const role = document.getElementById('admin-u-role').value;
    const status = document.getElementById('admin-u-status').value;
    const phone = document.getElementById('admin-u-phone').value;
    const city = document.getElementById('admin-u-city').value;

    try {
      const res = await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role, status, phone, address: { city } })
      });
      showToast(res.message || 'User registered successfully!', 'success');
      window.closeModals();
      await loadAdminCustomers();
      await loadEmails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  function updatePendingCounters() {
    const pendingCount = state.customers.filter(c => c.status === 'pending_approval').length;
    const badge = document.getElementById('pending-badge');
    const adminBadge = document.getElementById('admin-pending-count');
    const chip = document.getElementById('cust-pending-chip');

    if (badge) {
      badge.innerText = pendingCount;
      badge.classList.toggle('hidden', pendingCount === 0);
    }
    if (adminBadge) adminBadge.innerText = pendingCount;
    if (chip) chip.innerText = pendingCount;
  }

  window.filterCustomers = function (status) {
    state.customerFilter = status;
    const buttons = ['all', 'pending_approval', 'approved', 'rejected'];
    buttons.forEach(b => {
      const btn = document.getElementById(b === 'all' ? 'btn-cust-all' : (b === 'pending_approval' ? 'btn-cust-pending' : `btn-cust-${b}`));
      if (btn) {
        if (b === status) {
          btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white';
        } else {
          btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200';
        }
      }
    });
    renderAdminCustomers();
  };

  function renderAdminCustomers() {
    const tbody = document.getElementById('customers-table-body');
    if (!tbody) return;

    let list = state.customers;
    if (state.customerFilter !== 'all') {
      list = list.filter(c => c.status === state.customerFilter);
    }

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400">No customers found under this filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(c => {
      const isPending = c.status === 'pending_approval';
      const isApproved = c.status === 'approved';
      const isRejected = c.status === 'rejected';

      let statusBadge = '';
      if (isPending) statusBadge = `<span class="badge badge-pending pulse-badge">Pending Verification</span>`;
      if (isApproved) statusBadge = `<span class="badge badge-approved">Approved</span>`;
      if (isRejected) statusBadge = `<span class="badge badge-rejected">Rejected</span>`;

      const isAdminUser = c.role === 'admin';
      const isProtected = c.id === 'usr_admin' || c.id === state.user?.id;

      return `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="px-6 py-4">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-900">${escapeHtml(c.name)}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${isAdminUser ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-600'}">${escapeHtml(c.role)}</span>
            </div>
            <div class="text-xs text-slate-500 font-mono">${escapeHtml(c.email)}</div>
            ${c.phone ? `<div class="text-[11px] text-slate-400">${escapeHtml(c.phone)}</div>` : ''}
          </td>
          <td class="px-6 py-4 text-xs text-slate-500">
            ${new Date(c.createdAt).toLocaleDateString()}
          </td>
          <td class="px-6 py-4">
            ${statusBadge}
          </td>
          <td class="px-6 py-4 text-xs">
            <span class="font-bold text-slate-800">${c.orderCount} orders</span>
            <div class="text-slate-500">${formatINR(c.totalSpent)} total</div>
          </td>
          <td class="px-6 py-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              ${isPending ? `
                <button onclick="window.adminApproveCustomer('${c.id}')" class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition">
                  ✓ Approve (Send Email)
                </button>
                <button onclick="window.adminSendVerificationEmail('${c.id}')" class="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold" title="Send email verification token link">
                  ✉ Send Link
                </button>
                <button onclick="window.adminRejectCustomer('${c.id}')" class="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold">
                  Reject
                </button>
              ` : `
                ${isApproved ? `
                  <button onclick="window.adminSendVerificationEmail('${c.id}')" class="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs">
                    Resend Email
                  </button>
                ` : `
                  <button onclick="window.adminApproveCustomer('${c.id}')" class="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-xs font-semibold">
                    Re-Approve
                  </button>
                `}
                ${!isProtected ? `
                  <button onclick="window.adminDeleteCustomer('${c.id}')" class="p-1 text-slate-400 hover:text-red-500 text-xs" title="Delete user">
                    ✕
                  </button>
                ` : ''}
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Admin Actions for Customers
  window.adminApproveCustomer = async function (customerId) {
    try {
      const res = await api(`/api/admin/customers/${customerId}/approve`, { method: 'POST' });
      showToast(res.message, 'success');
      await loadAdminCustomers();
      await loadEmails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.adminSendVerificationEmail = async function (customerId) {
    try {
      const res = await api(`/api/admin/customers/${customerId}/send-verification-email`, { method: 'POST' });
      showToast(res.message, 'success');
      await loadEmails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.adminRejectCustomer = async function (customerId) {
    const reason = prompt('Please enter the rejection reason for this customer:', 'Incomplete registration details or invalid email address.');
    if (reason === null) return;
    try {
      const res = await api(`/api/admin/customers/${customerId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      showToast(res.message, 'warning');
      await loadAdminCustomers();
      await loadEmails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.adminDeleteCustomer = async function (customerId) {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    try {
      await api(`/api/admin/customers/${customerId}`, { method: 'DELETE' });
      showToast('Customer deleted.', 'info');
      await loadAdminCustomers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 2. Manage Orders (Admin + Delivery Service)
  async function loadAdminOrders() {
    try {
      const data = await api('/api/orders');
      state.orders = data.orders || [];
      renderAdminOrders();
    } catch (err) {
      console.error('Failed to load orders', err);
    }
  }

  function renderAdminOrders() {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;

    if (!state.orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">No orders placed yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.orders.map(o => `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-4 font-mono font-bold text-xs text-blue-600">
          <a href="#" onclick="window.trackOrderById('${o.id}'); return false;" class="hover:underline">${o.id}</a>
        </td>
        <td class="px-6 py-4">
          <div class="font-bold text-slate-800 text-xs">${escapeHtml(o.customerName)}</div>
          <div class="text-[11px] text-slate-400">${escapeHtml(o.customerEmail)}</div>
        </td>
        <td class="px-6 py-4 text-xs text-slate-600">
          ${o.items.map(i => `${escapeHtml(i.name)} (${i.quantity})`).join(', ')}
        </td>
        <td class="px-6 py-4 font-bold text-xs text-slate-900">
          <div>${formatINR(o.totalAmount)}</div>
          ${o.discount > 0 ? `<div class="text-[10px] text-emerald-600 font-semibold">-${formatINR(o.discount)} (${escapeHtml(o.coupon || 'PROMO')})</div>` : ''}
        </td>
        <td class="px-6 py-4">
          <span class="badge ${o.orderStatus === 'delivered' ? 'badge-approved' : (o.orderStatus === 'cancelled' ? 'badge-rejected' : 'badge-info')}">
            ${o.orderStatus.toUpperCase()}
          </span>
        </td>
        <td class="px-6 py-4 text-right">
          <select onchange="window.adminUpdateOrderStatus('${o.id}', this.value)" class="text-xs bg-white border border-slate-200 rounded px-2 py-1 font-semibold text-slate-700">
            <option value="confirmed" ${o.orderStatus === 'confirmed' ? 'selected' : ''}>Payment Confirmed</option>
            <option value="processing" ${o.orderStatus === 'processing' ? 'selected' : ''}>Processing</option>
            <option value="shipped" ${o.orderStatus === 'shipped' ? 'selected' : ''}>Shipped & In Transit</option>
            <option value="out_for_delivery" ${o.orderStatus === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option>
            <option value="delivered" ${o.orderStatus === 'delivered' ? 'selected' : ''}>Delivered</option>
            <option value="cancelled" ${o.orderStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
      </tr>
    `).join('');
  }

  window.adminUpdateOrderStatus = async function (orderId, newStatus) {
    try {
      const res = await api(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus, note: `Status updated by Logistics Center to ${newStatus}.` })
      });
      showToast(res.message || 'Order status updated.', 'success');
      await loadAdminOrders();
      await loadEmails();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 3. Manage Products
  async function loadAdminProducts() {
    await loadProducts();
    const tbody = document.getElementById('admin-products-table-body');
    if (!tbody) return;

    if (!state.products.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-8 text-center text-xs text-slate-400">
            No products found in catalog. Click "Add Product" to create one.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.products.map(p => `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-4 flex items-center gap-3">
          <img src="${p.image}" class="w-10 h-10 object-cover rounded-lg bg-slate-100">
          <div>
            <div class="font-bold text-slate-900 text-xs">${escapeHtml(p.name)}</div>
            <div class="text-[11px] text-slate-400">${p.featured ? '⭐ Featured' : 'Standard'}</div>
          </div>
        </td>
        <td class="px-6 py-4 text-xs font-semibold text-slate-600">${escapeHtml(p.categoryName || 'General')}</td>
        <td class="px-6 py-4 text-xs font-bold text-slate-900">${formatINR(p.price)}</td>
        <td class="px-6 py-4 text-xs font-semibold ${p.stock <= 5 ? 'text-red-600 font-bold' : 'text-slate-700'}">${p.stock} units</td>
        <td class="px-6 py-4 text-xs text-amber-500 font-bold">⭐ ${p.rating}</td>
        <td class="px-6 py-4 text-right">
          <div class="inline-flex items-center justify-end gap-2">
            <button onclick="window.openEditProductModal('${p.id}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 transition shadow-sm" title="Edit Product">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              Edit Item
            </button>
            <button onclick="window.adminDeleteProduct('${p.id}', '${escapeHtml(p.name)}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 transition shadow-sm" title="Delete Product">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              Delete Item
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  window.adminDeleteProduct = async function (prodId, prodName = 'this product') {
    if (!confirm(`Are you sure you want to permanently delete "${prodName}" from the catalog?`)) return;
    try {
      await api(`/api/admin/products/${prodId}`, { method: 'DELETE' });
      showToast(`Product "${prodName}" was deleted successfully.`, 'success');
      await loadProducts();
      await loadAdminProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Shared Add / Edit Product Modal
  function openProductFormModal(product = null) {
    const modal = document.getElementById('admin-product-modal');
    const content = document.getElementById('admin-product-modal-content');
    if (!modal || !content) return;

    const isEdit = Boolean(product);
    const catOptions = state.categories.map(c =>
      `<option value="${c.id}" ${isEdit && product.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
    ).join('');
    const specsValue = isEdit && Array.isArray(product.specs) ? product.specs.join(', ') : '';

    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div>
            <h3 class="font-bold text-slate-900 text-base">${isEdit ? 'Edit Product / Item' : 'Add New Product to Catalog'}</h3>
            <p class="text-[11px] text-slate-500">${isEdit ? `Updating product ID: ${escapeHtml(product.id)}` : 'Fill out the product details below.'}</p>
          </div>
          <button onclick="window.closeModals()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        <form id="product-form" onsubmit="window.saveProductForm(event, ${isEdit ? `'${escapeHtml(product.id)}'` : 'null'})" class="space-y-3 text-xs">
          <div>
            <label class="font-semibold text-slate-700">Product Name</label>
            <input type="text" id="p-name" required value="${isEdit ? escapeHtml(product.name) : ''}" placeholder="e.g. Ergonomic Mechanical Keyboard" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-semibold text-slate-700">Category</label>
              <select id="p-cat" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded">${catOptions}</select>
            </div>
            <div>
              <label class="font-semibold text-slate-700">Price (₹ INR)</label>
              <input type="number" step="0.01" min="0" id="p-price" required value="${isEdit ? product.price : ''}" placeholder="1499" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-semibold text-slate-700">Stock Quantity</label>
              <input type="number" min="0" id="p-stock" required value="${isEdit ? product.stock : 25}" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded">
            </div>
            <div>
              <label class="font-semibold text-slate-700">Featured on Homepage?</label>
              <select id="p-featured" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded">
                <option value="false" ${!isEdit || !product.featured ? 'selected' : ''}>No</option>
                <option value="true" ${isEdit && product.featured ? 'selected' : ''}>Yes (Featured)</option>
              </select>
            </div>
          </div>
          <div>
            <label class="font-semibold text-slate-700">Image URL</label>
            <input type="url" id="p-image" value="${isEdit ? escapeHtml(product.image) : 'https://picsum.photos/seed/novamart-static-2/800/800'}" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded">
          </div>
          <div>
            <label class="font-semibold text-slate-700">Specifications (comma-separated)</label>
            <input type="text" id="p-specs" value="${escapeHtml(specsValue)}" placeholder="e.g. Bluetooth 5.3, 40h Battery, USB-C" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded">
          </div>
          <div>
            <label class="font-semibold text-slate-700">Description</label>
            <textarea id="p-desc" rows="3" placeholder="Enter detailed specifications and product overview..." class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded">${isEdit ? escapeHtml(product.description) : ''}</textarea>
          </div>
          <div class="pt-2 flex justify-end gap-2">
            <button type="button" onclick="window.closeModals()" class="btn-secondary text-xs">Cancel</button>
            <button type="submit" class="btn-primary text-xs font-bold">${isEdit ? 'Save Changes' : 'Save Product'}</button>
          </div>
        </form>
      </div>
    `;

    modal.classList.add('active');
  }

  window.openAddProductModal = function () {
    openProductFormModal(null);
  };

  window.openEditProductModal = async function (prodId) {
    let prod = state.products.find(p => p.id === prodId);
    if (!prod) {
      try {
        const data = await api(`/api/products/${prodId}`);
        prod = data.product;
      } catch (err) {
        showToast(err.message || 'Could not load product details.', 'error');
        return;
      }
    }
    openProductFormModal(prod);
  };

  window.saveProductForm = async function (e, prodId = null) {
    e.preventDefault();
    const name = document.getElementById('p-name').value;
    const categoryId = document.getElementById('p-cat').value;
    const price = document.getElementById('p-price').value;
    const stock = document.getElementById('p-stock').value;
    const featured = document.getElementById('p-featured').value === 'true';
    const image = document.getElementById('p-image').value;
    const specs = document.getElementById('p-specs').value;
    const description = document.getElementById('p-desc').value;

    const payload = { name, categoryId, price, stock, featured, image, specs, description };

    try {
      if (prodId) {
        const res = await api(`/api/admin/products/${prodId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast(res.message || 'Product updated successfully!', 'success');
      } else {
        await api('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Product added successfully!', 'success');
      }
      window.closeModals();
      await loadCategories();
      await loadAdminProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 4. Manage Categories
  async function loadAdminCategories() {
    await loadCategories();
    const container = document.getElementById('admin-categories-list');
    if (!container) return;

    container.innerHTML = state.categories.map(c => `
      <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
        <div>
          <h4 class="font-bold text-slate-900 text-sm">${escapeHtml(c.name)}</h4>
          <p class="text-xs text-slate-500 mt-1">${escapeHtml(c.description || 'Category for store products')}</p>
        </div>
        <div class="mt-4 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
          <span class="font-semibold text-blue-600">${c.itemCount} products</span>
          <div class="flex items-center gap-3">
            <button onclick="window.adminEditCategory('${c.id}')" class="text-blue-600 hover:underline font-semibold">Edit</button>
            <button onclick="window.adminDeleteCategory('${c.id}')" class="text-red-500 hover:underline">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  window.adminEditCategory = async function (catId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    const name = prompt('Update category name:', cat.name);
    if (name === null || !name.trim()) return;
    const description = prompt('Update category description:', cat.description || '');
    if (description === null) return;
    try {
      const res = await api(`/api/admin/categories/${catId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), description })
      });
      showToast(res.message || 'Category updated!', 'success');
      await loadAdminCategories();
      await loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.openAddCategoryModal = function () {
    const name = prompt('Enter new category name:');
    if (!name) return;
    const description = prompt('Enter short description:');
    api('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    }).then(() => {
      showToast('Category created!', 'success');
      loadAdminCategories();
    }).catch(err => showToast(err.message, 'error'));
  };

  window.adminDeleteCategory = async function (catId) {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await api(`/api/admin/categories/${catId}`, { method: 'DELETE' });
      showToast('Category deleted.', 'info');
      await loadAdminCategories();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 5. Manage Payments
  async function loadAdminPayments() {
    try {
      const data = await api('/api/admin/payments');
      state.payments = data.payments || [];
      renderAdminPayments();
    } catch (err) {
      console.error('Failed to load payments', err);
    }
  }

  function renderAdminPayments() {
    const tbody = document.getElementById('admin-payments-table-body');
    if (!tbody) return;

    tbody.innerHTML = state.payments.map(p => `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-4 font-mono font-bold text-xs text-slate-800">${p.id}</td>
        <td class="px-6 py-4 font-mono text-xs text-blue-600">${p.orderId || '-'}</td>
        <td class="px-6 py-4 text-xs font-semibold text-slate-800">${escapeHtml(p.customerName)}</td>
        <td class="px-6 py-4 text-xs font-bold text-slate-900">${formatINR(p.amount)}</td>
        <td class="px-6 py-4 text-xs">
          <div class="text-slate-800 font-medium">${escapeHtml(p.paymentMethod)}</div>
          <div class="font-mono text-[10px] text-slate-400">Ref: ${escapeHtml(p.gatewayRef)}</div>
        </td>
        <td class="px-6 py-4">
          <span class="badge ${p.status === 'success' ? 'badge-approved' : 'badge-rejected'}">
            ${p.status.toUpperCase()}
          </span>
        </td>
        <td class="px-6 py-4 text-right">
          ${p.status === 'success' ? `
            <button onclick="window.adminRefundPayment('${p.id}')" class="text-xs text-amber-600 hover:underline font-semibold">
              Refund
            </button>
          ` : '<span class="text-xs text-slate-400">N/A</span>'}
        </td>
      </tr>
    `).join('');
  }

  window.adminRefundPayment = async function (paymentId) {
    if (!confirm('Issue refund for this transaction?')) return;
    try {
      await api(`/api/admin/payments/${paymentId}/refund`, { method: 'POST' });
      showToast('Payment refunded successfully.', 'success');
      await loadAdminPayments();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // 6. Generate Reports
  async function loadAdminReports() {
    try {
      const data = await api('/api/admin/reports');
      state.reports = data;

      document.getElementById('kpi-revenue').innerText = formatINR(data.totalRevenue);
      document.getElementById('kpi-orders').innerText = data.totalOrders;
      document.getElementById('kpi-customers').innerText = `${data.approvedCustomers} / ${data.pendingCustomers}`;
      document.getElementById('kpi-aov').innerText = formatINR(data.averageOrderValue);

      // Category breakdown
      const catContainer = document.getElementById('category-report-bars');
      catContainer.innerHTML = Object.entries(data.categorySales).map(([cat, amount]) => {
        const pct = data.totalRevenue > 0 ? (amount / data.totalRevenue) * 100 : 0;
        return `
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="font-semibold text-slate-700">${escapeHtml(cat)}</span>
              <span class="font-bold text-slate-900">${formatINR(amount)} (${pct.toFixed(0)}%)</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div class="bg-blue-600 h-2 rounded-full" style="width: ${Math.max(5, pct)}%"></div>
            </div>
          </div>
        `;
      }).join('');

      // Top products
      const topContainer = document.getElementById('top-products-list');
      topContainer.innerHTML = data.topProducts.map(p => `
        <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs">
          <div class="flex items-center gap-2">
            <img src="${p.image}" class="w-8 h-8 rounded object-cover">
            <span class="font-bold text-slate-800">${escapeHtml(p.name)}</span>
          </div>
          <div class="text-right">
            <div class="font-extrabold text-blue-600">${formatINR(p.revenue)}</div>
            <div class="text-[10px] text-slate-400">${p.unitsSold} units sold</div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load reports', err);
    }
  }

  window.printReport = function () {
    window.print();
  };

  // ==========================================
  // IN-APP MAILBOX & EMAIL INSPECTOR
  // (Shows proof of emails sent for approval/orders)
  // ==========================================

  async function loadEmails() {
    if (!state.user || state.user.role !== 'admin') return;
    try {
      const data = await api('/api/emails');
      state.emails = data.emails || [];
      const badge = document.getElementById('mail-count-badge');
      if (badge) badge.innerText = state.emails.length;
    } catch (err) {
      console.error('Failed to load emails', err);
    }
  }

  window.openMailbox = async function () {
    if (!state.user || state.user.role !== 'admin') {
      showToast('Admin login required to view transaction mailbox logs.', 'warning');
      return;
    }
    await loadEmails();
    const modal = document.getElementById('mailbox-modal');
    const content = document.getElementById('mailbox-modal-content');

    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 class="font-bold text-slate-900 text-lg flex items-center gap-2">
              <span>Dispatched Emails Outbox</span>
              <span class="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-bold">${state.emails.length} Emails</span>
            </h3>
            <p class="text-xs text-slate-500">Inspect real-time approval notifications, activation links, and order receipts.</p>
          </div>
          <button onclick="window.closeModals()" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[60vh] overflow-hidden">
          <!-- List of Emails -->
          <div class="md:col-span-1 overflow-y-auto space-y-2 pr-1 border-r border-slate-100">
            ${state.emails.map((e, idx) => `
              <div onclick="window.viewEmailBody('${e.id}')" class="p-3 rounded-xl border border-slate-200 hover:border-blue-400 cursor-pointer text-xs space-y-1 bg-white hover:bg-slate-50 transition">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-800 truncate">${escapeHtml(e.recipientName || e.to)}</span>
                  <span class="text-[10px] text-slate-400">${new Date(e.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p class="font-semibold text-slate-700 line-clamp-1">${escapeHtml(e.subject)}</p>
                <div class="text-[10px] text-blue-600 font-medium">To: ${escapeHtml(e.to)}</div>
              </div>
            `).join('')}
          </div>

          <!-- Email Preview Body -->
          <div id="email-preview-pane" class="md:col-span-2 overflow-y-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
            ${state.emails.length ? state.emails[0].body : '<p class="text-xs text-slate-400 text-center py-12">Select an email to view full formatted body.</p>'}
          </div>
        </div>
      </div>
    `;

    modal.classList.add('active');
  };

  window.viewEmailBody = function (emailId) {
    const email = state.emails.find(e => e.id === emailId);
    const pane = document.getElementById('email-preview-pane');
    if (email && pane) {
      pane.innerHTML = email.body;
    }
  };

  // ==========================================
  // AUTHENTICATION MODAL & DEMO SWITCHER
  // ==========================================

  window.fillLoginForm = function (email, password) {
    const emailInput = document.getElementById('login-email');
    const pwdInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = email;
    if (pwdInput) pwdInput.value = password;
  };

  window.openAuthModal = async function (tab = 'login', prefillEmail = '') {
    const modal = document.getElementById('auth-modal');
    const content = document.getElementById('auth-modal-content');
    if (!modal || !content) return;

    await loadPublicSettings();
    const activeTab = (tab === 'register' || tab === 'admin') ? tab : 'login';
    const allowReg = state.registrationSettings.allowPublicRegistration !== false;
    const requireApproval = state.registrationSettings.requireAdminApproval !== false;
    const adminEmailPrefill = activeTab === 'admin' ? (prefillEmail || 'admin@store.com') : 'admin@store.com';

    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between border-b border-slate-200 pb-2">
          <div class="flex gap-4">
            <button onclick="window.setAuthTab('login')" id="auth-tab-login" class="text-sm font-bold ${activeTab === 'login' ? 'text-[#e47911] border-b-2 border-[#e47911]' : 'text-slate-400 hover:text-slate-600'} pb-1.5">
              Sign In
            </button>
            <button onclick="window.setAuthTab('register')" id="auth-tab-register" class="text-sm font-bold ${activeTab === 'register' ? 'text-[#e47911] border-b-2 border-[#e47911]' : 'text-slate-400 hover:text-slate-600'} pb-1.5">
              Register
            </button>
            <button onclick="window.setAuthTab('admin')" id="auth-tab-admin" class="text-sm font-bold ${activeTab === 'admin' ? 'text-[#e47911] border-b-2 border-[#e47911]' : 'text-slate-400 hover:text-slate-600'} pb-1.5 flex items-center gap-1">
              <span>🛡️</span>
              <span>Admin Login</span>
            </button>
          </div>
          <button onclick="window.closeModals()" class="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
        </div>

        <!-- Customer / General Sign In Form -->
        <div id="auth-login-view" class="${activeTab === 'login' ? '' : 'hidden'} space-y-3">
          ${tab === 'status_notice' ? `
            <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              Your account is currently awaiting administrator approval. Please sign in after approval or contact the administrator.
            </div>
          ` : ''}
          <form onsubmit="window.handleLoginSubmit(event)" class="space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700">Email Address</label>
              <input type="email" id="login-email" required value="${escapeHtml(prefillEmail)}" placeholder="name@example.com" class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f05d5e]">
            </div>
            <div>
              <label class="font-semibold text-slate-700">Password</label>
              <div class="relative mt-1">
                <input type="password" id="login-password" required placeholder="Enter password" class="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f05d5e]">
                <button type="button" id="login-password-toggle" onclick="window.togglePasswordVisibility('login-password', 'login-password-toggle')" class="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400 hover:text-slate-600 focus:outline-none" title="Show / Hide Password" aria-label="Show password">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400 hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>
            <button type="submit" class="w-full btn-amazon-cart text-xs py-2.5 font-bold shadow-xs">Sign In &rarr;</button>
          </form>
        </div>

        <!-- Register Form -->
        <div id="auth-register-view" class="${activeTab === 'register' ? '' : 'hidden'} space-y-3">
          ${!allowReg ? `
            <div class="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-2">
              <div class="font-bold text-sm">New User Registration is Currently Disabled</div>
              <p>The store administrator has temporarily restricted public self-registration. Please sign in as an Administrator or contact the store admin to enable registration or create an account for you.</p>
            </div>
          ` : `
            <div class="p-3 ${requireApproval ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'} border rounded-lg text-xs">
              ${requireApproval
                ? '<strong>Security Verification Policy:</strong> Newly registered customer accounts are submitted for <strong>manual administrator verification</strong> before signing in.'
                : '<strong>Instant Activation Enabled:</strong> Your new customer account will be activated immediately upon registration.'}
            </div>
            <form onsubmit="window.handleRegisterSubmit(event)" class="space-y-2.5 text-xs">
              <div>
                <label class="font-semibold text-slate-700">Full Name</label>
                <input type="text" id="reg-name" required placeholder="e.g. Rahul Sharma" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
              </div>
              <div>
                <label class="font-semibold text-slate-700">Email Address</label>
                <input type="email" id="reg-email" required placeholder="rahul@example.com" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
              </div>
              <div>
                <label class="font-semibold text-slate-700">Password</label>
                <div class="relative mt-1">
                  <input type="password" id="reg-password" required placeholder="••••••••" class="w-full p-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg">
                  <button type="button" id="reg-password-toggle" onclick="window.togglePasswordVisibility('reg-password', 'reg-password-toggle')" class="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400 hover:text-slate-600 focus:outline-none" title="Show / Hide Password" aria-label="Show password">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400 hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="font-semibold text-slate-700">Phone</label>
                  <input type="text" id="reg-phone" placeholder="+91 98765 43210" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                </div>
                <div>
                  <label class="font-semibold text-slate-700">City / State</label>
                  <input type="text" id="reg-city" placeholder="Mumbai, Maharashtra" class="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                </div>
              </div>
              <button type="submit" class="w-full btn-primary text-xs py-2.5 font-bold shadow-md mt-2">
                ${requireApproval ? 'Submit for Admin Approval →' : 'Create Account & Sign In →'}
              </button>
            </form>
          `}
        </div>

        <!-- Dedicated Admin Login Form -->
        <div id="auth-admin-view" class="${activeTab === 'admin' ? '' : 'hidden'} space-y-3">
          <div class="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs space-y-1 border border-slate-700">
            <div class="font-bold text-[#f2b880] flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Administrator Command Access</span>
            </div>
            <p class="text-slate-300 text-[11px]">
              Sign in as Store Admin to unlock all features: add/edit/delete products, manage &amp; allow new user registrations, process orders, refunds, reports, and mailbox logs.
            </p>
          </div>
          <form onsubmit="window.handleAdminLoginSubmit(event)" class="space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700">Admin Email</label>
              <input type="email" id="admin-login-email" required value="${escapeHtml(adminEmailPrefill)}" placeholder="admin@store.com" class="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f05d5e]">
            </div>
            <div>
              <label class="font-semibold text-slate-700">Admin Password</label>
              <div class="relative mt-1">
                <input type="password" id="admin-login-password" required placeholder="Enter admin password" class="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f05d5e]">
                <button type="button" id="admin-login-password-toggle" onclick="window.togglePasswordVisibility('admin-login-password', 'admin-login-password-toggle')" class="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-slate-400 hover:text-slate-600 focus:outline-none" title="Show / Hide Password" aria-label="Show password">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400 hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>
            <button type="submit" class="w-full btn-primary text-xs py-2.5 font-bold shadow-md">
              Unlock Admin Command Center &rarr;
            </button>
          </form>
        </div>
      </div>
    `;

    modal.classList.add('active');
  };

  window.setAuthTab = function (tab) {
    const views = {
      login: document.getElementById('auth-login-view'),
      register: document.getElementById('auth-register-view'),
      admin: document.getElementById('auth-admin-view')
    };
    const tabs = {
      login: document.getElementById('auth-tab-login'),
      register: document.getElementById('auth-tab-register'),
      admin: document.getElementById('auth-tab-admin')
    };

    Object.keys(views).forEach(key => {
      if (views[key]) views[key].classList.toggle('hidden', key !== tab);
      if (tabs[key]) {
        const extra = key === 'admin' ? ' flex items-center gap-1' : '';
        tabs[key].className = key === tab
          ? `text-sm font-bold text-[#e47911] border-b-2 border-[#e47911] pb-1.5${extra}`
          : `text-sm font-bold text-slate-400 hover:text-slate-600 pb-1.5${extra}`;
      }
    });
  };

  async function completeLoginSession(data) {
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('novamart_token', data.token);

    showToast(`Welcome back, ${data.user.name}!`, 'success');
    window.closeModals();
    renderAuthNav();
    checkAccountAlert();
    await loadProducts();

    if (data.user.role === 'admin') {
      await loadEmails();
      window.switchTab('admin');
    } else {
      window.switchTab('store');
    }
  }

  window.handleLoginSubmit = async function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      await completeLoginSession(data);
    } catch (err) {
      if (err.data?.code === 'PENDING_APPROVAL') {
        showToast('Registration successful! Waiting for admin approval.', 'warning');
      } else {
        showToast(err.message, 'error');
      }
    }
  };

  window.handleAdminLoginSubmit = async function (e) {
    e.preventDefault();
    const email = document.getElementById('admin-login-email').value;
    const password = document.getElementById('admin-login-password').value;

    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, adminOnly: true })
      });
      await completeLoginSession(data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.handleRegisterSubmit = async function (e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value;
    const city = document.getElementById('reg-city').value;

    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          address: { city }
        })
      });

      if (data.token && data.user) {
        await completeLoginSession(data);
        return;
      }

      showToast(data.message || 'Registration successful! Waiting for admin approval.', 'success');
      window.closeModals();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.demoLogin = async function (role) {
    try {
      let email = 'admin@store.com';
      if (role === 'pending') email = 'alice@example.com';

      const data = await api('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('novamart_token', data.token);

      showToast(`Switched user to: ${data.user.name} (${data.user.role})`, 'success');
      window.closeModals();
      renderAuthNav();
      checkAccountAlert();

      if (role === 'admin') {
        window.switchTab('admin');
      } else {
        window.switchTab('store');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.logout = function () {
    state.token = null;
    state.user = null;
    localStorage.removeItem('novamart_token');
    showToast('Signed out successfully.', 'info');
    renderAuthNav();
    checkAccountAlert();
    loadProducts();
    window.switchTab('store');
  };

  // ==========================================
  // NAVIGATION & VIEW SWITCHER
  // ==========================================

  window.switchTab = function (tab) {
    if (tab === 'admin') {
      if (!state.user || state.user.role !== 'admin') {
        if (!state.user) {
          showToast('Please sign in with administrator credentials to access the Admin Panel.', 'warning');
          window.openAuthModal('admin', 'admin@store.com');
        } else {
          showToast('Access denied: You must be logged in as an administrator.', 'error');
        }
        return;
      }
    }

    state.activeTab = tab;
    const storeView = document.getElementById('view-store');
    const adminView = document.getElementById('view-admin');
    const storeBtn = document.getElementById('nav-store-btn');
    const adminBtn = document.getElementById('nav-admin-btn');
    const isAdmin = Boolean(state.user && state.user.role === 'admin');

    if (tab === 'store') {
      storeView.classList.remove('hidden');
      adminView.classList.add('hidden');
      if (storeBtn) {
        storeBtn.className = `${isAdmin ? '' : 'hidden '}text-xs font-bold bg-white/15 text-[#f2b880] px-2.5 py-1.5 rounded border border-[#f2b880]/60`;
      }
      if (adminBtn) {
        adminBtn.className = `${isAdmin ? '' : 'hidden '}text-xs font-bold bg-[#f2b880] text-slate-900 px-2.5 py-1.5 rounded shadow-sm hover:bg-[#f3a847] flex items-center gap-1`;
      }
    } else {
      storeView.classList.add('hidden');
      adminView.classList.remove('hidden');
      if (adminBtn) {
        adminBtn.className = 'text-xs font-bold bg-[#f3a847] text-slate-950 px-2.5 py-1.5 rounded shadow-sm ring-2 ring-white/80 flex items-center gap-1';
      }
      if (storeBtn) {
        storeBtn.className = 'text-xs font-bold text-white hover:text-[#f2b880] px-2.5 py-1.5 rounded hover:outline hover:outline-1 hover:outline-white';
      }
      window.setAdminTab(state.adminTab || 'customers');
    }
  };

  window.filterCategory = function (catId) {
    state.activeCategory = catId;
    state.maxPrice = null;
    state.offerLabel = null;
    state.searchQuery = '';
    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.value = '';
    const mobileInput = document.getElementById('mobile-search');
    if (mobileInput) mobileInput.value = '';
    const promoHero = document.getElementById('promotional-hero-banner');
    if (promoHero) promoHero.classList.remove('hidden');
    renderCategoryPills();
    loadProducts();
    const catalogElem = document.getElementById('product-catalog-anchor') || document.getElementById('category-pills');
    if (catalogElem) {
      catalogElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.filterBudget = function (maxPrice, category = null, label = null) {
    state.activeCategory = category || 'all';
    state.maxPrice = maxPrice;
    state.offerLabel = label;
    state.searchQuery = '';
    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.value = '';
    const mobileInput = document.getElementById('mobile-search');
    if (mobileInput) mobileInput.value = '';
    const promoHero = document.getElementById('promotional-hero-banner');
    if (promoHero) promoHero.classList.remove('hidden');
    renderCategoryPills();
    loadProducts();
    const catalogElem = document.getElementById('product-catalog-anchor') || document.getElementById('category-pills');
    if (catalogElem) {
      catalogElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.handleSearch = function (query, forceScroll = false) {
    const cleanQuery = (query || '').trim();
    state.searchQuery = cleanQuery;
    const globalInput = document.getElementById('global-search');
    const mobileInput = document.getElementById('mobile-search');
    if (globalInput && globalInput.value !== query) globalInput.value = query;
    if (mobileInput && mobileInput.value !== query) mobileInput.value = query;

    const promoHero = document.getElementById('promotional-hero-banner');
    if (cleanQuery) {
      if (promoHero) promoHero.classList.add('hidden');
    } else {
      if (promoHero) promoHero.classList.remove('hidden');
    }

    loadProducts().then(() => {
      // Whenever searching, scroll directly to the catalog so the matching item pops right in view!
      if (cleanQuery) {
        const anchor = document.getElementById('product-catalog-anchor') || document.getElementById('category-pills') || document.getElementById('product-grid');
        if (anchor) {
          anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else if (forceScroll) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  window.clearSearch = function () {
    state.searchQuery = '';
    const globalInput = document.getElementById('global-search');
    const mobileInput = document.getElementById('mobile-search');
    if (globalInput) globalInput.value = '';
    if (mobileInput) mobileInput.value = '';
    const promoHero = document.getElementById('promotional-hero-banner');
    if (promoHero) promoHero.classList.remove('hidden');
    loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.handleSort = function (sort) {
    state.sortBy = sort;
    loadProducts();
  };

  window.closeModals = function () {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(m => m.classList.remove('active'));
  };

  function setupEventListeners() {
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        window.closeModals();
        const drawer = document.getElementById('cart-drawer');
        const overlay = document.getElementById('cart-drawer-overlay');
        if (drawer) drawer.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Start application on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
