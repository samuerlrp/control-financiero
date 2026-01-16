// ============================================
// CONFIGURACIÓN DE FIREBASE
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyB35ULnu3mnwinb0gvrXLjtqzJyz8aMmH8",
    authDomain: "control-financiero-41940.firebaseapp.com",
    databaseURL: "https://control-financiero-41940-default-rtdb.firebaseio.com",
    projectId: "control-financiero-41940",
    storageBucket: "control-financiero-41940.firebasestorage.app",
    messagingSenderId: "845139333212",
    appId: "1:845139333212:web:bd91e87e922fe439d35699"
};

// ============================================
// CÓDIGO DE ACCESO
// ============================================
const ACCESS_CODE = "finanzas2025";

// ============================================
// INICIALIZACIÓN
// ============================================
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const transactionsRef = database.ref('shared/transactions');

// ============================================
// VARIABLES GLOBALES
// ============================================
let transactions = [];
let currentFilter = 'all';
let pieChart = null;
let barChart = null;
let isAuthenticated = false;

const CATEGORIES = ['Recreativos', 'Alimentos', 'Vivienda', 'Mantenimiento'];
const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

// ============================================
// VERIFICAR ACCESO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si ya está autenticado en localStorage
    const storedAuth = localStorage.getItem('financeAuth');
    if (storedAuth === ACCESS_CODE) {
        isAuthenticated = true;
        showApp();
        initApp();
    } else {
        showAccessScreen();
    }
    
    setupAccessListeners();
});

function showAccessScreen() {
    document.getElementById('accessScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display = 'none';
}

function showApp() {
    document.getElementById('accessScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
}

function setupAccessListeners() {
    const accessCodeInput = document.getElementById('accessCode');
    const btnAccess = document.getElementById('btnAccess');
    
    btnAccess.addEventListener('click', handleAccess);
    accessCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAccess();
    });
    
    // Logout
    document.getElementById('btnLogout').addEventListener('click', handleLogout);
}

function handleAccess() {
    const code = document.getElementById('accessCode').value.trim();
    const errorElement = document.getElementById('accessError');
    
    if (!code) {
        errorElement.textContent = 'Por favor ingresa el código';
        return;
    }
    
    if (code === ACCESS_CODE) {
        // Guardar autenticación
        localStorage.setItem('financeAuth', code);
        isAuthenticated = true;
        showApp();
        initApp();
        showNotification('✅ Acceso concedido');
    } else {
        errorElement.textContent = '❌ Código incorrecto. Intenta nuevamente.';
        document.getElementById('accessCode').value = '';
    }
}

function handleLogout() {
    if (confirm('¿Salir de la aplicación?')) {
        localStorage.removeItem('financeAuth');
        isAuthenticated = false;
        showAccessScreen();
        document.getElementById('accessCode').value = '';
        document.getElementById('accessError').textContent = '';
        showNotification('👋 Sesión cerrada');
    }
}

// ============================================
// INICIALIZACIÓN DE LA APP
// ============================================
function initApp() {
    setupEventListeners();
    setupFirebaseListeners();
    setDefaultDate();
    updateConnectionStatus('connecting');
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Botón agregar transacción
    document.getElementById('btnAgregar').addEventListener('click', addTransaction);

    // Cambio de tipo (mostrar/ocultar categoría)
    document.getElementById('tipo').addEventListener('change', (e) => {
        const categoriaGroup = document.getElementById('categoriaGroup');
        categoriaGroup.style.display = e.target.value === 'gasto' ? 'flex' : 'none';
    });

    // Filtros
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderTransactions();
        });
    });

    // Enter en inputs
    document.querySelectorAll('.input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addTransaction();
            }
        });
    });
}

// ============================================
// FIREBASE LISTENERS
// ============================================
function setupFirebaseListeners() {
    // Escuchar cambios en tiempo real
    transactionsRef.on('value', (snapshot) => {
        transactions = [];
        snapshot.forEach((childSnapshot) => {
            transactions.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        
        // Ordenar por timestamp descendente
        transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        renderTransactions();
        updateSummary();
        updateCharts();
        updateConnectionStatus('connected');
    }, (error) => {
        console.error('Error de Firebase:', error);
        updateConnectionStatus('disconnected');
    });

    // Monitorear estado de conexión
    database.ref('.info/connected').on('value', (snapshot) => {
        if (snapshot.val() === true) {
            updateConnectionStatus('connected');
        } else {
            updateConnectionStatus('disconnected');
        }
    });
}

// ============================================
// AGREGAR TRANSACCIÓN
// ============================================
function addTransaction() {
    if (!isAuthenticated) return;

    const tipo = document.getElementById('tipo').value;
    const monto = parseFloat(document.getElementById('monto').value);
    const categoria = document.getElementById('categoria').value;
    const fecha = document.getElementById('fecha').value;
    const descripcion = document.getElementById('descripcion').value;

    // Validaciones
    if (!monto || monto <= 0) {
        alert('⚠️ Por favor ingresa un monto válido');
        return;
    }

    if (!fecha) {
        alert('⚠️ Por favor selecciona una fecha');
        return;
    }

    // Crear objeto de transacción
    const transaction = {
        type: tipo,
        amount: monto,
        category: tipo === 'gasto' ? categoria : null,
        date: fecha,
        description: descripcion || 'Sin descripción',
        timestamp: new Date().toISOString()
    };

    // Guardar en Firebase
    transactionsRef.push(transaction)
        .then(() => {
            // Limpiar formulario
            document.getElementById('monto').value = '';
            document.getElementById('descripcion').value = '';
            setDefaultDate();
            
            // Mostrar feedback
            showNotification('✅ Transacción agregada correctamente');
        })
        .catch((error) => {
            console.error('Error al agregar transacción:', error);
            alert('❌ Error al agregar la transacción. Intenta nuevamente.');
        });
}

// ============================================
// ELIMINAR TRANSACCIÓN
// ============================================
function deleteTransaction(id) {
    if (!isAuthenticated) return;

    if (confirm('¿Estás seguro de eliminar esta transacción?')) {
        transactionsRef.child(id).remove()
            .then(() => {
                showNotification('🗑️ Transacción eliminada');
            })
            .catch((error) => {
                console.error('Error al eliminar:', error);
                alert('❌ Error al eliminar. Intenta nuevamente.');
            });
    }
}

// ============================================
// RENDERIZAR TRANSACCIONES
// ============================================
function renderTransactions() {
    const container = document.getElementById('transactionsList');
    const filtered = getFilteredTransactions();

    document.getElementById('transactionCount').textContent = `(${filtered.length})`;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>📝 No hay transacciones para mostrar</p>
                <p class="empty-subtitle">Agrega una transacción o cambia el filtro</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-badges">
                    <span class="badge ${t.type}">${t.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</span>
                    ${t.type === 'gasto' ? `<span class="badge categoria">${t.category}</span>` : ''}
                </div>
                <div class="transaction-description">${t.description}</div>
                <div class="transaction-date">${formatDate(t.date)}</div>
            </div>
            <div class="transaction-right">
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'ingreso' ? '+' : '-'}S/ ${t.amount.toFixed(2)}
                </div>
                <button class="btn-delete" onclick="deleteTransaction('${t.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ============================================
// FILTRAR TRANSACCIONES
// ============================================
function getFilteredTransactions() {
    const now = new Date();
    
    return transactions.filter(t => {
        const transDate = new Date(t.date);
        
        if (currentFilter === 'today') {
            return transDate.toDateString() === now.toDateString();
        } else if (currentFilter === 'month') {
            return transDate.getMonth() === now.getMonth() && 
                   transDate.getFullYear() === now.getFullYear();
        }
        return true;
    });
}

// ============================================
// ACTUALIZAR RESUMEN
// ============================================
function updateSummary() {
    const filtered = getFilteredTransactions();
    
    const totals = filtered.reduce((acc, t) => {
        if (t.type === 'ingreso') {
            acc.ingresos += t.amount;
        } else {
            acc.gastos += t.amount;
        }
        return acc;
    }, { ingresos: 0, gastos: 0 });

    const efectivo = totals.ingresos - totals.gastos;

    document.getElementById('efectivoTotal').textContent = formatCurrency(efectivo);
    document.getElementById('ingresosTotal').textContent = formatCurrency(totals.ingresos);
    document.getElementById('gastosTotal').textContent = formatCurrency(totals.gastos);
}

// ============================================
// ACTUALIZAR GRÁFICOS
// ============================================
function updateCharts() {
    const filtered = getFilteredTransactions();
    const gastos = filtered.filter(t => t.type === 'gasto');

    if (gastos.length === 0) {
        document.getElementById('chartsSection').style.display = 'none';
        return;
    }

    document.getElementById('chartsSection').style.display = 'grid';

    // Calcular totales por categoría
    const totalesPorCategoria = CATEGORIES.reduce((acc, cat) => {
        acc[cat] = gastos
            .filter(g => g.category === cat)
            .reduce((sum, g) => sum + g.amount, 0);
        return acc;
    }, {});

    const chartData = CATEGORIES.map((cat, idx) => ({
        name: cat,
        value: totalesPorCategoria[cat],
        color: COLORS[idx]
    })).filter(d => d.value > 0);

    updatePieChart(chartData);
    updateBarChart(chartData);
}

function updatePieChart(data) {
    const ctx = document.getElementById('pieChart');
    
    if (pieChart) {
        pieChart.destroy();
    }

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                data: data.map(d => d.value),
                backgroundColor: data.map(d => d.color),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: S/ ${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updateBarChart(data) {
    const ctx = document.getElementById('barChart');
    
    if (barChart) {
        barChart.destroy();
    }

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                label: 'Gastos (S/)',
                data: data.map(d => d.value),
                backgroundColor: data.map(d => d.color),
                borderWidth: 0,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => 'S/ ' + value.toFixed(0)
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `S/ ${context.parsed.y.toFixed(2)}`
                    }
                }
            }
        }
    });
}

// ============================================
// UTILIDADES
// ============================================
function formatCurrency(amount) {
    return 'S/ ' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-PE', options);
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fecha').value = today;
}

function updateConnectionStatus(status) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    statusDot.className = `status-dot ${status}`;
    
    const messages = {
        connected: '🟢 Conectado',
        disconnected: '🔴 Sin conexión',
        connecting: '🟡 Conectando...'
    };
    
    statusText.textContent = messages[status] || 'Desconocido';
}

function showNotification(message) {
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Agregar estilos de animación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
