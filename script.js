// script.js - Air Quality Dashboard with Supabase Realtime
// Mode Switch Tabel: Suhu & Blower ATAU Gas (CO, NOx, NH3)

// ============================================================
// KONFIGURASI SUPABASE
// ============================================================
const APP_SUPABASE_URL = 'https://imirwkngfsbalpdtxsdl.supabase.co';
const APP_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltaXJ3a25nZnNiYWxwZHR4c2RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjM5OTAsImV4cCI6MjA5MzQzOTk5MH0.ga1oO44cAFz8eduo9t8MOxQwrtlPSliQnoKdUNib1z4';

// ============================================================
// TABEL
// ============================================================
const TABLES = {
    SUHU: 'monitoring_suhu',
    GAS: 'monitoring_gas'
};

// ============================================================
// BATAS MAKSIMAL (Hanya untuk Gas)
// ============================================================
const BATAS_EMISI = {
    co: 546,
    nox: 250,
    nh3: 50
};

// ============================================================
// KONFIGURASI
// ============================================================
const AUTO_REFRESH_INTERVAL = 10000;
let autoRefreshTimer = null;
let supabaseClient = null;
let currentTable = TABLES.SUHU;
let allData = [];
let latestData = null;
let realtimeChannel = null;
let charts = {};

// ============================================================
// FUNGSI STATUS (Hanya untuk Gas)
// ============================================================
function getStatus(value, parameter) {
    if (value === null || value === undefined || value === '---') {
        return { class: 'loading', text: 'No Data', detail: 'Tidak ada data' };
    }

    if (parameter === 'co') {
        if (value <= BATAS_EMISI.co) {
            return { class: 'good', text: 'NORMAL', detail: `≤ ${BATAS_EMISI.co} ppm` };
        } else {
            return { class: 'danger', text: 'ALERT!', detail: `> ${BATAS_EMISI.co} ppm` };
        }
    }

    if (parameter === 'nox') {
        if (value <= BATAS_EMISI.nox) {
            return { class: 'good', text: 'NORMAL', detail: `≤ ${BATAS_EMISI.nox} ppm` };
        } else {
            return { class: 'danger', text: 'ALERT!', detail: `> ${BATAS_EMISI.nox} ppm` };
        }
    }

    if (parameter === 'nh3') {
        if (value <= BATAS_EMISI.nh3) {
            return { class: 'good', text: 'NORMAL', detail: `≤ ${BATAS_EMISI.nh3} ppm` };
        } else {
            return { class: 'danger', text: 'ALERT!', detail: `> ${BATAS_EMISI.nh3} ppm` };
        }
    }

    return { class: 'good', text: 'NORMAL', detail: '' };
}

// ============================================================
// FUNGSI BLOWER
// ============================================================
function getBlowerInfo(speed) {
    if (speed === null || speed === undefined) {
        return { text: 'No Data', class: '', display: '---', description: 'Tidak ada data' };
    }
    if (speed === 1) {
        return { text: 'LOW', class: 'blower-low', display: '1 (LOW)', description: 'Kecepatan rendah' };
    } else if (speed === 2) {
        return { text: 'MEDIUM', class: 'blower-medium', display: '2 (MEDIUM)', description: 'Kecepatan sedang' };
    } else if (speed === 3) {
        return { text: 'HIGH', class: 'blower-high', display: '3 (HIGH)', description: 'Kecepatan tinggi' };
    } else {
        return { text: `${speed}`, class: '', display: `Kecepatan ${speed}`, description: `Kecepatan ${speed}` };
    }
}

// ============================================================
// RENDER CARDS
// ============================================================
function renderCards() {
    const container = document.getElementById('cardsContainer');
    const isSuhu = currentTable === TABLES.SUHU;

    if (isSuhu) {
        // Mode Suhu: Hanya 2 card (Suhu & Blower)
        container.innerHTML = `
            <div class="emission-grid" style="grid-template-columns: repeat(2, 1fr);">
                <!-- Card Suhu -->
                <div class="card card-temp">
                    <div class="card-icon">
                        <i class="fas fa-thermometer-half"></i>
                    </div>
                    <div class="card-content">
                        <h3>🌡️ Temperature</h3>
                        <div class="value-container">
                            <span class="card-value" id="suhuValue">--</span>
                            <span class="card-unit">°C</span>
                        </div>
                        <p style="font-size:0.7rem;color:#6b8c5c;">Thermocouple K-Type | MAX31855</p>
                    </div>
                </div>

                <!-- Card Blower -->
                <div class="card card-blower">
                    <div class="card-icon">
                        <i class="fas fa-fan"></i>
                    </div>
                    <div class="card-content">
                        <h3>🔄 Blower Speed</h3>
                        <div class="value-container">
                            <span class="card-value" id="blowerValueCard">--</span>
                            <span class="card-unit" id="blowerUnitCard">Kecepatan</span>
                        </div>
                        <div id="blowerStatusCard" class="blower-status-text">Menunggu data...</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Mode Gas: 3 card (CO, NOx, NH3)
        container.innerHTML = `
            <div class="emission-grid">
                <!-- Card CO -->
                <div class="card card-co">
                    <div class="card-icon">
                        <i class="fas fa-smog"></i>
                    </div>
                    <div class="card-content">
                        <h3>💨 Carbon Monoxide (CO)</h3>
                        <div class="value-container">
                            <span class="card-value" id="coValue">--</span>
                            <span class="card-unit">ppm</span>
                        </div>
                        <div class="card-bm">Batas Maks: 546 ppm</div>
                        <div class="card-status" id="coStatus">
                            <span class="status-badge loading">Memuat...</span>
                        </div>
                    </div>
                </div>

                <!-- Card NOx -->
                <div class="card card-so2">
                    <div class="card-icon">
                        <i class="fas fa-wind"></i>
                    </div>
                    <div class="card-content">
                        <h3>🧪 Nitrogen Oxides (NOx)</h3>
                        <div class="value-container">
                            <span class="card-value" id="noxValue">--</span>
                            <span class="card-unit">ppm</span>
                        </div>
                        <div class="card-bm">Batas Maks: 250 ppm</div>
                        <div class="card-status" id="noxStatus">
                            <span class="status-badge loading">Memuat...</span>
                        </div>
                    </div>
                </div>

                <!-- Card NH3 -->
                <div class="card card-nox">
                    <div class="card-icon">
                        <i class="fas fa-vial"></i>
                    </div>
                    <div class="card-content">
                        <h3>🧪 Ammonia (NH₃)</h3>
                        <div class="value-container">
                            <span class="card-value" id="nh3Value">--</span>
                            <span class="card-unit">ppm</span>
                        </div>
                        <div class="card-bm">Batas Maks: 50 ppm</div>
                        <div class="card-status" id="nh3Status">
                            <span class="status-badge loading">Memuat...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// ============================================================
// UPDATE DASHBOARD
// ============================================================
function updateDashboard(data) {
    if (!data) return;

    const isSuhu = currentTable === TABLES.SUHU;

    if (isSuhu) {
        // === MODE SUHU ===
        const suhu = data.suhu_celsius !== undefined ? parseFloat(data.suhu_celsius) : '---';
        const blower = data.blower_speed !== undefined ? data.blower_speed : null;

        // Update card suhu
        const suhuEl = document.getElementById('suhuValue');
        if (suhuEl) {
            suhuEl.textContent = typeof suhu === 'number' ? suhu.toFixed(1) : suhu;
        }

        // Update card blower
        const blowerEl = document.getElementById('blowerValueCard');
        const blowerUnit = document.getElementById('blowerUnitCard');
        const blowerStatus = document.getElementById('blowerStatusCard');
        
        if (blowerEl && blowerStatus) {
            if (blower !== null) {
                const info = getBlowerInfo(blower);
                blowerEl.textContent = info.display;
                if (blowerUnit) blowerUnit.textContent = 'Kecepatan';
                blowerStatus.className = `blower-status-text ${info.class}`;
                blowerStatus.textContent = `🔄 ${info.text} - ${info.description}`;
            } else {
                blowerEl.textContent = '---';
                if (blowerUnit) blowerUnit.textContent = 'Kecepatan';
                blowerStatus.className = 'blower-status-text';
                blowerStatus.textContent = '⏳ Menunggu data blower...';
            }
        }

        // Update chart title
        document.getElementById('chartTitle').textContent = 'Tren Suhu (20 Data Terbaru)';
        document.getElementById('historyTitle').textContent = 'Riwayat Suhu & Blower (10 Rekam Terbaru)';
        document.getElementById('footerInfo').innerHTML = '<i class="fas fa-chart-simple"></i> Satuan: °C (suhu) | Kecepatan Blower: 1=LOW, 2=MEDIUM, 3=HIGH';
        document.getElementById('tableInfo').innerHTML = '<i class="fas fa-info-circle"></i> Menampilkan data suhu & blower';

    } else {
        // === MODE GAS ===
        const co = data.nilai_co_ppm !== undefined ? parseFloat(data.nilai_co_ppm) : '---';
        const nox = data.nilai_nox_ppm !== undefined ? parseFloat(data.nilai_nox_ppm) : '---';
        const nh3 = data.nilai_nh3_ppm !== undefined ? parseFloat(data.nilai_nh3_ppm) : '---';

        // CO
        const coEl = document.getElementById('coValue');
        if (coEl) {
            coEl.textContent = typeof co === 'number' ? co.toFixed(2) : co;
            const status = getStatus(co, 'co');
            const statusEl = document.getElementById('coStatus');
            if (statusEl) {
                statusEl.className = `status-badge ${status.class}`;
                statusEl.innerHTML = `<i class="fas ${status.class === 'danger' ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> ${status.text}`;
            }
        }

        // NOx
        const noxEl = document.getElementById('noxValue');
        if (noxEl) {
            noxEl.textContent = typeof nox === 'number' ? nox.toFixed(2) : nox;
            const status = getStatus(nox, 'nox');
            const statusEl = document.getElementById('noxStatus');
            if (statusEl) {
                statusEl.className = `status-badge ${status.class}`;
                statusEl.innerHTML = `<i class="fas ${status.class === 'danger' ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> ${status.text}`;
            }
        }

        // NH3
        const nh3El = document.getElementById('nh3Value');
        if (nh3El) {
            nh3El.textContent = typeof nh3 === 'number' ? nh3.toFixed(2) : nh3;
            const status = getStatus(nh3, 'nh3');
            const statusEl = document.getElementById('nh3Status');
            if (statusEl) {
                statusEl.className = `status-badge ${status.class}`;
                statusEl.innerHTML = `<i class="fas ${status.class === 'danger' ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> ${status.text}`;
            }
        }

        // Update chart title
        document.getElementById('chartTitle').textContent = 'Tren Emisi Gas (20 Data Terbaru)';
        document.getElementById('historyTitle').textContent = 'Riwayat Emisi Gas (10 Rekam Terbaru)';
        document.getElementById('footerInfo').innerHTML = '<i class="fas fa-chart-simple"></i> Satuan: ppm (CO/NOx/NH₃) | Batas: CO=546 | NOx=250 | NH₃=50';
        document.getElementById('tableInfo').innerHTML = '<i class="fas fa-info-circle"></i> Menampilkan data gas (CO, NOx, NH₃)';
    }

    // Update timestamp di footer info (jika ada)
    if (data.timestamp) {
        const formattedDate = new Date(data.timestamp).toLocaleString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = formattedDate;
        }
    }
}

// ============================================================
// RENDER CHARTS
// ============================================================
function renderCharts() {
    const grid = document.getElementById('chartsGrid');
    const isSuhu = currentTable === TABLES.SUHU;

    if (isSuhu) {
        // Mode Suhu: Hanya 1 grafik (Suhu)
        grid.innerHTML = `
            <div class="chart-card" style="grid-column: 1 / -1; max-width: 600px; margin: 0 auto; width: 100%;">
                <h4><i class="fas fa-thermometer-half"></i> Suhu (°C)</h4>
                <canvas id="chart1"></canvas>
            </div>
            <div style="display:none;"><canvas id="chart2"></canvas></div>
            <div style="display:none;"><canvas id="chart3"></canvas></div>
        `;
    } else {
        // Mode Gas: 3 grafik (CO, NOx, NH3)
        grid.innerHTML = `
            <div class="chart-card">
                <h4><i class="fas fa-smog"></i> CO (ppm)</h4>
                <canvas id="chart1"></canvas>
            </div>
            <div class="chart-card">
                <h4><i class="fas fa-wind"></i> NOx (ppm)</h4>
                <canvas id="chart2"></canvas>
            </div>
            <div class="chart-card">
                <h4><i class="fas fa-vial"></i> NH₃ (ppm)</h4>
                <canvas id="chart3"></canvas>
            </div>
        `;
    }
}

// ============================================================
// RENDER HISTORY HEADER
// ============================================================
function renderHistoryHeader() {
    const thead = document.getElementById('historyHeader');
    const isSuhu = currentTable === TABLES.SUHU;

    if (isSuhu) {
        thead.innerHTML = `
            <tr>
                <th>Waktu</th>
                <th>Suhu (°C)</th>
                <th>Blower</th>
                <th style="display:none;">CO</th>
                <th style="display:none;">NOx</th>
                <th style="display:none;">NH₃</th>
                <th>Status</th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr>
                <th>Waktu</th>
                <th>CO (ppm)</th>
                <th>NOx (ppm)</th>
                <th>NH₃ (ppm)</th>
                <th style="display:none;">Suhu</th>
                <th style="display:none;">Blower</th>
                <th>Status</th>
            </tr>
        `;
    }
}

// ============================================================
// UPDATE HISTORY TABLE
// ============================================================
function updateHistoryTable(dataArray) {
    const tbody = document.getElementById('historyBody');
    if (!tbody) return;

    if (!dataArray || dataArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-text">Tidak ada data</td></tr>';
        return;
    }

    const isSuhu = currentTable === TABLES.SUHU;
    const latest10 = [...dataArray].reverse().slice(0, 10);

    if (isSuhu) {
        // Mode Suhu: Tampilkan suhu & blower
        tbody.innerHTML = latest10.map(item => {
            const suhu = item.suhu_celsius !== undefined ? parseFloat(item.suhu_celsius) : null;
            const blower = item.blower_speed !== undefined ? item.blower_speed : null;
            const isAlert = suhu !== null && suhu > 45;
            const blowerInfo = getBlowerInfo(blower);

            return `
                <tr class="${isAlert ? 'alert-row' : ''}">
                    <td>${new Date(item.timestamp).toLocaleString('id-ID')}</td>
                    <td class="${isAlert ? 'danger-text' : 'normal-text'}">
                        ${suhu !== null ? suhu.toFixed(1) : '-'} °C
                    </td>
                    <td><span class="blower-badge ${blowerInfo.class}">${blower !== null ? blowerInfo.text : '-'}</span></td>
                    <td style="display:none;">-</td>
                    <td style="display:none;">-</td>
                    <td style="display:none;">-</td>
                    <td>
                        ${isAlert 
                            ? '<span class="status-badge-table danger">⚠️ ALERT</span>' 
                            : '<span class="status-badge-table good">✓ NORMAL</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        // Mode Gas: Tampilkan CO, NOx, NH3
        tbody.innerHTML = latest10.map(item => {
            const co = item.nilai_co_ppm !== undefined ? parseFloat(item.nilai_co_ppm) : null;
            const nox = item.nilai_nox_ppm !== undefined ? parseFloat(item.nilai_nox_ppm) : null;
            const nh3 = item.nilai_nh3_ppm !== undefined ? parseFloat(item.nilai_nh3_ppm) : null;
            
            const coStatus = co !== null ? getStatus(co, 'co') : { class: '' };
            const noxStatus = nox !== null ? getStatus(nox, 'nox') : { class: '' };
            const nh3Status = nh3 !== null ? getStatus(nh3, 'nh3') : { class: '' };
            
            const isAlert = coStatus.class === 'danger' || noxStatus.class === 'danger' || nh3Status.class === 'danger';

            return `
                <tr class="${isAlert ? 'alert-row' : ''}">
                    <td>${new Date(item.timestamp).toLocaleString('id-ID')}</td>
                    <td class="${coStatus.class === 'danger' ? 'danger-text' : 'normal-text'}">
                        ${co !== null ? co.toFixed(2) : '-'}
                    </td>
                    <td class="${noxStatus.class === 'danger' ? 'danger-text' : 'normal-text'}">
                        ${nox !== null ? nox.toFixed(2) : '-'}
                    </td>
                    <td class="${nh3Status.class === 'danger' ? 'danger-text' : 'normal-text'}">
                        ${nh3 !== null ? nh3.toFixed(2) : '-'}
                    </td>
                    <td style="display:none;">-</td>
                    <td style="display:none;">-</td>
                    <td>
                        ${isAlert 
                            ? '<span class="status-badge-table danger">⚠️ ALERT</span>' 
                            : '<span class="status-badge-table good">✓ NORMAL</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    }
}

// ============================================================
// UPDATE CHARTS
// ============================================================
function updateCharts(dataArray) {
    if (!dataArray || dataArray.length === 0) {
        console.warn('No data for charts');
        return;
    }

    const isSuhu = currentTable === TABLES.SUHU;
    const latest20 = [...dataArray].reverse().slice(0, 20);
    const labels = latest20.map(item => 
        new Date(item.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit', second:'2-digit'})
    );

    // Destroy existing charts
    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            charts[key].destroy();
            delete charts[key];
        }
    });

    if (isSuhu) {
        // Mode Suhu: Hanya chart suhu
        const suhuData = latest20.map(item => item.suhu_celsius || 0);
        createChart('chart1', 'Suhu (°C)', suhuData, labels, '#e74c3c', 0);
    } else {
        // Mode Gas: CO, NOx, NH3
        const coData = latest20.map(item => item.nilai_co_ppm || 0);
        const noxData = latest20.map(item => item.nilai_nox_ppm || 0);
        const nh3Data = latest20.map(item => item.nilai_nh3_ppm || 0);

        createChart('chart1', 'CO (ppm)', coData, labels, '#e74c3c', BATAS_EMISI.co);
        createChart('chart2', 'NOx (ppm)', noxData, labels, '#f39c12', BATAS_EMISI.nox);
        createChart('chart3', 'NH₃ (ppm)', nh3Data, labels, '#8e44ad', BATAS_EMISI.nh3);
    }
}

function createChart(canvasId, label, data, labels, color, threshold) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                borderColor: color,
                backgroundColor: color + '33',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: threshold > 0 ? data.map(v => v > threshold ? '#e74c3c' : '#2ecc71') : '#2ecc71',
                pointBorderColor: '#fff',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let value = context.raw;
                            let status = threshold > 0 && value > threshold ? '⚠️ MELEBIHI BATAS!' : '✓ NORMAL';
                            return `${context.dataset.label}: ${value.toFixed(2)} ${status}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: { display: true, text: label },
                    min: 0
                }
            }
        }
    });
}

// ============================================================
// FETCH DATA
// ============================================================
async function fetchData() {
    try {
        console.log('📥 Fetching data from:', currentTable);

        const { data, error } = await supabaseClient
            .from(currentTable)
            .select('*')
            .order('timestamp', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
            allData = data;
            latestData = data[data.length - 1];
            console.log('✅ Loaded', data.length, 'records');
            updateDashboard(latestData);
            updateHistoryTable(allData);
            updateCharts(allData);
            updateConnectionStatus(true);
        } else {
            console.warn('⚠️ No data found in', currentTable);
            updateConnectionStatus(true);
            updateHistoryTable([]);
        }

    } catch (error) {
        console.error('❌ Error fetching data:', error);
        updateConnectionStatus(false, error.message);
    }
}

// ============================================================
// SWITCH TABLE
// ============================================================
async function switchTable(tableName) {
    if (tableName === currentTable) return;

    console.log(`🔄 Switching from ${currentTable} to ${tableName}`);
    currentTable = tableName;

    // Re-render UI
    renderCards();
    renderCharts();
    renderHistoryHeader();

    // Destroy all charts
    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            charts[key].destroy();
            delete charts[key];
        }
    });

    // Setup new realtime subscription
    setupRealtimeSubscription();

    // Fetch new data
    await fetchData();
}

// ============================================================
// CONNECTION STATUS
// ============================================================
function updateConnectionStatus(isConnected, errorMsg = '') {
    const badge = document.getElementById('connectionStatus');
    if (!badge) return;

    const tableName = currentTable === TABLES.SUHU ? 'Suhu' : 'Gas';

    if (isConnected) {
        badge.innerHTML = `<span class="status-dot connected"></span> Terhubung ● Tabel: ${tableName} ● Auto-refresh: 10s`;
        badge.style.background = 'rgba(46, 204, 113, 0.2)';
        badge.style.color = '#2e7d32';
    } else {
        badge.innerHTML = `<span class="status-dot error"></span> Error: ${errorMsg || 'Disconnected'}`;
        badge.style.background = 'rgba(231, 76, 60, 0.2)';
        badge.style.color = '#c62828';
    }
}

// ============================================================
// AUTO-REFRESH
// ============================================================
async function autoRefreshData() {
    try {
        const { data, error } = await supabaseClient
            .from(currentTable)
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (data && data.length > 0) {
            const sortedData = [...data].reverse();
            const hasNewData = allData.length !== sortedData.length ||
                (allData[allData.length - 1]?.id !== sortedData[sortedData.length - 1]?.id);

            if (hasNewData) {
                console.log('📡 New data detected!');
                allData = sortedData;
                latestData = sortedData[sortedData.length - 1];
                updateDashboard(latestData);
                updateHistoryTable(allData);
                updateCharts(allData);
                flashDataUpdate();
            }
        }
    } catch (error) {
        console.error('❌ Auto-refresh error:', error);
    }
}

function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(autoRefreshData, AUTO_REFRESH_INTERVAL);
    console.log(`✅ Auto-refresh started: every ${AUTO_REFRESH_INTERVAL / 1000}s`);
}

// ============================================================
// REALTIME SUBSCRIPTION
// ============================================================
function setupRealtimeSubscription() {
    console.log('🔌 Setting up realtime subscription for:', currentTable);

    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
        .channel(`table-changes-${currentTable}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: currentTable
        }, (payload) => {
            console.log('📡 Real-time new data!', payload.new);
            allData.push(payload.new);
            latestData = payload.new;
            updateDashboard(payload.new);
            updateHistoryTable(allData);
            updateCharts(allData);
            flashDataUpdate();
        })
        .subscribe((status) => {
            console.log('Subscription status:', status);
        });
}

// ============================================================
// FLASH EFFECT
// ============================================================
function flashDataUpdate() {
    const container = document.querySelector('.dashboard-container');
    if (container) {
        container.style.transition = 'all 0.3s ease';
        container.style.boxShadow = '0 0 30px rgba(46, 204, 113, 0.5)';
        setTimeout(() => { container.style.boxShadow = ''; }, 500);
    }
}

// ============================================================
// UPDATE TIME
// ============================================================
function updateTopTimestamp() {
    const now = new Date();
    const currentTimeEl = document.getElementById('currentTime');
    if (currentTimeEl) {
        const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        currentTimeEl.innerHTML = `<i class="far fa-clock"></i> ${timeString}`;
    }
}

// ============================================================
// MANUAL REFRESH
// ============================================================
window.refreshData = async function() {
    const btn = document.querySelector('.refresh-btn');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';
        btn.disabled = true;
    }
    await fetchData();
    if (btn) {
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            btn.disabled = false;
        }, 1000);
    }
};

// ============================================================
// SWITCH TABLE (dipanggil dari HTML)
// ============================================================
window.changeTable = function(tableName) {
    switchTable(tableName);
};

// ============================================================
// INITIALIZATION
// ============================================================
async function initDashboard() {
    console.log('🚀 Initializing Air Quality Dashboard...');

    try {
        supabaseClient = window.supabase.createClient(APP_SUPABASE_URL, APP_SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized');

        // Render UI awal
        renderCards();
        renderCharts();
        renderHistoryHeader();

        await fetchData();
        setupRealtimeSubscription();
        startAutoRefresh();

        setInterval(updateTopTimestamp, 1000);
        updateTopTimestamp();

    } catch (error) {
        console.error('❌ Init error:', error);
        updateConnectionStatus(false, error.message);
    }
}

// ============================================================
// START
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}