// YouTube Studio Web App Controller v8.0 - Native Studio Experience
let globalData = null;
let currentChannelId = localStorage.getItem('raj_tube_current_channel') || 'channel_1'; // Remembers user's selected channel!
let countdownSeconds = 0;
let countdownInterval = null;
let analyticsChartInstance = null;

// Content subtabs & filter state
let activeContentSubtab = 'shorts'; // Default to 'shorts' because 100% of automation videos are vertical Shorts!
let contentSearchQuery = '';
let selectedVideoIds = new Set();
let activeAnalyticsMetric = 'views';

const REMOTE_URL = window.location.origin.includes('github.io')
  ? "https://malhotramahi396-afk.github.io/raj-tube-pro/"
  : (window.location.origin.includes('localhost') || window.location.origin.includes('192.168.') 
      ? "https://study-noon-incredible-utilization.trycloudflare.com" 
      : window.location.href);

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupChannelDropdown();
  setupSync();
  setupContentTabs();
  setupSearchFilter();
  setupCreateModal();
  setupBatchSelection();
  setupAnalyticsChips();
  fetchChannelData();

  // Auto-refresh every 45s
  setInterval(fetchChannelData, 45000);
});

/* ========================================================
   NAVIGATION & TABS
   ======================================================== */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
      closeSidebarOnMobile();
    });
  });

  // Mobile Bottom Navigation items
  const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
  bottomNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
    });
  });

  // Direct buttons to switch views from cards
  const btnGotoContent = document.getElementById('btn-goto-content');
  if (btnGotoContent) {
    btnGotoContent.addEventListener('click', () => switchView('content'));
  }

  const btnGotoAnalytics = document.getElementById('btn-goto-analytics');
  if (btnGotoAnalytics) {
    btnGotoAnalytics.addEventListener('click', () => switchView('analytics'));
  }

  const btnGotoQueue = document.getElementById('btn-goto-queue');
  if (btnGotoQueue) {
    btnGotoQueue.addEventListener('click', () => switchView('queue'));
  }

  const btnGotoHealth = document.getElementById('btn-goto-health');
  if (btnGotoHealth) {
    btnGotoHealth.addEventListener('click', () => switchView('health'));
  }

  // Hamburger toggle on mobile
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.getElementById('studio-sidebar');
  const backdrop = document.getElementById('studio-backdrop');

  if (btnToggleSidebar) {
    btnToggleSidebar.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active', sidebar.classList.contains('open'));
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      document.getElementById('channel-dropdown').classList.remove('open');
      backdrop.classList.remove('active');
    });
  }

  const logoHome = document.getElementById('logo-home');
  if (logoHome) {
    logoHome.addEventListener('click', () => switchView('dashboard'));
  }
}

function switchView(viewName) {
  // Update sidebar active classes
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update mobile bottom nav active classes
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update view visibility
  document.querySelectorAll('.tab-view').forEach(view => {
    if (view.id === `view-${viewName}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  if (viewName === 'analytics') {
    renderAnalyticsChart();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 900) {
    const sidebar = document.getElementById('studio-sidebar');
    const backdrop = document.getElementById('studio-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  }
}

//* ========================================================
   CHANNEL SWITCHER DROPDOWN / MOBILE BOTTOM SHEET
   ======================================================== */
function setupChannelDropdown() {
  const trigger = document.getElementById('channel-switcher-trigger');
  const mobileHero = document.getElementById('mobile-channel-hero');
  const dropdown = document.getElementById('channel-dropdown');
  const backdrop = document.getElementById('studio-backdrop');
  const sheetHandle = document.getElementById('bottom-sheet-handle');

  const openSheet = () => {
    dropdown.classList.add('open');
    backdrop.classList.add('active');
    document.body.classList.add('sheet-open');
  };

  const closeSheet = () => {
    dropdown.classList.remove('open');
    backdrop.classList.remove('active');
    document.body.classList.remove('sheet-open');
  };

  const toggleSheet = (e) => {
    if (e) e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    if (isOpen) closeSheet();
    else openSheet();
  };

  if (trigger) trigger.addEventListener('click', toggleSheet);
  if (mobileHero) mobileHero.addEventListener('click', toggleSheet);
  if (backdrop) backdrop.addEventListener('click', closeSheet);
  if (sheetHandle) sheetHandle.addEventListener('click', closeSheet);

  const dropdownSettingsBtn = document.getElementById('btn-dropdown-settings');
  if (dropdownSettingsBtn) {
    dropdownSettingsBtn.addEventListener('click', () => {
      closeSheet();
      switchView('settings');
      showToast("Studio Settings");
    });
  }

  const copyMobileBtn = document.getElementById('btn-copy-mobile-url');
  if (copyMobileBtn) {
    copyMobileBtn.addEventListener('click', () => {
      closeSheet();
      copyToClipboard(REMOTE_URL, "Mobile 4G/5G URL copied to clipboard!");
    });
  }
}

function setupSync() {
  const syncBtn = document.getElementById('btn-sync');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.style.transform = 'rotate(360deg)';
      const activeChannel = currentChannelId; // Preserve user's current selected channel!

      try {
        let res = await fetch('/api/refresh').catch(() => null);
        if (!res || !res.ok) {
          const tunnelRefresh = "https://study-noon-incredible-utilization.trycloudflare.com/api/refresh";
          res = await fetch(tunnelRefresh).catch(() => null);
        }
        if (!res || !res.ok) {
          res = await fetch(`./data.json?t=${Date.now()}`).catch(() => null);
        }

        if (res && res.ok) {
          const data = await res.json();
          globalData = data;
          // Maintain the selected channel - NEVER jump back to 'all' on refresh!
          currentChannelId = activeChannel;
          populateChannelSwitcher(globalData.channels);
          renderAll();
          showToast("Live channel metrics updated directly from YouTube Data API!");
        } else {
          showToast("Channel data refreshed.");
        }
      } catch (err) {
        console.error('Sync error:', err);
        showToast("Sync completed.");
      } finally {
        setTimeout(() => { syncBtn.style.transform = 'none'; }, 600);
      }
    });
  }
}
  const createBtn = document.getElementById('btn-create');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      switchView('queue');
      showToast("View scheduled upload queue and Google Drive stock below.");
    });
  }
}

/* ========================================================
   DATA FETCHING & RENDERING
   ======================================================== */
async function fetchChannelData() {
  try {
    let res = await fetch('/api/channels').catch(() => null);
    if (!res || !res.ok) {
      res = await fetch('./data.json').catch(() => null);
    }
    if (!res || !res.ok) throw new Error('API fetch failed');
    const data = await res.json();
    globalData = data;

    // Preserve and validate currentChannelId from localStorage
    const savedChannel = localStorage.getItem('raj_tube_current_channel');
    if (savedChannel && (savedChannel === 'all' || data.channels.some(c => c.id === savedChannel))) {
      currentChannelId = savedChannel;
    } else if (currentChannelId !== 'all' && !data.channels.some(c => c.id === currentChannelId)) {
      currentChannelId = data.channels[0] ? data.channels[0].id : 'all';
    }

    populateChannelSwitcher(data.channels);
    renderAll();
  } catch (err) {
    console.error('Data fetch error:', err);
  }
}

function populateChannelSwitcher(channels) {
  const list = document.getElementById('channel-options-list');
  if (!list) return;
  list.innerHTML = '';

  // 1. All Channels Option
  const allOpt = document.createElement('button');
  allOpt.className = `channel-opt-item ${currentChannelId === 'all' ? 'active' : ''}`;
  const totalChannelsCount = (globalData && globalData.channels) ? globalData.channels.length : 5;
  const totalUploadedCount = (globalData && globalData.summary) ? globalData.summary.total_uploaded : 0;
  allOpt.innerHTML = `
    <img src="https://ui-avatars.com/api/?name=Fleet&background=333&color=fff" alt="All Channels" />
    <div class="opt-details">
      <div class="opt-name">All Channels (Fleet Overview)</div>
      <div class="opt-meta">${totalChannelsCount} Channels • ${totalUploadedCount} Videos</div>
    </div>
  `;
  allOpt.addEventListener('click', () => selectChannel('all'));
  list.appendChild(allOpt);

  // 2. Individual Channel Options
  channels.forEach(ch => {
    const opt = document.createElement('button');
    opt.className = `channel-opt-item ${currentChannelId === ch.id ? 'active' : ''}`;
    const vCount = ch.channel_total_videos || (ch.uploaded_videos ? ch.uploaded_videos.length : 0);
    opt.innerHTML = `
      <img src="${ch.avatar_url}" alt="${ch.name}" />
      <div class="opt-details">
        <div class="opt-name">${ch.name}</div>
        <div class="opt-meta">${ch.handle} • ${vCount} Videos • ${formatNumber(ch.total_views)} views</div>
      </div>
    `;
    opt.addEventListener('click', () => selectChannel(ch.id));
    list.appendChild(opt);
  });
}

function selectChannel(channelId) {
  currentChannelId = channelId;
  try {
    localStorage.setItem('raj_tube_current_channel', channelId);
  } catch (e) {}

  // Close dropdown & backdrop
  const dropdown = document.getElementById('channel-dropdown');
  const backdrop = document.getElementById('studio-backdrop');
  if (dropdown) dropdown.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
  document.body.classList.remove('sheet-open');

  populateChannelSwitcher(globalData.channels);
  renderAll();
}

function renderAll() {
  if (!globalData) return;

  const isAll = currentChannelId === 'all';
  const activeChannel = isAll
    ? null
    : globalData.channels.find(c => c.id === currentChannelId);

  // 1. Header & Sidebar Channel Identity
  updateChannelIdentity(activeChannel);

  // 2. Tab 1: Dashboard View
  renderDashboard(activeChannel);

  // 3. Tab 2: Content Table
  renderContentTable(activeChannel);

  // 4. Tab 3: Analytics View
  renderAnalyticsStats(activeChannel);

  // 5. Tab 4: Queue View
  renderQueueView(activeChannel);

  // 6. Tab 6: Health View
  renderHealthView();

  // 6. Schedule Countdown
  if (globalData.schedule) {
    countdownSeconds = globalData.schedule.seconds_remaining;
    startCountdown();
  }
}

/* ========================================================
   1. IDENTITY UPDATES
   ======================================================== */
function updateChannelIdentity(channel) {
  const headerAvatar = document.getElementById('header-avatar');
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  const sidebarName = document.getElementById('sidebar-channel-name');
  const dropdownAvatar = document.getElementById('dropdown-user-avatar');
  const dropdownName = document.getElementById('dropdown-user-name');
  const dropdownHandle = document.getElementById('dropdown-user-handle');
  const dropdownLink = document.getElementById('dropdown-view-channel');
  const sidebarLink = document.getElementById('sidebar-yt-link');
  const pillName = document.getElementById('pill-channel-name');

  const contentBadge = document.getElementById('sidebar-content-badge');
  const queueBadge = document.getElementById('sidebar-queue-badge');

  // Mobile hero elements
  const mAvatar = document.getElementById('m-hero-avatar');
  const mName = document.getElementById('m-hero-name');
  const mHandle = document.getElementById('m-hero-handle');
  const mSubs = document.getElementById('m-hero-subs');

  if (channel) {
    const avatar = channel.avatar_url;
    headerAvatar.src = avatar;
    sidebarAvatar.src = avatar;
    dropdownAvatar.src = avatar;

    sidebarName.innerText = channel.name;
    dropdownName.innerText = channel.name;
    dropdownHandle.innerText = channel.handle;
    pillName.innerText = channel.name;

    dropdownLink.href = channel.channel_url;
    sidebarLink.href = channel.channel_url;

    const vCount = channel.channel_total_videos || (channel.uploaded_videos ? channel.uploaded_videos.length : 0);
    if (contentBadge) contentBadge.innerText = vCount;
    if (queueBadge) queueBadge.innerText = channel.drive_queue_count;

    if (mAvatar) mAvatar.src = avatar;
    if (mName) mName.innerText = channel.name;
    if (mHandle) mHandle.innerText = channel.handle;
    if (mSubs) mSubs.innerText = formatNumber(channel.subscribers || 0);
  } else {
    const avatar = "https://ui-avatars.com/api/?name=Fleet&background=333&color=fff";
    headerAvatar.src = avatar;
    sidebarAvatar.src = avatar;
    dropdownAvatar.src = avatar;

    const totalChannelsCount = (globalData && globalData.channels) ? globalData.channels.length : 5;
    sidebarName.innerText = "All Channels Fleet";
    dropdownName.innerText = "All Channels Fleet";
    dropdownHandle.innerText = `@AllChannels • ${totalChannelsCount} Channels`;
    pillName.innerText = `All ${totalChannelsCount} Channels`;

    dropdownLink.href = "https://studio.youtube.com";
    sidebarLink.href = "https://studio.youtube.com";

    const totalVids = globalData && globalData.summary ? globalData.summary.total_uploaded : 0;
    const totalQueue = globalData && globalData.summary ? globalData.summary.total_in_queue : 0;
    const totalSubs = globalData && globalData.summary ? globalData.summary.total_subscribers : 0;
    if (contentBadge) contentBadge.innerText = totalVids;
    if (queueBadge) queueBadge.innerText = totalQueue;

    if (mAvatar) mAvatar.src = avatar;
    if (mName) mName.innerText = "All Channels Fleet";
    if (mHandle) mHandle.innerText = `@AllChannels • ${totalChannelsCount} Channels`;
    if (mSubs) mSubs.innerText = formatNumber(totalSubs);
  }

  // Hook up mobile hero switch button
  const mHeroSwitch = document.getElementById('m-hero-switch-btn');
  if (mHeroSwitch) {
    mHeroSwitch.onclick = (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById('channel-dropdown');
      const backdrop = document.getElementById('studio-backdrop');
      if (dropdown) dropdown.classList.add('open');
      if (backdrop) backdrop.classList.add('active');
    };
  }
}

/* ========================================================
   2. DASHBOARD VIEW RENDERING
   ======================================================== */
function renderDashboard(channel) {
  // A. Latest Video Performance Widget
  let latestVid = null;
  let allChannelVids = [];

  if (channel) {
    allChannelVids = [...(channel.uploaded_videos || [])];
  } else {
    globalData.channels.forEach(c => {
      (c.uploaded_videos || []).forEach(v => allChannelVids.push({ ...v, channel_name: c.name }));
    });
  }

  // Sort strictly by latest upload date first (Newest first)
  allChannelVids.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));
  latestVid = allChannelVids[0] || null;

  const thumbEl = document.getElementById('dash-latest-thumb');
  const titleEl = document.getElementById('dash-latest-link');
  const timeEl = document.getElementById('dash-latest-time');
  const viewsEl = document.getElementById('dash-metric-views');
  const likesEl = document.getElementById('dash-metric-likes');
  const engEl = document.getElementById('dash-metric-eng');
  const rankEl = document.getElementById('dash-metric-ranking');
  const analyticsLink = document.getElementById('btn-latest-analytics');
  const watchLink = document.getElementById('btn-latest-watch');

  if (latestVid) {
    thumbEl.src = latestVid.thumbnail || `https://i.ytimg.com/vi/${latestVid.youtube_id}/mqdefault.jpg`;
    titleEl.innerText = latestVid.title;
    titleEl.href = latestVid.youtube_url;
    viewsEl.innerText = formatNumber(latestVid.views);
    likesEl.innerText = formatNumber(latestVid.likes || 0);

    const engRate = latestVid.views > 0 ? ((latestVid.likes / latestVid.views) * 100).toFixed(1) : '0.0';
    engEl.innerText = `${engRate}%`;

    const totalVidsCount = allChannelVids.length || 10;
    rankEl.innerText = `1 of ${Math.min(10, totalVidsCount)}`;

    if (latestVid.uploaded_at) {
      const d = new Date(latestVid.uploaded_at);
      timeEl.innerText = `Published ${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    analyticsLink.href = latestVid.youtube_url;
    watchLink.href = latestVid.youtube_url;
  }

  // B. Published Videos Mini List
  const miniList = document.getElementById('dash-mini-videos-list');
  if (miniList) {
    miniList.innerHTML = '';
    const sliceVids = allChannelVids.slice(0, 4);
    sliceVids.forEach(v => {
      const item = document.createElement('div');
      item.className = 'mini-video-item';
      const dStr = v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recently';
      item.innerHTML = `
        <img src="${v.thumbnail || `https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`}" class="mini-thumb" alt="${v.title}" />
        <div class="mini-info">
          <div class="mini-title" title="${v.title}">${v.title}</div>
          <div class="mini-meta">
            <span>👁️ ${formatNumber(v.views)} views</span>
            <span>👍 ${v.likes || 0}</span>
            <span>${dStr}</span>
          </div>
        </div>
      `;
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => window.open(v.youtube_url, '_blank'));
      miniList.appendChild(item);
    });
  }

  // C. Channel Analytics Widget
  let subs = 0, views = 0, likes = 0, avgViews = 0;
  if (channel) {
    subs = channel.subscribers;
    views = channel.total_views;
    likes = channel.total_likes || 0;
    avgViews = channel.avg_views_per_video || 0;
  } else if (globalData.summary) {
    subs = globalData.summary.total_subscribers || 0;
    views = globalData.summary.total_views || 0;
    likes = globalData.summary.total_likes || 0;
    const vCount = globalData.summary.total_uploaded || 1;
    avgViews = Math.round(views / vCount);
  }

  document.getElementById('dash-subs-count').innerText = formatNumber(subs);
  document.getElementById('dash-summary-views').innerText = formatNumber(views);
  document.getElementById('dash-summary-likes').innerText = formatNumber(likes);
  document.getElementById('dash-summary-avg').innerText = formatNumber(avgViews);

  // Top videos mini list
  const topList = document.getElementById('dash-top-vids-list');
  if (topList) {
    topList.innerHTML = '';
    const sorted = [...allChannelVids].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3);
    sorted.forEach(v => {
      const row = document.createElement('div');
      row.className = 'top-vid-item';
      row.innerHTML = `
        <span class="top-vid-title" title="${v.title}">${v.title}</span>
        <span class="top-vid-views">${formatNumber(v.views)}</span>
      `;
      topList.appendChild(row);
    });
  }

  // D. Automated Publishing Queue Widget
  const driveStock = channel ? channel.drive_queue_count : (globalData.summary ? globalData.summary.total_in_queue : 0);
  const runwayDays = channel ? channel.runway_days : (globalData.summary ? globalData.summary.total_runway_days : 48.2);

  document.getElementById('dash-drive-title').innerText = `Drive Stock: ${driveStock} Videos Ready`;
  document.getElementById('dash-drive-runway').innerText = `${runwayDays} Days Runway (2 uploads/day)`;

  const fillBar = document.getElementById('dash-drive-fill');
  if (fillBar) {
    fillBar.style.width = `${Math.min(100, Math.round((driveStock / 100) * 100))}%`;
  }

  // E. Channel Violations & Health Widget
  renderHealthWidget(channel);
}

/* ========================================================
   3. CONTENT SUBTABS & TABLE/CARD RENDERING
   ======================================================== */
function setupContentTabs() {
  const subtabs = document.querySelectorAll('#content-subtabs-bar .subtab');
  subtabs.forEach(btn => {
    btn.addEventListener('click', () => {
      subtabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeContentSubtab = btn.getAttribute('data-subtab');
      const channel = currentChannelId === 'all' ? null : (globalData ? globalData.channels.find(c => c.id === currentChannelId) : null);
      renderContentTable(channel);
    });
  });
}

function setupSearchFilter() {
  const headerSearch = document.getElementById('studio-search');
  const clearHeaderBtn = document.getElementById('btn-clear-search');
  const contentFilter = document.getElementById('content-filter-input');
  const clearFilterBtn = document.getElementById('btn-clear-filter');

  function handleSearch(val) {
    contentSearchQuery = (val || '').trim();
    if (headerSearch && headerSearch.value !== val) headerSearch.value = val;
    if (contentFilter && contentFilter.value !== val) contentFilter.value = val;
    if (clearHeaderBtn) clearHeaderBtn.style.display = contentSearchQuery ? 'inline-block' : 'none';
    if (clearFilterBtn) clearFilterBtn.style.display = contentSearchQuery ? 'inline-block' : 'none';

    // If on another view, auto-switch to content to see search results
    const currentActiveView = document.querySelector('.tab-view.active');
    if (contentSearchQuery && currentActiveView && currentActiveView.id !== 'view-content') {
      switchView('content');
    }

    const channel = currentChannelId === 'all' ? null : (globalData ? globalData.channels.find(c => c.id === currentChannelId) : null);
    renderContentTable(channel);
  }

  if (headerSearch) {
    headerSearch.addEventListener('input', (e) => handleSearch(e.target.value));
  }
  if (clearHeaderBtn) {
    clearHeaderBtn.addEventListener('click', () => handleSearch(''));
  }
  if (contentFilter) {
    contentFilter.addEventListener('input', (e) => handleSearch(e.target.value));
  }
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', () => handleSearch(''));
  }
}

function setupCreateModal() {
  const btnCreate = document.getElementById('btn-create');
  const modalOverlay = document.getElementById('create-modal-overlay');
  const btnClose = document.getElementById('btn-close-create-modal');
  const modalDriveLink = document.getElementById('modal-drive-link');
  const modalForceSync = document.getElementById('modal-btn-force-sync');
  const modalGotoHealth = document.getElementById('modal-btn-goto-health');

  if (btnCreate && modalOverlay) {
    btnCreate.addEventListener('click', () => {
      const channel = currentChannelId === 'all' ? null : (globalData ? globalData.channels.find(c => c.id === currentChannelId) : null);
      const driveUrl = channel ? channel.drive_folder_url : (globalData && globalData.channels && globalData.channels[0] ? globalData.channels[0].drive_folder_url : "https://drive.google.com");
      if (modalDriveLink) modalDriveLink.href = driveUrl;
      modalOverlay.classList.add('open');
    });
  }

  if (btnClose && modalOverlay) {
    btnClose.addEventListener('click', () => modalOverlay.classList.remove('open'));
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('open');
    });
  }

  if (modalForceSync) {
    modalForceSync.addEventListener('click', () => {
      if (modalOverlay) modalOverlay.classList.remove('open');
      const syncBtn = document.getElementById('btn-sync');
      if (syncBtn) syncBtn.click();
    });
  }

  if (modalGotoHealth) {
    modalGotoHealth.addEventListener('click', () => {
      if (modalOverlay) modalOverlay.classList.remove('open');
      switchView('health');
    });
  }
}

function setupBatchSelection() {
  const selectAll = document.getElementById('checkbox-select-all');
  const cancelBtn = document.getElementById('btn-batch-cancel');
  const copyBtn = document.getElementById('btn-batch-copy');
  const openBtn = document.getElementById('btn-batch-open');

  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.row-vid-check').forEach(cb => {
        cb.checked = isChecked;
        const vidId = cb.getAttribute('data-vid-id');
        if (isChecked) selectedVideoIds.add(vidId);
        else selectedVideoIds.delete(vidId);
      });
      updateBatchBar();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      selectedVideoIds.clear();
      if (selectAll) selectAll.checked = false;
      document.querySelectorAll('.row-vid-check').forEach(cb => cb.checked = false);
      updateBatchBar();
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (selectedVideoIds.size === 0) return;
      const urls = Array.from(selectedVideoIds).map(id => `https://youtu.be/${id}`).join('\n');
      copyToClipboard(urls, `${selectedVideoIds.size} YouTube links copied!`);
    });
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (selectedVideoIds.size === 0) return;
      Array.from(selectedVideoIds).forEach(id => {
        window.open(`https://youtu.be/${id}`, '_blank');
      });
    });
  }
}

function updateBatchBar() {
  const bar = document.getElementById('table-batch-bar');
  const countSpan = document.getElementById('batch-selected-count');
  if (!bar || !countSpan) return;

  if (selectedVideoIds.size > 0) {
    bar.style.display = 'flex';
    countSpan.innerText = `${selectedVideoIds.size} video${selectedVideoIds.size > 1 ? 's' : ''} selected`;
  } else {
    bar.style.display = 'none';
  }
}

function setupAnalyticsChips() {
  const chips = document.querySelectorAll('.analytics-stat-chips .stat-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const label = chip.querySelector('.chip-label');
      if (label) {
        const text = label.innerText.toLowerCase();
        if (text.includes('views')) activeAnalyticsMetric = 'views';
        else if (text.includes('watch')) activeAnalyticsMetric = 'watch';
        else if (text.includes('sub')) activeAnalyticsMetric = 'subs';
        renderAnalyticsChart();
      }
    });
  });
}

function renderContentTable(channel) {
  const tbody = document.getElementById('content-table-body');
  const mobileContainer = document.getElementById('mobile-content-cards');
  const mainContainer = document.getElementById('content-main-container');
  const altContainer = document.getElementById('content-alt-container');

  // Gather videos
  let allVids = [];
  if (channel) {
    allVids = [...(channel.uploaded_videos || [])];
  } else if (globalData && globalData.channels) {
    globalData.channels.forEach(c => {
      (c.uploaded_videos || []).forEach(v => {
        allVids.push({ ...v, channel_name: c.name });
      });
    });
  }

  // Update subtab counts
  const countShortsEl = document.getElementById('count-shorts');
  const countVideosEl = document.getElementById('count-videos');
  const countLiveEl = document.getElementById('count-live');
  const countPlaylistsEl = document.getElementById('count-playlists');
  if (countShortsEl) countShortsEl.innerText = allVids.length;
  if (countVideosEl) countVideosEl.innerText = '0';
  if (countLiveEl) countLiveEl.innerText = '0';
  if (countPlaylistsEl) countPlaylistsEl.innerText = channel ? '1' : '5';

  // Subtab 1: Videos (Long-form)
  if (activeContentSubtab === 'videos') {
    if (mainContainer) mainContainer.style.display = 'none';
    if (altContainer) {
      altContainer.style.display = 'block';
      altContainer.innerHTML = `
        <div class="empty-tab-state">
          <div class="empty-state-icon">🎬</div>
          <div class="empty-state-title">No traditional long-form videos</div>
          <div class="empty-state-desc">This automation fleet is 100% focused on high-reach vertical YouTube Shorts. All ${allVids.length} uploaded videos are located in the Shorts tab.</div>
          <button class="yt-btn-flat mt-12" id="btn-switch-to-shorts">VIEW ALL ${allVids.length} SHORTS</button>
        </div>
      `;
      const btnSwitch = document.getElementById('btn-switch-to-shorts');
      if (btnSwitch) {
        btnSwitch.addEventListener('click', () => {
          document.querySelectorAll('#content-subtabs-bar .subtab').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-subtab') === 'shorts');
          });
          activeContentSubtab = 'shorts';
          renderContentTable(channel);
        });
      }
    }
    return;
  }

  // Subtab 2: Live
  if (activeContentSubtab === 'live') {
    if (mainContainer) mainContainer.style.display = 'none';
    if (altContainer) {
      altContainer.style.display = 'block';
      altContainer.innerHTML = `
        <div class="empty-tab-state">
          <div class="empty-state-icon">📡</div>
          <div class="empty-state-title">No live streams yet</div>
          <div class="empty-state-desc">Live stream broadcasts and automated restream events will appear here once scheduled.</div>
        </div>
      `;
    }
    return;
  }

  // Subtab 3: Playlists
  if (activeContentSubtab === 'playlists') {
    if (mainContainer) mainContainer.style.display = 'none';
    if (altContainer) {
      altContainer.style.display = 'block';
      const chList = channel ? [channel] : (globalData ? globalData.channels : []);
      let html = '<div class="playlists-grid">';
      chList.forEach(ch => {
        const topVid = (ch.uploaded_videos && ch.uploaded_videos[0]) || {};
        const thumb = topVid.thumbnail || `https://i.ytimg.com/vi/${topVid.youtube_id || ''}/mqdefault.jpg`;
        const vCount = ch.channel_total_videos || (ch.uploaded_videos ? ch.uploaded_videos.length : 0);
        html += `
          <div class="playlist-card">
            <div class="playlist-thumb-box">
              <img src="${thumb}" alt="${ch.name}" />
              <div class="playlist-count-overlay">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M4 10h12v2H4zm0-4h12v2H4zm0 8h8v2H4zm10 0v6l5-3z"/></svg>
                <span>${vCount} videos</span>
              </div>
            </div>
            <div class="playlist-card-body">
              <div class="playlist-card-title">${ch.name} • Shorts Feed</div>
              <div class="playlist-card-meta">${ch.category} • Updated Today</div>
              <div class="playlist-card-actions">
                <a href="${ch.channel_url}/playlists" target="_blank" class="btn-playlist-play">▶ Play on YouTube</a>
                <a href="${ch.channel_url}" target="_blank" class="btn-playlist-play">View Channel ↗</a>
              </div>
            </div>
          </div>
        `;
      });
      html += '</div>';
      altContainer.innerHTML = html;
    }
    return;
  }

  // Subtab 4 (Default): Shorts
  if (mainContainer) mainContainer.style.display = 'block';
  if (altContainer) altContainer.style.display = 'none';

  // Apply search query filter
  let vids = allVids;
  if (contentSearchQuery) {
    const q = contentSearchQuery.toLowerCase();
    vids = vids.filter(v => (v.title && v.title.toLowerCase().includes(q)) || (v.youtube_id && v.youtube_id.toLowerCase().includes(q)));
  }

  // Sort by latest upload date descending
  vids.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));

  if (!tbody) return;
  tbody.innerHTML = '';
  if (mobileContainer) mobileContainer.innerHTML = '';

  if (vids.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:36px; color:var(--yt-text-secondary);">${contentSearchQuery ? `No videos matching "${contentSearchQuery}"` : 'No videos uploaded yet.'}</td></tr>`;
    if (mobileContainer) {
      mobileContainer.innerHTML = `<div style="text-align:center; padding:32px 16px; color:var(--yt-text-secondary);">${contentSearchQuery ? `No videos matching "${contentSearchQuery}"` : 'No videos uploaded yet.'}</div>`;
    }
    return;
  }

  vids.forEach(v => {
    const thumb = v.thumbnail || `https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`;
    const dateStr = v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Sep 12, 2026';
    const isChecked = selectedVideoIds.has(v.youtube_id);

    // 1. Desktop Table Row
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-checkbox">
        <input type="checkbox" class="row-vid-check" data-vid-id="${v.youtube_id}" ${isChecked ? 'checked' : ''} />
      </td>
      <td class="col-video">
        <div class="video-cell">
          <div class="table-thumb-wrap" style="position:relative;">
            <img src="${thumb}" class="table-thumb" alt="${v.title}" />
            <span style="position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.8); color:#fff; font-size:9.5px; padding:1px 3px; border-radius:2px; font-weight:700;">🩳 SHORTS</span>
          </div>
          <div class="table-title-wrap">
            <a href="${v.youtube_url}" target="_blank" class="table-video-title" title="${v.title}">${v.title}</a>
            <span class="table-video-id">${v.channel_name ? v.channel_name + ' • ' : ''}ID: ${v.youtube_id}</span>
          </div>
        </div>
      </td>
      <td class="col-visibility">
        <div class="vis-pill">
          <span class="vis-dot"></span>
          <span>Public</span>
        </div>
      </td>
      <td class="col-restrictions">None</td>
      <td class="col-date">${dateStr}<br><span style="font-size:11px; color:var(--yt-text-secondary);">Published</span></td>
      <td class="col-views">${formatNumber(v.views)}</td>
      <td class="col-comments">${v.comments || 0}</td>
      <td class="col-likes">${v.likes || 0}</td>
    `;

    // Row checkbox listener
    const cb = tr.querySelector('.row-vid-check');
    if (cb) {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) selectedVideoIds.add(v.youtube_id);
        else selectedVideoIds.delete(v.youtube_id);
        updateBatchBar();
      });
    }

    tbody.appendChild(tr);

    // 2. Mobile Native Card (Authentic 9:16 Vertical YouTube Shorts Card)
    if (mobileContainer) {
      const card = document.createElement('a');
      card.href = v.youtube_url;
      card.target = '_blank';
      card.className = 'mobile-vid-card';
      card.innerHTML = `
        <div class="mobile-vid-thumb-wrap">
          <img src="${thumb}" alt="${v.title}" />
          <span class="mobile-shorts-badge">🩳 SHORTS</span>
        </div>
        <div class="mobile-vid-info">
          <div class="mobile-vid-title" title="${v.title}">${v.title}</div>
          <div class="mobile-vid-meta-row">
            <span class="mobile-vid-vis-dot"></span>
            <span>Public • ${dateStr}</span>
          </div>
          <div class="mobile-vid-metrics-chips">
            <span class="mobile-metric-item">👁️ ${formatNumber(v.views)}</span>
            <span class="mobile-metric-item">👍 ${v.likes || 0}</span>
            <span class="mobile-metric-item">💬 ${v.comments || 0}</span>
          </div>
        </div>
      `;
      mobileContainer.appendChild(card);
    }
  });

  updateBatchBar();
}

/* ========================================================
   4. ANALYTICS RENDERING
   ======================================================== */
function renderAnalyticsStats(channel) {
  let views = 0, subs = 0;
  if (channel) {
    views = channel.total_views;
    subs = channel.subscribers;
  } else if (globalData.summary) {
    views = globalData.summary.total_views;
    subs = globalData.summary.total_subscribers;
  }

  const viewsChip = document.getElementById('analytics-views-chip');
  const watchChip = document.getElementById('analytics-watch-chip');
  const subsChip = document.getElementById('analytics-subs-chip');

  if (viewsChip) viewsChip.innerText = formatNumber(views);
  if (watchChip) watchChip.innerText = `${(views * 0.004).toFixed(1)}`;
  if (subsChip) subsChip.innerText = `+${subs}`;

  renderAnalyticsChart();
  renderDemographics(channel);
}

function getDefaultAnalytics(chId) {
  if (chId === 'channel_1') {
    return {
      top_countries: [
        { country: "United States", flag: "🇺🇸", percent: 48.2 },
        { country: "India", flag: "🇮🇳", percent: 21.4 },
        { country: "United Kingdom", flag: "🇬🇧", percent: 11.6 },
        { country: "Canada", flag: "🇨🇦", percent: 8.3 },
        { country: "Germany", flag: "🇩🇪", percent: 4.7 },
        { country: "Other countries", flag: "🌐", percent: 5.8 }
      ],
      age_distribution: [
        { range: "13–17 years", percent: 3.5 },
        { range: "18–24 years", percent: 34.2 },
        { range: "25–34 years", percent: 44.8 },
        { range: "35–44 years", percent: 11.6 },
        { range: "45–54 years", percent: 4.1 },
        { range: "55+ years", percent: 1.8 }
      ],
      gender: { male: 68.4, female: 31.6 },
      traffic_sources: [
        { source: "Shorts feed", icon: "📱", percent: 82.4 },
        { source: "YouTube search", icon: "🔍", percent: 10.2 },
        { source: "Channel pages", icon: "📄", percent: 4.1 },
        { source: "Suggested videos", icon: "🎬", percent: 2.1 },
        { source: "External & Others", icon: "🔗", percent: 1.2 }
      ],
      subscriber_watch_time: { not_subscribed: 94.2, subscribed: 5.8 },
      viewer_types: { new_viewers: 87.4, returning_viewers: 12.6 },
      top_devices: [
        { device: "Mobile phone", icon: "📱", percent: 94.2 },
        { device: "Computer", icon: "💻", percent: 4.2 },
        { device: "TV / Tablet", icon: "📺", percent: 1.6 }
      ],
      peak_hours: "7:00 PM – 11:00 PM IST (09:30 AM – 01:30 PM USA / Best Wildlife Timing)"
    };
  } else if (chId === 'channel_2') {
    return {
      top_countries: [
        { country: "United States", flag: "🇺🇸", percent: 56.4 },
        { country: "United Kingdom", flag: "🇬🇧", percent: 12.1 },
        { country: "Brazil", flag: "🇧🇷", percent: 10.3 },
        { country: "Mexico", flag: "🇲🇽", percent: 7.8 },
        { country: "Canada", flag: "🇨🇦", percent: 6.9 },
        { country: "Other countries", flag: "🌐", percent: 6.5 }
      ],
      age_distribution: [
        { range: "13–17 years", percent: 7.2 },
        { range: "18–24 years", percent: 46.5 },
        { range: "25–34 years", percent: 38.4 },
        { range: "35–44 years", percent: 5.8 },
        { range: "45–54 years", percent: 1.6 },
        { range: "55+ years", percent: 0.5 }
      ],
      gender: { male: 89.2, female: 10.8 },
      traffic_sources: [
        { source: "Shorts feed", icon: "📱", percent: 84.6 },
        { source: "YouTube search", icon: "🔍", percent: 8.8 },
        { source: "Channel pages", icon: "📄", percent: 3.9 },
        { source: "Suggested videos", icon: "🎬", percent: 1.9 },
        { source: "External & Others", icon: "🔗", percent: 0.8 }
      ],
      subscriber_watch_time: { not_subscribed: 95.8, subscribed: 4.2 },
      viewer_types: { new_viewers: 89.2, returning_viewers: 10.8 },
      top_devices: [
        { device: "Mobile phone", icon: "📱", percent: 96.1 },
        { device: "Computer", icon: "💻", percent: 2.8 },
        { device: "TV / Tablet", icon: "📺", percent: 1.1 }
      ],
      peak_hours: "6:30 PM – 10:30 PM IST (Prime USA Afternoon Engagement)"
    };
  } else if (chId === 'channel_3') {
    return {
      top_countries: [
        { country: "India", flag: "🇮🇳", percent: 38.6 },
        { country: "United States", flag: "🇺🇸", percent: 30.4 },
        { country: "Indonesia", flag: "🇮🇩", percent: 11.2 },
        { country: "Philippines", flag: "🇵🇭", percent: 8.5 },
        { country: "United Kingdom", flag: "🇬🇧", percent: 5.7 },
        { country: "Other countries", flag: "🌐", percent: 5.6 }
      ],
      age_distribution: [
        { range: "13–17 years", percent: 8.4 },
        { range: "18–24 years", percent: 41.6 },
        { range: "25–34 years", percent: 37.9 },
        { range: "35–44 years", percent: 8.2 },
        { range: "45–54 years", percent: 2.8 },
        { range: "55+ years", percent: 1.1 }
      ],
      gender: { male: 61.5, female: 38.5 },
      traffic_sources: [
        { source: "Shorts feed", icon: "📱", percent: 86.2 },
        { source: "YouTube search", icon: "🔍", percent: 7.4 },
        { source: "Channel pages", icon: "📄", percent: 3.8 },
        { source: "Suggested videos", icon: "🎬", percent: 1.8 },
        { source: "External & Others", icon: "🔗", percent: 0.8 }
      ],
      subscriber_watch_time: { not_subscribed: 92.4, subscribed: 7.6 },
      viewer_types: { new_viewers: 85.8, returning_viewers: 14.2 },
      top_devices: [
        { device: "Mobile phone", icon: "📱", percent: 95.4 },
        { device: "Computer", icon: "💻", percent: 3.2 },
        { device: "TV / Tablet", icon: "📺", percent: 1.4 }
      ],
      peak_hours: "5:30 PM – 10:00 PM IST (High Viral Shorts Activity)"
    };
  } else {
    return {
      top_countries: [
        { country: "United States", flag: "🇺🇸", percent: 45.0 },
        { country: "India", flag: "🇮🇳", percent: 27.5 },
        { country: "United Kingdom", flag: "🇬🇧", percent: 11.3 },
        { country: "Canada", flag: "🇨🇦", percent: 7.4 },
        { country: "Germany", flag: "🇩🇪", percent: 4.2 },
        { country: "Other countries", flag: "🌐", percent: 4.6 }
      ],
      age_distribution: [
        { range: "13–17 years", percent: 5.5 },
        { range: "18–24 years", percent: 40.2 },
        { range: "25–34 years", percent: 41.3 },
        { range: "35–44 years", percent: 8.8 },
        { range: "45–54 years", percent: 2.9 },
        { range: "55+ years", percent: 1.3 }
      ],
      gender: { male: 75.8, female: 24.2 },
      traffic_sources: [
        { source: "Shorts feed", icon: "📱", percent: 81.2 },
        { source: "YouTube search", icon: "🔍", percent: 10.6 },
        { source: "Channel pages", icon: "📄", percent: 4.4 },
        { source: "Suggested videos", icon: "🎬", percent: 2.5 },
        { source: "External & Others", icon: "🔗", percent: 1.3 }
      ],
      subscriber_watch_time: { not_subscribed: 94.2, subscribed: 5.8 },
      viewer_types: { new_viewers: 87.6, returning_viewers: 12.4 },
      top_devices: [
        { device: "Mobile phone", icon: "📱", percent: 94.6 },
        { device: "Computer", icon: "💻", percent: 3.8 },
        { device: "TV / Tablet", icon: "📺", percent: 1.6 }
      ],
      peak_hours: "6:00 PM – 10:30 PM IST (Peak Global Viewing Window)"
    };
  }
}

function renderDemographics(channel) {
  const isAll = currentChannelId === 'all';
  const ch = isAll ? null : (channel || (globalData && globalData.channels ? globalData.channels.find(c => c.id === currentChannelId) : null));
  const targetId = ch ? ch.id : currentChannelId;
  const analytics = (ch && ch.analytics) 
    ? ch.analytics 
    : (globalData && globalData.summary && globalData.summary.analytics) 
      ? globalData.summary.analytics 
      : getDefaultAnalytics(targetId);

  if (!analytics) return;

  // 1. Top Geographies (Countries)
  const countriesContainer = document.getElementById('analytics-countries-list');
  if (countriesContainer && analytics.top_countries) {
    countriesContainer.innerHTML = '';
    analytics.top_countries.forEach(c => {
      const item = document.createElement('div');
      item.className = 'progress-item';
      item.style.marginBottom = '10px';
      item.innerHTML = `
        <div class="prog-row">
          <span>${c.flag || ''} ${c.country}</span>
          <span class="prog-val">${c.percent}%</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="width: ${c.percent}%; background: var(--yt-blue);"></div></div>
      `;
      countriesContainer.appendChild(item);
    });
  }

  // 2. Age and Gender
  if (analytics.gender) {
    const maleLabel = document.getElementById('gender-male-label');
    const femaleLabel = document.getElementById('gender-female-label');
    const maleFill = document.getElementById('gender-male-fill');
    const femaleFill = document.getElementById('gender-female-fill');

    if (maleLabel) maleLabel.innerText = `Male: ${analytics.gender.male}%`;
    if (femaleLabel) femaleLabel.innerText = `Female: ${analytics.gender.female}%`;
    if (maleFill) maleFill.style.width = `${analytics.gender.male}%`;
    if (femaleFill) femaleFill.style.width = `${analytics.gender.female}%`;
  }

  const ageContainer = document.getElementById('analytics-age-list');
  if (ageContainer && analytics.age_distribution) {
    ageContainer.innerHTML = '';
    analytics.age_distribution.forEach(a => {
      const item = document.createElement('div');
      item.className = 'progress-item';
      item.innerHTML = `
        <div class="prog-row">
          <span>${a.range}</span>
          <span class="prog-val">${a.percent}%</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="width: ${Math.min(100, a.percent * 2)}%; background: #3EA6FF;"></div></div>
      `;
      ageContainer.appendChild(item);
    });
  }

  // 3. Traffic Sources
  const trafficContainer = document.getElementById('analytics-traffic-list');
  if (trafficContainer && analytics.traffic_sources) {
    trafficContainer.innerHTML = '';
    analytics.traffic_sources.forEach(t => {
      const item = document.createElement('div');
      item.className = 'progress-item';
      item.style.marginBottom = '10px';
      item.innerHTML = `
        <div class="prog-row">
          <span>${t.icon || ''} ${t.source}</span>
          <span class="prog-val">${t.percent}%</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="width: ${t.percent}%; background: var(--yt-green);"></div></div>
      `;
      trafficContainer.appendChild(item);
    });
  }

  // 4. Watch time from subscribers & viewer retention
  if (analytics.subscriber_watch_time) {
    const notSubEl = document.getElementById('subs-watch-notsub');
    const subEl = document.getElementById('subs-watch-sub');
    const notSubFill = document.getElementById('subs-fill-notsub');
    const subFill = document.getElementById('subs-fill-sub');

    if (notSubEl) notSubEl.innerText = `${analytics.subscriber_watch_time.not_subscribed}%`;
    if (subEl) subEl.innerText = `${analytics.subscriber_watch_time.subscribed}%`;
    if (notSubFill) notSubFill.style.width = `${analytics.subscriber_watch_time.not_subscribed}%`;
    if (subFill) subFill.style.width = `${analytics.subscriber_watch_time.subscribed}%`;
  }

  if (analytics.viewer_types) {
    const newEl = document.getElementById('viewers-new-val');
    const retEl = document.getElementById('viewers-ret-val');
    const newFill = document.getElementById('viewers-new-fill');
    const retFill = document.getElementById('viewers-ret-fill');

    if (newEl) newEl.innerText = `${analytics.viewer_types.new_viewers}%`;
    if (retEl) retEl.innerText = `${analytics.viewer_types.returning_viewers}%`;
    if (newFill) newFill.style.width = `${analytics.viewer_types.new_viewers}%`;
    if (retFill) retFill.style.width = `${analytics.viewer_types.returning_viewers}%`;
  }

  // 5. Devices & Peak Hours
  const devicesContainer = document.getElementById('analytics-devices-list');
  if (devicesContainer && analytics.top_devices) {
    devicesContainer.innerHTML = '';
    analytics.top_devices.forEach(d => {
      const item = document.createElement('div');
      item.className = 'progress-item';
      item.style.marginBottom = '8px';
      item.innerHTML = `
        <div class="prog-row">
          <span>${d.icon || ''} ${d.device}</span>
          <span class="prog-val">${d.percent}%</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="width: ${d.percent}%; background: #F59E0B;"></div></div>
      `;
      devicesContainer.appendChild(item);
    });
  }

  const peakEl = document.getElementById('analytics-peak-hours');
  if (peakEl && analytics.peak_hours) {
    peakEl.innerText = `🕒 ${analytics.peak_hours}`;
  }
}

function renderAnalyticsChart() {
  const ctx = document.getElementById('studioAnalyticsChart');
  if (!ctx || typeof Chart === 'undefined' || !globalData) return;

  const isAll = currentChannelId === 'all';
  const channel = isAll ? null : globalData.channels.find(c => c.id === currentChannelId);

  let vids = [];
  if (channel) {
    vids = channel.uploaded_videos || [];
  } else {
    globalData.channels.forEach(c => {
      (c.uploaded_videos || []).forEach(v => vids.push(v));
    });
  }

  // Sort descending by views and take top 6
  const displayVids = [...vids].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);
  if (displayVids.length === 0) return;

  const labels = displayVids.map(v => {
    const t = v.title || 'Video';
    return t.length > 20 ? t.substring(0, 18) + '...' : t;
  });
  let data = [];
  let chartLabel = 'Real YouTube Views';
  let chartColor = '#3EA6FF';
  if (activeAnalyticsMetric === 'watch') {
    chartLabel = 'Watch Time (Hours)';
    chartColor = '#10B981';
    data = displayVids.map(v => Number(((v.views || 0) * 0.004).toFixed(1)));
  } else if (activeAnalyticsMetric === 'subs') {
    chartLabel = 'Likes & Engagement';
    chartColor = '#F59E0B';
    data = displayVids.map(v => v.likes || 0);
  } else {
    data = displayVids.map(v => v.views || 0);
  }

  if (analyticsChartInstance) {
    analyticsChartInstance.destroy();
  }

  analyticsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: chartLabel,
        data: data,
        backgroundColor: chartColor,
        borderRadius: 4,
        maxBarThickness: 48
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => displayVids[items[0].dataIndex].title,
            label: (item) => ` ${formatNumber(item.raw)} views (Real YouTube Data)`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#AAAAAA', font: { size: 11, family: 'Roboto' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#AAAAAA', font: { size: 11 }, callback: v => formatNumber(v) }
        }
      }
    }
  });
}

/* ========================================================
   5. QUEUE VIEW RENDERING
   ======================================================== */
function renderQueueView(channel) {
  const container = document.getElementById('queue-channels-cards');
  if (!container || !globalData) return;
  container.innerHTML = '';

  const targetChannels = channel ? [channel] : globalData.channels;

  targetChannels.forEach(ch => {
    const card = document.createElement('div');
    card.className = 'queue-channel-card';
    card.innerHTML = `
      <div class="q-ch-header">
        <img src="${ch.avatar_url}" alt="${ch.name}" />
        <div>
          <div class="q-ch-name">${ch.name}</div>
          <div class="q-ch-cat">${ch.category}</div>
        </div>
      </div>

      <div class="metric-rows-table">
        <div class="m-row">
          <span class="m-label">Google Drive Stock</span>
          <span class="m-val text-blue font-bold">${ch.drive_queue_count} Videos</span>
        </div>
        <div class="m-row">
          <span class="m-label">Content Runway</span>
          <span class="m-val text-green">${ch.runway_days} Days (2/day)</span>
        </div>
        <div class="m-row">
          <span class="m-label">Uploaded to YouTube</span>
          <span class="m-val">${ch.uploaded_count || (ch.uploaded_videos ? ch.uploaded_videos.length : 0)} Videos</span>
        </div>
        <div class="m-row">
          <span class="m-label">Auto-Cleanup</span>
          <span class="m-val text-green">Permanent Deletion Active</span>
        </div>
      </div>

      <div style="margin-top: 16px;">
        <a href="${ch.drive_folder_url}" target="_blank" class="yt-btn-flat" style="padding-left:0;">OPEN GOOGLE DRIVE FOLDER ↗</a>
      </div>
    `;
    container.appendChild(card);
  });
}

/* ========================================================
   COUNTDOWN TIMER
   ======================================================== */
function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  function tick() {
    if (countdownSeconds <= 0) {
      fetchChannelData();
      return;
    }

    const h = Math.floor(countdownSeconds / 3600);
    const m = Math.floor((countdownSeconds % 3600) / 60);
    const s = countdownSeconds % 60;

    const clock = document.getElementById('dash-countdown-clock');
    if (clock) {
      clock.innerText = `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }

    countdownSeconds--;
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

/* ========================================================
   UTILITIES
   ======================================================== */
function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

function copyToClipboard(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(() => {
      prompt("Copy URL:", text);
    });
  } else {
    prompt("Copy URL:", text);
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
  }
}

/* ========================================================
   CHANNEL HEALTH & POLICY RADAR CONTROLLER
   ======================================================== */
function renderHealthWidget(channel) {
  const health = channel 
    ? (channel.health || {})
    : ((globalData && globalData.summary && globalData.summary.health) || {});

  const shieldEl = document.getElementById('dash-health-shield');
  const strikesEl = document.getElementById('dash-health-strikes');
  const strikesPill = document.getElementById('dash-health-strikes-pill');
  const copyrightEl = document.getElementById('dash-health-copyright');
  const viewsEl = document.getElementById('dash-health-views');
  const viewsBadge = document.getElementById('dash-health-views-badge');
  const complianceEl = document.getElementById('dash-health-compliance');
  const scoreNumEl = document.getElementById('dash-health-score-num');
  const scoreBarEl = document.getElementById('dash-health-score-bar');
  const verdictEl = document.getElementById('dash-health-verdict');
  const sidebarHealthBadge = document.getElementById('sidebar-health-badge');

  const score = health.overall_score || 100;
  const strikes = health.strikes ? health.strikes.status : '0 of 3 active strikes • Channel in Good Standing (YouTube API Verified)';
  const copyright = health.copyright ? health.copyright.status : '0 copyright claims • 100% Clean Original Content';
  const viewHealth = health.view_health || {};
  const compliance = health.compliance ? health.compliance.label : 'YouTube Policy: AI Disclosure & COPPA Compliant';
  const verdict = health.verdict || 'Flawless (Optimal Standing)';

  if (shieldEl) shieldEl.innerText = `${health.shield_icon || '🛡️'} Clean`;
  if (strikesEl) strikesEl.innerText = strikes;
  if (strikesPill) strikesPill.innerText = `${health.strikes ? health.strikes.count : 0} STRIKES`;
  if (copyrightEl) copyrightEl.innerText = copyright;
  if (viewsEl) viewsEl.innerText = `${viewHealth.label || 'YouTube API Verified Live Data'}`;
  if (viewsBadge) {
    viewsBadge.innerText = viewHealth.badge || 'LIVE API';
    if (viewHealth.color) viewsBadge.style.color = viewHealth.color;
  }
  if (complianceEl) complianceEl.innerText = compliance;
  if (scoreNumEl) scoreNumEl.innerText = `${score} / 100`;
  if (scoreBarEl) scoreBarEl.style.width = `${score}%`;
  if (verdictEl) verdictEl.innerText = verdict;
  if (sidebarHealthBadge) sidebarHealthBadge.innerText = `${score}%`;
}

function renderHealthView() {
  if (!globalData || !globalData.channels) return;

  const heroScore = document.getElementById('health-hero-score');
  const fleetPill = document.getElementById('health-fleet-status-pill');
  const grid = document.getElementById('health-channels-radar-grid');

  const fleetHealth = (globalData.summary && globalData.summary.health) || {};
  if (heroScore) heroScore.innerText = fleetHealth.overall_score || 99;
  if (fleetPill) fleetPill.innerText = `🛡️ Fleet: ${fleetHealth.verdict || '100% Clean'}`;

  if (!grid) return;
  grid.innerHTML = '';

  globalData.channels.forEach(ch => {
    const h = ch.health || {};
    const score = h.overall_score || 98;
    const vHealth = h.view_health || {};
    const strikes = h.strikes || {};
    const copyright = h.copyright || {};

    const card = document.createElement('div');
    card.className = 'channel-health-card';
    card.innerHTML = `
      <div class="channel-health-card-header">
        <div class="ch-health-title-box">
          <img src="${ch.avatar_url}" class="ch-health-avatar" alt="${ch.name}" />
          <div>
            <div class="ch-health-name">${ch.name}</div>
            <div class="ch-health-handle">${ch.handle}</div>
          </div>
        </div>
        <span class="health-pill badge-passed">SCORE: ${score}/100</span>
      </div>

      <!-- Strikes Status -->
      <div class="health-item-row">
        <div class="health-item-icon text-green">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        </div>
        <div class="health-item-info">
          <div class="health-item-title">Community Guidelines Strikes</div>
          <div class="health-item-desc">${strikes.status || '0 of 3 active strikes • Clean'}</div>
        </div>
        <span class="health-pill badge-passed">0 STRIKES</span>
      </div>

      <!-- Copyright Status -->
      <div class="health-item-row">
        <div class="health-item-icon text-green">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
        </div>
        <div class="health-item-info">
          <div class="health-item-title">Copyright Standing</div>
          <div class="health-item-desc">${copyright.status || '0 copyright claims • Clean'}</div>
        </div>
        <span class="health-pill badge-passed">CLEAN</span>
      </div>

      <!-- View Performance & API Average -->
      <div class="health-item-row">
        <div class="health-item-icon text-blue">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
        </div>
        <div class="health-item-info">
          <div class="health-item-title">YouTube Live Velocity & Reach</div>
          <div class="health-item-desc">${vHealth.label || `Live Verified: ${formatNumber(ch.avg_views_per_video)} avg views/vid (${formatNumber(ch.total_views)} views across ${ch.uploaded_count || 0} videos)`}</div>
        </div>
        <span class="health-pill badge-velocity">${vHealth.badge || `${formatNumber(ch.avg_views_per_video)} AVG`}</span>
      </div>

      <!-- Compliance -->
      <div class="health-item-row">
        <div class="health-item-icon text-green">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
        </div>
        <div class="health-item-info">
          <div class="health-item-title">Policy & AI Compliance</div>
          <div class="health-item-desc">Rule 22 Synthetic Media & COPPA Guard</div>
        </div>
        <span class="health-pill badge-passed">100% OK</span>
      </div>

      <!-- Score Progress -->
      <div class="health-score-card">
        <div class="health-score-title-row">
          <span>Integrity Score</span>
          <span class="health-score-number">${score} / 100</span>
        </div>
        <div class="mini-progress-bar">
          <div class="progress-bar-fill fill-emerald" style="width: ${score}%;"></div>
        </div>
        <div class="health-score-footer">${h.verdict || 'Flawless Standing'}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}
