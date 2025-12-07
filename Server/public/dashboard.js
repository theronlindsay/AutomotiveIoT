let currentTab = 'harsh-braking';

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        loadCurrentTab();
    });
});

// Get filter parameters
function getFilters() {
    const params = new URLSearchParams();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const limit = document.getElementById('limit').value;
    
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (limit) params.append('limit', limit);
    
    return params.toString();
}

// Load current tab data
async function loadCurrentTab() {
    const filters = getFilters();
    
    switch(currentTab) {
        case 'harsh-braking':
            await loadHarshBraking(filters);
            break;
        case 'follow-distance':
            await loadFollowDistance(filters);
            break;
        case 'speed-snapshots':
            await loadSpeedSnapshots(filters);
            break;
    }
}

// Format timestamp
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
}

// Load Harsh Braking Events
async function loadHarshBraking(filters) {
    try {
        const response = await fetch(`/api/harsh-braking?${filters}`);
        const data = await response.json();
        
        let html = `
            <h2>⚠️ Harsh Braking Events</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Time</th>
                        <th>Deceleration</th>
                        <th>Speed Before</th>
                        <th>Speed After</th>
                        <th>Severity</th>
                        <th>Light</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;
        
        if (data && data.length > 0) {
            data.forEach(event => {
                html += `
                    <tr class="severity-${event.severity}">
                        <td>${event.event_id}</td>
                        <td>${formatDate(event.event_timestamp)}</td>
                        <td>${event.deceleration_rate} m/s²</td>
                        <td>${event.speed_before} mph</td>
                        <td>${event.speed_after} mph</td>
                        <td><span class="badge ${event.severity}">${event.severity}</span></td>
                        <td>${event.light_condition}</td>
                        <td><button onclick="deleteRecord('harsh-braking', ${event.event_id})">Delete</button></td>
                    </tr>`;
            });
        } else {
            html += '<tr><td colspan="8">No harsh braking events found</td></tr>';
        }
        
        html += '</tbody></table>';
        document.getElementById('content').innerHTML = html;
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('content').innerHTML = '<p>Error loading data</p>';
    }
}

// Load Follow Distance Violations
async function loadFollowDistance(filters) {
    try {
        const response = await fetch(`/api/follow-distance?${filters}`);
        const data = await response.json();
        
        let html = `
            <h2>📏 Follow Distance Violations</h2>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Time</th>
                        <th>Distance</th>
                        <th>Speed</th>
                        <th>Required Distance</th>
                        <th>Duration</th>
                        <th>Light</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;
        
        if (data && data.length > 0) {
            data.forEach(violation => {
                html += `
                    <tr>
                        <td>${violation.violation_id}</td>
                        <td>${formatDate(violation.event_timestamp)}</td>
                        <td>${violation.distance_meters} m</td>
                        <td>${violation.current_speed} mph</td>
                        <td>${violation.required_distance || 'N/A'} m</td>
                        <td>${violation.duration_seconds || 'N/A'} sec</td>
                        <td>${violation.light_condition}</td>
                        <td><button onclick="deleteRecord('follow-distance', ${violation.violation_id})">Delete</button></td>
                    </tr>`;
            });
        } else {
            html += '<tr><td colspan="8">No follow distance violations found</td></tr>';
        }
        
        html += '</tbody></table>';
        document.getElementById('content').innerHTML = html;
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('content').innerHTML = '<p>Error loading data</p>';
    }
}

// Load Speed Snapshots
async function loadSpeedSnapshots(filters) {
    try {
        const response = await fetch(`/api/speed-snapshots?${filters}`);
        const data = await response.json();
        
        let html = `
            <h2>🏎️ Speed Snapshots</h2>
            <label><input type="checkbox" id="speedingOnly" onchange="loadCurrentTab()"> Show Speeding Only</label>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Time</th>
                        <th>Speed</th>
                        <th>Speed Limit</th>
                        <th>Speeding</th>
                        <th>Acceleration</th>
                        <th>Heading</th>
                        <th>Light</th>
                    </tr>
                </thead>
                <tbody>`;
        
        if (data && data.length > 0) {
            data.forEach(snapshot => {
                const speedingClass = snapshot.is_speeding ? 'speeding' : '';
                html += `
                    <tr class="${speedingClass}">
                        <td>${snapshot.snapshot_id}</td>
                        <td>${formatDate(snapshot.snapshot_timestamp)}</td>
                        <td>${snapshot.speed_mph} mph</td>
                        <td>${snapshot.speed_limit || 'N/A'} mph</td>
                        <td>${snapshot.is_speeding ? '⚠️ Yes' : '✅ No'}</td>
                        <td>${snapshot.acceleration || 'N/A'} m/s²</td>
                        <td>${snapshot.heading || 'N/A'}°</td>
                        <td>${snapshot.light_condition}</td>
                    </tr>`;
            });
        } else {
            html += '<tr><td colspan="8">No speed snapshots found</td></tr>';
        }
        
        html += '</tbody></table>';
        document.getElementById('content').innerHTML = html;
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('content').innerHTML = '<p>Error loading data</p>';
    }
}

async function deleteRecord(endpoint, id) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    
    try {
        const response = await fetch(`/api/${endpoint}/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadCurrentTab();
        } else {
            alert('Error deleting record');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting record');
    }
}

// Initialize
loadCurrentTab();