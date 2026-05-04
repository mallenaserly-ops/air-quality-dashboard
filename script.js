// script.js - Air Quality Dashboard with Supabase Realtime
// Disesuaikan dengan struktur data Anda

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
// FUNGSI STATUS BERDASARKAN NILAI
// ============================================================
function getStatus(value, thresholds) {
    if (value === null || value === undefined) return { class: '', text: 'No data' };
    if (value <= thresholds.good) return { class: 'good', text: 'Safe' };
    if (value <= thresholds.moderate) return { class: 'warning', text: 'Moderate' };
    return { class: 'danger', text: 'Hazardous' };
}

// ============================================================
// UPDATE DASHBOARD DENGAN DATA DARI SUPABASE
// ============================================================
function updateDashboard(data) {
    if (!data) {
        console.warn('No data to update dashboard');
        return;
    }
    
    console.log('Updating dashboard with:', data);
    
    // Ambil nilai dari properti yang sesuai
    const coValue = data.co !== undefined ? data.co : '---';
    const noxValue = data.nox !== undefined ? data.nox : '---';
    const so2Value = data.so2 !== undefined ? data.so2 : '---';
    const tempValue = data.suhu !== undefined ? data.suhu : '---';
    
    console.log(`CO: ${coValue}, NOx: ${noxValue}, SO2: ${so2Value}, Suhu: ${tempValue}`);
    
    // Update CO Card
    const coElement = document.getElementById('coValue');
    if (coElement) {
        coElement.textContent = typeof coValue === 'number' ? coValue.toFixed(2) : coValue;
        const coStatus = getStatus(coValue, { good: 50, moderate: 100 }); // Threshold disesuaikan
        const coStatusEl = document.getElementById('coStatus');
        if (coStatusEl) coStatusEl.className = `status-indicator ${coStatus.class}`;
    }
    
    // Update NOx Card
    const noxElement = document.getElementById('noxValue');
    if (noxElement) {
        noxElement.textContent = typeof noxValue === 'number' ? noxValue.toFixed(2) : noxValue;
        const noxStatus = getStatus(noxValue, { good: 50, moderate: 100 });
        const noxStatusEl = document.getElementById('noxStatus');
        if (noxStatusEl) noxStatusEl.className = `status-indicator ${noxStatus.class}`;
    }
    
    // Update SO2 Card
    const so2Element = document.getElementById('so2Value');
    if (so2Element) {
        so2Element.textContent = typeof so2Value === 'number' ? so2Value.toFixed(2) : so2Value;
        const so2Status = getStatus(so2Value, { good: 50, moderate: 100 });
        const so2StatusEl = document.getElementById('so2Status');
        if (so2StatusEl) so2StatusEl.className = `status-indicator ${so2Status.class}`;
    }
    
    // Update Temperature Card (menggunakan suhu)
    const tempElement = document.getElementById('tempValue');
    if (tempElement) {
        tempElement.textContent = typeof tempValue === 'number' ? tempValue.toFixed(1) : tempValue;
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
        tbody.innerHTML = '<tr><td colspan="5" class="loading-text">No data available</td></tr>';
        return;
    }
    
    // Ambil 10 data terbaru (dari yang paling baru)
    const latest10 = [...dataArray].reverse().slice(0, 10);
    
    tbody.innerHTML = latest10.map(item => `
        <tr>
            <td>${new Date(item.created_at).toLocaleString('id-ID')}</td>
            <td>${typeof item.co === 'number' ? item.co.toFixed(2) : item.co}</td>
            <td>${typeof item.nox === 'number' ? item.nox.toFixed(2) : item.nox}</td>
            <td>${typeof item.so2 === 'number' ? item.so2.toFixed(2) : item.so2}</td>
            <td>${typeof item.suhu === 'number' ? item.suhu.toFixed(1) : item.suhu}</td>
        </tr>
    `).join('');
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
// FETCH DATA AWAL DARI SUPABASE
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