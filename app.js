// YouTube Studio Web App Controller v7.0
let globalData = null;
let currentChannelId = 'channel_1'; // Default to first channel, or 'all'
let countdownSeconds = 0;
let countdownInterval = null;
let analyticsChartInstance = null;

const REMOTE_URL = window.location.origin.includes('github.io')
  ? "https://malhotramahi396-afk.github.io/raj-tube-pro/"
  : (window.location.origin.includes('localhost') || window.location.origin.includes('192.168.') 
      ? "https://study-noon-incredible-utilization.trycloudflare.com" 
      : window.location.href);

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupChannelDropdown();
  setupSync();
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

/* ========================================================
   CHANNEL SWITCHER DROPDOWN
   ======================================================== */
function setupChannelDropdown() {
  const trigger = document.getElementById('channel-switcher-trigger');
  const dropdown = document.getElementById('channel-dropdown');
  const backdrop = document.getElementById('studio-backdrop');

  if (trigger) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      dropdown.classList.toggle('open', !isOpen);
      backdrop.classList.toggle('active', !isOpen);
    });
  }

  const copyMobileBtn = document.getElementById('btn-copy-mobile-url');
  if (copyMobileBtn) {
    copyMobileBtn.addEventListener('click', () => {
      dropdown.classList.remove('open');
      backdrop.classList.remove('active');
      copyToClipboard(REMOTE_URL, "Mobile 4G/5G URL copied to clipboard!");
    });
  }
}

function setupSync() {
  const syncBtn = document.getElementById('btn-sync');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      syncBtn.style.transform = 'rotate(360deg)';
      fetch('/api/refresh')
        .then(res => res.json())
        .then(data => {
          globalData = data;
          renderAll();
          showToast("Studio data synchronized!");
        })
        .catch(err => {
          console.error(err);
          showToast("Sync error. Retrying...");
        })
        .finally(() => {
          setTimeout(() => { syncBtn.style.transform = 'none'; }, 600);
        });
    });
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

    // Check if currentChannelId is valid in the list
    if (currentChannelId !== 'all' && !data.channels.find(c => c.id === currentChannelId)) {
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
  allOpt.innerHTML = `
    <img src="https://ui-avatars.com/api/?name=Fleet&background=333&color=fff" alt="All Channels" />
    <div class="opt-details">
      <div class="opt-name">All Channels (Fleet Overview)</div>
      <div class="opt-meta">3 Channels • ${globalData && globalData.summary ? globalData.summary.total_uploaded : 21} Videos</div>
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

  // Close dropdown & backdrop
  document.getElementById('channel-dropdown').classList.remove('open');
  document.getElementById('studio-backdrop').classList.remove('active');

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
  } else {
    const avatar = "https://ui-avatars.com/api/?name=Fleet&background=333&color=fff";
    headerAvatar.src = avatar;
    sidebarAvatar.src = avatar;
    dropdownAvatar.src = avatar;

    sidebarName.innerText = "All Channels Fleet";
    dropdownName.innerText = "All Channels Fleet";
    dropdownHandle.innerText = "@AllChannels • 3 Channels";
    pillName.innerText = "All 3 Channels";

    dropdownLink.href = "https://studio.youtube.com";
    sidebarLink.href = "https://studio.youtube.com";

    const totalVids = globalData.summary ? globalData.summary.total_uploaded : 21;
    const totalQueue = globalData.summary ? globalData.summary.total_in_queue : 289;
    if (contentBadge) contentBadge.innerText = totalVids;
    if (queueBadge) queueBadge.innerText = totalQueue;
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
    subs = globalData.summary.total_subscribers;
    views = globalData.summary.total_views;
    likes = globalData.summary.total_likes || 0;
    avgViews = Math.round(views / 21);
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
  const driveStock = channel ? channel.drive_queue_count : (globalData.summary ? globalData.summary.total_in_queue : 289);
  const runwayDays = channel ? channel.runway_days : (globalData.summary ? globalData.summary.total_runway_days : 48.2);

  document.getElementById('dash-drive-title').innerText = `Drive Stock: ${driveStock} Videos Ready`;
  document.getElementById('dash-drive-runway').innerText = `${runwayDays} Days Runway (2 uploads/day)`;

  const fillBar = document.getElementById('dash-drive-fill');
  if (fillBar) {
    fillBar.style.width = `${Math.min(100, Math.round((driveStock / 100) * 100))}%`;
  }
}

/* ========================================================
   3. CONTENT TABLE RENDERING (YouTube Studio Table)
   ======================================================== */
function renderContentTable(channel) {
  const tbody = document.getElementById('content-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  let vids = [];
  if (channel) {
    vids = [...(channel.uploaded_videos || [])];
  } else {
    globalData.channels.forEach(c => {
      (c.uploaded_videos || []).forEach(v => {
        vids.push({ ...v, channel_name: c.name });
      });
    });
  }

  // Sort strictly by latest upload date descending (Newest first, like YouTube Studio)
  vids.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));

  if (vids.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--yt-text-secondary);">No videos uploaded yet.</td></tr>`;
    return;
  }

  const mobileContainer = document.getElementById('mobile-content-cards');
  if (mobileContainer) mobileContainer.innerHTML = '';

  vids.forEach(v => {
    const thumb = v.thumbnail || `https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`;
    const dateStr = v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Sep 11, 2026';

    // 1. Desktop Table Row
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-checkbox"><input type="checkbox" /></td>
      <td class="col-video">
        <div class="video-cell">
          <img src="${thumb}" class="table-thumb" alt="${v.title}" />
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
    tbody.appendChild(tr);

    // 2. Mobile Native Card (For Phone Screens)
    if (mobileContainer) {
      const card = document.createElement('a');
      card.href = v.youtube_url;
      card.target = '_blank';
      card.className = 'mobile-vid-card';
      card.innerHTML = `
        <div class="mobile-vid-thumb-wrap">
          <img src="${thumb}" alt="${v.title}" />
        </div>
        <div class="mobile-vid-info">
          <div class="mobile-vid-title" title="${v.title}">${v.title}</div>
          <div class="mobile-vid-meta-row">
            <span class="mobile-vid-vis-dot"></span>
            <span>Public • ${dateStr}</span>
          </div>
          <div class="mobile-vid-meta-row" style="margin-top:2px;">
            <span>👁️ ${formatNumber(v.views)} views</span>
            <span>•</span>
            <span>👍 ${v.likes || 0}</span>
          </div>
        </div>
      `;
      mobileContainer.appendChild(card);
    }
  });
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
  const data = displayVids.map(v => v.views || 0);

  if (analyticsChartInstance) {
    analyticsChartInstance.destroy();
  }

  analyticsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Real YouTube Views',
        data: data,
        backgroundColor: '#3EA6FF',
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
