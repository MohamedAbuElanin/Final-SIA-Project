// admin.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Guard
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = '../sign in/signin.html';
            return;
        }

        if (user.email !== "mohamedosman@gamil.com") {
            alert("Unauthorized Access");
            await firebase.auth().signOut();
            window.location.href = '../sign in/signin.html';
            return;
        }

        const token = await user.getIdToken();
        document.getElementById('adminEmailDisplay').textContent = user.email;
        
        // Load Initial Data
        initDashboard(token);
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        firebase.auth().signOut().then(() => {
            window.location.href = '../sign in/signin.html';
        });
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
        const user = firebase.auth().currentUser;
        if (user) user.getIdToken().then(initDashboard);
    });

    document.getElementById('userSearch').addEventListener('input', (e) => {
        filterUsers(e.target.value);
    });
});

let allUsers = []; // Store fetched users locally for filtering

async function initDashboard(token) {
    loadStats(token);
    loadUsers(token);
}

// --- API Calls ---

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
        console.error(err);
    }
}

async function loadUsers(token) {
    const listEl = document.getElementById('usersList');
    listEl.innerHTML = '<div class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load users');
        const users = await res.json();
        
        allUsers = users; // Cache
        renderUsers(users);
    } catch (err) {
        console.error(err);
        if (err.message.includes('403') || err.message.includes('401')) {
            handleAuthError();
            return;
        }
        listEl.innerHTML = '<div class="text-white p-3">Error loading users. <button class="btn btn-sm btn-outline-light" onclick="loadUsers()">Retry</button></div>';
    }
}

async function loadUserDetails(uid) {
    const panel = document.getElementById('userDetailPanel');
    panel.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-2x text-gold"></i><p class="mt-3">Loading details...</p></div>';

    try {
        const user = firebase.auth().currentUser;
        const token = await user.getIdToken();

        const res = await fetch(`/api/admin/user/${uid}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to load details');
        const data = await res.json();
        
        renderUserDetails(data);
    } catch (err) {
        console.error(err);
        if (err.message.includes('403') || err.message.includes('401')) {
            handleAuthError();
            return;
        }
        panel.innerHTML = '<div class="p-3 text-white border border-secondary rounded bg-dark">Failed to load user details.</div>';
    }
}

// --- Rendering ---

// --- Rendering ---

function renderUsers(users) {
    const listEl = document.getElementById('usersList');
    if (users.length === 0) {
        listEl.innerHTML = '<div class="p-3 text-white text-center">No users found.</div>';
        return;
    }

    listEl.innerHTML = '';
    users.forEach(user => {
        const lastSignIn = user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleDateString() : 'N/A';
        const item = document.createElement('div'); // Div wrapper to allow better styling control if needed
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
        // Explicitly force white color style inline as requested for strictness
        item.style.color = '#ffffff'; 
        
        item.onclick = () => {
            // Visualize selection
            document.querySelectorAll('.user-row').forEach(el => {
                el.classList.remove('active');
                el.classList.remove('bg-secondary'); // fallback active style
            });
            item.classList.add('active');
            loadUserDetails(user.uid);
        };
        listEl.appendChild(item);
    });
}

function filterUsers(query) {
    if (!query) {
        renderUsers(allUsers);
        return;
    }
    const lower = query.toLowerCase();
    const filtered = allUsers.filter(u => 
        (u.email && u.email.toLowerCase().includes(lower)) ||
        (u.displayName && u.displayName.toLowerCase().includes(lower)) ||
        (u.uid && u.uid.includes(query))
    );
    renderUsers(filtered);
}

function renderUserDetails(data) {
    const { info, results, activity } = data;
    const panel = document.getElementById('userDetailPanel');

    // Safe accessors
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
            <!-- Test Scores -->
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

            <!-- AI Insight -->
            <div class="col-12">
                <div class="card bg-dark border-secondary mb-3">
                    <div class="card-header border-secondary text-gold">Latest AI Analysis</div>
                    <div class="card-body text-white" style="max-height: 200px; overflow-y: auto;">
                        <p class="small text-white mb-0">${ai.personalityAnalysis || ai.bigFive?.personalityAnalysis || 'No analysis available.'}</p>
                    </div>
                </div>
            </div>

            <!-- Activity Log -->
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
    
    // Final force white text on everything in panel
    panel.querySelectorAll('*').forEach(el => {
        if (!el.classList.contains('text-gold')) {
            el.style.color = '#ffffff';
        }
    });
}

function handleAuthError() {
    console.warn("Auth Error or Token Expired.");
    firebase.auth().signOut().then(() => {
        window.location.href = '../sign in/signin.html';
    });
}
