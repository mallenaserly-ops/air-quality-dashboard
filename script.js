// script.js - Air Quality Dashboard with Supabase Realtime
// PERMEN LHK No. 70 Tahun 2016 - Updated with Blower Speed

// ============================================================
// KONFIGURASI SUPABASE
// ============================================================
const APP_SUPABASE_URL = 'https://imirwkngfsbalpdtxsdl.supabase.co';
const APP_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltaXJ3a25nZnNiYWxwZHR4c2RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjM5OTAsImV4cCI6MjA5MzQzOTk5MH0.ga1oO44cAFz8eduo9t8MOxQwrtlPSliQnoKdUNib1z4';
const APP_TABLE_NAME = 'emisi_data';

// ============================================================
// GLOBAL VARIABLES
// ============================================================
let supabaseClient = null;
let allSensorData = [];
let latestSensorData = null;
let realtimeChannel = null;

// ============================================================
// FUNGSI STATUS EMISI (PERMEN LHK 70/2016)
// ============================================================
function getStatus(value, parameter) {
    if (value === null || value === undefined || value === '---') {
        return { class: '', text: 'No Data', detail: 'Tidak ada data' };
    }
    
    // CO - Baku Mutu: 625 mg/Nm³
    if (parameter === 'co') {
        if (value <= 625) {
            return { class: 'good', text: 'Memenuhi BM', detail: '≤ 625 mg/Nm³' };
        } else {
            return { class: 'danger', text: 'Tdk Memenuhi BM', detail: '> 625 mg/Nm³' };
        }
    }
    
    // SO2 - Baku Mutu: 210 mg/Nm³
    if (parameter === 'so2') {
        if (value <= 210) {
            return { class: 'good', text: 'Memenuhi BM', detail: '≤ 210 mg/Nm³' };
        } else {
            return { class: 'danger', text: 'Tdk Memenuhi BM', detail: '> 210 mg/Nm³' };
        }
    }
    
    // NOx - Baku Mutu: 470 mg/Nm³
    if (parameter === 'nox') {
        if (value <= 470) {
            return { class: 'good', text: 'Memenuhi BM', detail: '≤ 470 mg/Nm³' };
        } else {
            return { class: 'danger', text: 'Tdk Memenuhi BM', detail: '> 470 mg/Nm³' };
        }
    }
    
    return { class: 'good', text: 'Memenuhi BM', detail: '' };
}

// ============================================================
// FUNGSI FORMAT BLOWER SPEED
// ============================================================
function getBlowerInfo(speed) {
    if (speed === 1) {
        return { 
            text: 'LOW', 
            class: 'blower-low', 
            display: 'LOW SPEED (Pendingin Maksimal)',
            description: 'Suhu > 300°C → Pendinginan maksimal'
        };
    } else if (speed === 2) {
        return { 
            text: 'MEDIUM', 
            class: 'blower-medium', 
            display: 'MEDIUM SPEED (Normal)',
            description: 'Suhu 100-300°C → Kecepatan normal'
        };
    } else if (speed === 3) {
        return { 
            text: 'HIGH', 
            class: 'blower-high', 
            display: 'HIGH SPEED (Aliran Rendah)',
            description: 'Suhu < 100°C → Aliran udara minimal'
        };
    } else {
        return { 
            text: 'OFF', 
            class: '', 
            display: 'OFF',
            description: 'Blower mati'
        };
    }
}

// ============================================================
// UPDATE DASHBOARD
// ============================================================
function updateDashboard(data) {
    if (!data) {
        console.warn('No data to update dashboard');
        return;
    }
    
    console.log('Updating dashboard with:', data);
    
    // Ambil nilai dari properti
    const coValue = data.co !== undefined ? parseFloat(data.co) : '---';
    const so2Value = data.so2 !== undefined ? parseFloat(data.so2) : '---';
    const noxValue = data.nox !== undefined ? parseFloat(data.nox) : '---';
    const tempValue = data.suhu !== undefined ? parseFloat(data.suhu) : '---';
    const blowerValue = data.blower_speed !== undefined ? data.blower_speed : null;
    
    // Update CO Card
    const coElement = document.getElementById('coValue');
    if (coElement) {
        coElement.textContent = typeof coValue === 'number' ? coValue.toFixed(4) : coValue;
        const coStatus = getStatus(coValue, 'co');
        const coStatusEl = document.getElementById('coStatus');
        if (coStatusEl) {
            coStatusEl.className = `status-indicator ${coStatus.class}`;
            coStatusEl.innerHTML = ` ${coStatus.text}`;
            coStatusEl.title = coStatus.detail;
        }
    }
    
    // Update SO2 Card
    const so2Element = document.getElementById('so2Value');
    if (so2Element) {
        so2Element.textContent = typeof so2Value === 'number' ? so2Value.toFixed(4) : so2Value;
        const so2Status = getStatus(so2Value, 'so2');
        const so2StatusEl = document.getElementById('so2Status');
        if (so2StatusEl) {
            so2StatusEl.className = `status-indicator ${so2Status.class}`;
            so2StatusEl.innerHTML = ` ${so2Status.text}`;
            so2StatusEl.title = so2Status.detail;
        }
    }
    
    // Update NOx Card
    const noxElement = document.getElementById('noxValue');
    if (noxElement) {
        noxElement.textContent = typeof noxValue === 'number' ? noxValue.toFixed(4) : noxValue;
        const noxStatus = getStatus(noxValue, 'nox');
        const noxStatusEl = document.getElementById('noxStatus');
        if (noxStatusEl) {
            noxStatusEl.className = `status-indicator ${noxStatus.class}`;
            noxStatusEl.innerHTML = ` ${noxStatus.text}`;
            noxStatusEl.title = noxStatus.detail;
        }
    }
    
    // Update Temperature Card
    const tempElement = document.getElementById('tempValue');
    if (tempElement) {
        tempElement.textContent = typeof tempValue === 'number' ? tempValue.toFixed(1) : tempValue;
    }
    
    // Update Blower Card
    const blowerElement = document.getElementById('blowerValue');
    const blowerStatusEl = document.getElementById('blowerStatus');
    if (blowerElement && blowerStatusEl) {
        if (blowerValue !== null && blowerValue !== undefined) {
            const blowerInfo = getBlowerInfo(blowerValue);
            blowerElement.textContent = blowerInfo.display;
            blowerStatusEl.className = `status-indicator ${blowerInfo.class}`;
            blowerStatusEl.innerHTML = ` ${blowerInfo.text}`;
            blowerStatusEl.title = blowerInfo.description;
        } else {
            blowerElement.textContent = '---';
            blowerStatusEl.className = 'status-indicator';
            blowerStatusEl.innerHTML = ' No Data';
        }
    }
    
    // Update timestamp & record ID
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl && data.created_at) {
        lastUpdateEl.textContent = new Date(data.created_at).toLocaleString('id-ID');
    }
    
    const recordIdEl = document.getElementById('recordId');
    if (recordIdEl && data.id) {
        recordIdEl.textContent = data.id;
    }
}

// ============================================================
// UPDATE HISTORY TABLE
// ============================================================
function updateHistoryTable(dataArray) {
    const tbody = document.getElementById('historyBody');
    if (!tbody) return;
    
    if (!dataArray || dataArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-text">No data available</td></tr>';
        return;
    }
    
    const latest10 = [...dataArray].reverse().slice(0, 10);
    
    tbody.innerHTML = latest10.map(item => {
        const blowerInfo = getBlowerInfo(item.blower_speed);
        return `
            <tr>
                <td>${new Date(item.created_at).toLocaleString('id-ID')}</td>
                <td>${typeof item.co === 'number' ? item.co.toFixed(4) : item.co}</td>
                <td>${typeof item.so2 === 'number' ? item.so2.toFixed(4) : item.so2}</td>
                <td>${typeof item.nox === 'number' ? item.nox.toFixed(4) : item.nox}</td>
                <td>${typeof item.suhu === 'number' ? item.suhu.toFixed(1) : item.suhu}</td>
                <td><span class="blower-badge ${blowerInfo.class}">${blowerInfo.text}</span></td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// UPDATE CONNECTION STATUS
// ============================================================
function updateConnectionStatus(isConnected, errorMsg = '') {
    const badge = document.getElementById('connectionStatus');
    if (!badge) return;
    
    if (isConnected) {
        badge.innerHTML = '<span class="status-dot connected"></span> Connected to Supabase (Realtime active)';
        badge.style.background = 'rgba(46, 204, 113, 0.2)';
    } else {
        badge.innerHTML = `<span class="status-dot error"></span> Error: ${errorMsg || 'Disconnected'}`;
        badge.style.background = 'rgba(231, 76, 60, 0.2)';
    }
}

// ============================================================
// FETCH DATA AWAL
// ============================================================
async function fetchInitialData() {
    try {
        console.log('📥 Fetching initial data from Supabase...');
        
        const { data, error } = await supabaseClient
            .from(APP_TABLE_NAME)
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            allSensorData = data;
            latestSensorData = data[data.length - 1];
            console.log('Sample data structure:', latestSensorData);
            console.log('Available columns:', Object.keys(latestSensorData));
            updateDashboard(latestSensorData);
            updateHistoryTable(allSensorData);
            console.log(`✅ Loaded ${data.length} records`);
            updateConnectionStatus(true);
        } else {
            console.log('⚠️ No data found in database');
            updateConnectionStatus(true);
            updateHistoryTable([]);
        }
        
    } catch (error) {
        console.error('❌ Error fetching data:', error);
        updateConnectionStatus(false, error.message);
    }
}

// ============================================================
// SETUP REALTIME SUBSCRIPTION
// ============================================================
function setupRealtimeSubscription() {
    console.log('🔌 Setting up realtime subscription...');
    
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }
    
    realtimeChannel = supabaseClient
        .channel('emisi-data-changes')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: APP_TABLE_NAME
        }, (payload) => {
            console.log('📡 New data received!', payload.new);
            
            allSensorData.push(payload.new);
            latestSensorData = payload.new;
            updateDashboard(payload.new);
            updateHistoryTable(allSensorData);
            
            // Flash effect pada cards
            const cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                card.style.transition = 'all 0.3s ease';
                card.style.boxShadow = '0 0 20px rgba(46, 204, 113, 0.5)';
                setTimeout(() => {
                    card.style.boxShadow = '';
                }, 500);
            });
        })
        .subscribe((status) => {
            console.log('Subscription status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime subscription active!');
            }
        });
}

// ============================================================
// INITIALIZATION
// ============================================================
async function initDashboard() {
    console.log('🚀 Initializing Air Quality Dashboard...');
    console.log('📡 Supabase URL:', APP_SUPABASE_URL);
    console.log('📊 Table:', APP_TABLE_NAME);
    console.log('📜 Regulasi: PERMEN LHK No. 70 Tahun 2016');
    
    try {
        supabaseClient = window.supabase.createClient(APP_SUPABASE_URL, APP_SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized');
        
        await fetchInitialData();
        setupRealtimeSubscription();
        
    } catch (error) {
        console.error('❌ Init error:', error);
        updateConnectionStatus(false, error.message);
    }
}

// ============================================================
// START THE APP
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}