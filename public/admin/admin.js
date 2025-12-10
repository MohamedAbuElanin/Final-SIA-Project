/**
 * SIA Admin Panel - Main Script
 * Improved structure with centralized functions and toast notifications
 */

// ============================================
// State Management
// ============================================
const adminState = {
    currentUser: null,
    authToken: null,
    allUsers: [],
    currentSection: 'dashboard',
    isLoading: false
};

// ============================================
// Toast Notification System
// ============================================
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info} toast-icon"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

// ============================================
// Loading State Management
// ============================================
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';
    adminState.isLoading = true;
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
    adminState.isLoading = false;
}

// ============================================
// Firebase Initialization
// ============================================
function initializeFirebase() {
    return new Promise((resolve, reject) => {
        if (typeof window.onAuthStateReady === 'undefined') {
            setTimeout(() => initializeFirebase().then(resolve).catch(reject), 100);
            return;
        }
        resolve();
    });
}

// ============================================
// Admin Authentication Check
// ============================================
async function checkAdminAccess(user) {
    if (!user) {
        return false;
    }

    try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 403 || res.status === 401) {
            return false;
        }

        if (!res.ok) {
            throw new Error('Failed to verify admin access');
        }

        adminState.currentUser = user;
        adminState.authToken = token;
        return true;
    } catch (error) {
        console.error('Error checking admin access:', error);
        return false;
    }
}

// ============================================
// Main Initialization
// ============================================
async function initializeAdmin() {
    showLoading();

    try {
        await initializeFirebase();

        window.onAuthStateReady(async (user) => {
            if (!user) {
                showToast('Please sign in to access admin panel', 'warning');
                setTimeout(() => {
                    window.location.href = '../sign in/signin.html';
                }, 1500);
                return;
            }

            const isAdmin = await checkAdminAccess(user);
            
            if (!isAdmin) {
                showToast('Unauthorized: Admin privileges required', 'error');
                await firebase.auth().signOut();
                setTimeout(() => {
                    window.location.href = '../sign in/signin.html';
                }, 2000);
                return;
            }

            // User is admin, proceed
            document.getElementById('adminEmailDisplay').textContent = user.email;
            hideLoading();
            showToast('Welcome to Admin Panel', 'success');
            setupEventListeners();
            initDashboard(adminState.authToken);
        });
    } catch (error) {
        console.error('Error initializing admin:', error);
        showToast('Error initializing admin panel', 'error');
        hideLoading();
    }
}

// ============================================
// Event Listeners Setup
// ============================================
function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (adminState.authToken) {
                initDashboard(adminState.authToken);
                showToast('Data refreshed', 'success');
            }
        });
    }

    // User search
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', (e) => {
            filterUsers(e.target.value);
        });
    }

    // Navigation items
    const navItems = document.querySelectorAll('.admin-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });

    // Mobile menu toggle
    const mobileToggle = document.getElementById('mobileMenuToggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            const sidebar = document.getElementById('adminSidebar');
            if (sidebar) {
                sidebar.classList.toggle('open');
            }
        });
    }
}

// ============================================
// Section Navigation
// ============================================
function switchSection(sectionName) {
    // Update nav items
    document.querySelectorAll('.admin-nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        }
    });

    // Update sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });

    const targetSection = document.getElementById(`${sectionName}Section`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }

    adminState.currentSection = sectionName;
}

// ============================================
// Dashboard Initialization
// ============================================
function initDashboard(token) {
    loadStats(token);
    loadUsers(token);
}

// ============================================
// API Calls
// ============================================
async function loadStats(token) {
    try {
        const res = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401 || res.status === 403) {
            handleAuthError();
            return;
        }
        
        if (!res.ok) throw new Error('Failed to load stats');
        
        const data = await res.json();
        
        document.getElementById('totalUsersStr').textContent = data.totalUsers || 0;
        document.getElementById('totalTestsStr').textContent = data.totalTests || 0;
        document.getElementById('activeUsersStr').textContent = data.activeUsers || 0;
    } catch (err) {
        console.error('Error loading stats:', err);
        showToast('Failed to load statistics', 'error');
    }
}

async function loadUsers(token) {
    const listEl = document.getElementById('usersList');
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to load users');
        
        const users = await res.json();
        adminState.allUsers = users;
        renderUsers(users);
    } catch (err) {
        console.error('Error loading users:', err);
        if (err.message.includes('403') || err.message.includes('401')) {
            handleAuthError();
            return;
        }
        listEl.innerHTML = '<div class="text-white p-3">Error loading users. <button class="btn btn-sm btn-outline-light" onclick="loadUsers()">Retry</button></div>';
        showToast('Failed to load users', 'error');
    }
}

async function loadUserDetails(uid) {
    const panel = document.getElementById('userDetailPanel');
    if (!panel) return;

    panel.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-2x text-gold"></i><p class="mt-3">Loading details...</p></div>';

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            handleAuthError();
            return;
        }

        const token = await user.getIdToken();
        const res = await fetch(`/api/admin/user/${uid}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to load details');
        
        const data = await res.json();
        renderUserDetails(data);
    } catch (err) {
        console.error('Error loading user details:', err);
        if (err.message.includes('403') || err.message.includes('401')) {
            handleAuthError();
            return;
        }
        panel.innerHTML = '<div class="p-3 text-white border border-secondary rounded bg-dark">Failed to load user details.</div>';
        showToast('Failed to load user details', 'error');
    }
}

// ============================================
// Rendering Functions
// ============================================
function renderUsers(users) {
    const listEl = document.getElementById('usersList');
    if (!listEl) return;

    if (users.length === 0) {
        listEl.innerHTML = '<div class="p-3 text-white text-center">No users found.</div>';
        return;
    }

    listEl.innerHTML = '';
    users.forEach(user => {
        const lastSignIn = user.metadata.lastSignInTime 
            ? new Date(user.metadata.lastSignInTime).toLocaleDateString() 
            : 'N/A';
        
        const item = document.createElement('div');
        item.style.cursor = 'pointer';
        item.className = 'list-group-item list-group-item-action bg-dark text-white border-secondary user-row';
        item.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1 text-gold">${user.displayName || 'No Name'}</h6>
                <small class="text-white"><i class="far fa-clock me-1"></i>${lastSignIn}</small>
            </div>
            <p class="mb-1 text-truncate small text-white">${user.email}</p>
            <small class="text-white-50" style="font-size: 0.75rem;">UID: ${user.uid}</small>
        `;
        item.style.color = '#ffffff';
        
        item.onclick = () => {
            document.querySelectorAll('.user-row').forEach(el => {
                el.classList.remove('active');
            });
            item.classList.add('active');
            loadUserDetails(user.uid);
        };
        
        listEl.appendChild(item);
    });
}

function filterUsers(query) {
    if (!query) {
        renderUsers(adminState.allUsers);
        return;
    }
    const lower = query.toLowerCase();
    const filtered = adminState.allUsers.filter(u => 
        (u.email && u.email.toLowerCase().includes(lower)) ||
        (u.displayName && u.displayName.toLowerCase().includes(lower)) ||
        (u.uid && u.uid.includes(query))
    );
    renderUsers(filtered);
}

function renderUserDetails(data) {
    const { info, results, activity } = data;
    const panel = document.getElementById('userDetailPanel');
    if (!panel) return;

    const bf = results.bigFive || {};
    const hc = results.hollandCode || {};
    const ai = results.AI_Analysis || {};

    const activityHtml = activity.map(log => `
        <div class="d-flex justify-content-between border-bottom border-secondary py-2 text-white">
            <span>${log.action}</span>
            <small class="text-white-50">${log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</small>
        </div>
    `).join('') || '<p class="text-white-50">No activity recorded.</p>';

    panel.innerHTML = `
        <div class="d-flex align-items-center mb-4 border-bottom border-gold pb-3 text-white">
            <img src="${info.avatar || '../assets/male.svg'}" class="rounded-circle me-3" style="width: 60px; height: 60px; object-fit: cover; border: 2px solid #d4af37;">
            <div>
                <h4 class="text-gold mb-0">${info.fullName || info.displayName || 'Unnamed'}</h4>
                <div class="text-white">${info.email}</div>
                <div class="small text-white-50">Member since: ${info.createdAt ? new Date(info.createdAt._seconds * 1000).toDateString() : 'Unknown'}</div>
            </div>
        </div>

        <div class="row g-4 text-white">
            <div class="col-md-6">
                <div class="card bg-dark border-secondary mb-3">
                    <div class="card-header border-secondary text-gold">Big Five Scores</div>
                    <div class="card-body text-white">
                        ${Object.keys(bf).length ? `
                            <ul class="list-unstyled mb-0">
                                <li class="d-flex justify-content-between"><span>Openness:</span> <span>${bf.Openness || 0}</span></li>
                                <li class="d-flex justify-content-between"><span>Conscientiousness:</span> <span>${bf.Conscientiousness || 0}</span></li>
                                <li class="d-flex justify-content-between"><span>Extraversion:</span> <span>${bf.Extraversion || 0}</span></li>
                                <li class="d-flex justify-content-between"><span>Agreeableness:</span> <span>${bf.Agreeableness || 0}</span></li>
                                <li class="d-flex justify-content-between"><span>Neuroticism:</span> <span>${bf.Neuroticism || 0}</span></li>
                            </ul>
                        ` : '<div class="text-white-50 text-center small">Not taken</div>'}
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="card bg-dark border-secondary mb-3">
                    <div class="card-header border-secondary text-gold">Holland Codes</div>
                    <div class="card-body text-white">
                        ${Object.keys(hc).length ? `
                            <ul class="list-unstyled mb-0">
                                <li class="d-flex justify-content-between"><span>Realistic:</span> <span>${hc.Realistic || 0}</span></li>
                                <li class="d-flex justify-content-between"><span>Investigative:</span> <span>${hc.Investigative || 0}</span></li>
                                <li class="d-flex justify-content-between"><span>Artistic:</span> <span>${hc.Artistic || 0}</span></li>
                                <li class="d-flex justify-content-between"><span>Social:</span> <span>${hc.Social || 0}</span></li>
                                <li class="d-flex justify-content-between"><span>Enterprising:</span> <span>${hc.Enterprising || 0}</span></li>
                                <li class="d-flex justify-content-between"><span>Conventional:</span> <span>${hc.Conventional || 0}</span></li>
                            </ul>
                        ` : '<div class="text-white-50 text-center small">Not taken</div>'}
                    </div>
                </div>
            </div>

            <div class="col-12">
                <div class="card bg-dark border-secondary mb-3">
                    <div class="card-header border-secondary text-gold">Latest AI Analysis</div>
                    <div class="card-body text-white" style="max-height: 200px; overflow-y: auto;">
                        <p class="small text-white mb-0">${ai.personalityAnalysis || ai.bigFive?.personalityAnalysis || 'No analysis available.'}</p>
                    </div>
                </div>
            </div>

            <div class="col-12">
                <div class="card bg-dark border-secondary">
                    <div class="card-header border-secondary text-gold">Recent Activity</div>
                    <div class="card-body p-2 text-white" style="max-height: 250px; overflow-y: auto;">
                        ${activityHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    panel.querySelectorAll('*').forEach(el => {
        if (!el.classList.contains('text-gold')) {
            el.style.color = '#ffffff';
        }
    });
}

// ============================================
// Event Handlers
// ============================================
function handleLogout() {
    firebase.auth().signOut().then(() => {
        showToast('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = '../sign in/signin.html';
        }, 1000);
    }).catch(error => {
        console.error('Logout error:', error);
        showToast('Error during logout', 'error');
    });
}

function handleAuthError() {
    console.warn("Auth Error or Token Expired.");
    showToast('Authentication error. Please sign in again.', 'error');
    firebase.auth().signOut().then(() => {
        setTimeout(() => {
            window.location.href = '../sign in/signin.html';
        }, 2000);
    });
}

// ============================================
// DOM Ready
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeAdmin();
});
