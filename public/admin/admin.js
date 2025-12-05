document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
});

function checkAdminAuth() {
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = '../sign in/signin.html';
            return;
        }

        user.getIdToken().then(token => {
            fetchUsers(token);
        });
    });
}

function fetchUsers(token) {
    fetch(`${CONFIG.API_BASE_URL}/admin/users`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                throw new Error('Unauthorized: You do not have admin access.');
            }
            throw new Error(`Error ${res.status}: ${res.statusText}`);
        }
        return res.json();
    })
    .then(users => {
        renderUsers(users);
    })
    .catch(err => {
        console.error("Error fetching users:", err);
        const container = document.querySelector('.container') || document.body;
        // Check if unauthorized
        if (err.message.includes('Unauthorized')) {
           container.innerHTML = `<div class="alert alert-danger text-center mt-5"><h3>Access Denied</h3><p>You do not have permission to view this page.</p><a href="../index.html" class="btn btn-primary">Go Home</a></div>`;
        } else {
           container.innerHTML += `<div class="alert alert-danger text-center mt-3">Error loading users: ${err.message}</div>`;
        }
    });
}

function renderUsers(users) {
    const container = document.createElement('div');
    container.className = 'container mt-5';
    container.innerHTML = '<h2>User Management</h2><table class="table table-dark table-striped mt-3"><thead><tr><th>Email</th><th>Name</th><th>UID</th><th>Created</th></tr></thead><tbody id="userTableBody"></tbody></table>';
    
    // Insert after header, before script
    document.querySelector('body > header').insertAdjacentElement('afterend', container);

    const tbody = document.getElementById('userTableBody');
    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.email}</td>
            <td>${user.displayName || 'N/A'}</td>
            <td><small>${user.uid}</small></td>
            <td>${user.metadata ? new Date(user.metadata.creationTime).toLocaleDateString() : 'N/A'}</td>
        `;
        tbody.appendChild(tr);
    });
}
