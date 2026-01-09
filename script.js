// VARIABEL GLOBAL - Tetap di luar agar bisa diakses semua fungsi
let transactions = JSON.parse(localStorage.getItem('neo_data')) || [];
let savings = JSON.parse(localStorage.getItem('neo_savings')) || [];
let currentType = 'income';
let activeSubTab = 'ongoing';
let modalAction = null;

document.addEventListener('DOMContentLoaded', () => {
    const amountInput = document.getElementById('input-amount');
    
    // --- FITUR UPDATE TANGGAL (MEMPERBAIKI "MEMUAT TANGGAL") ---
    const dateEl = document.getElementById('current-date');
    if(dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
        });
    }

    // --- FORMATTER ---
    const formatNumber = (val) => {
        let value = val.toString().replace(/\D/g, "");
        return value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };
    const getRawValue = (val) => parseFloat(val.toString().replace(/\./g, "")) || 0;

    // Listener Input
    [amountInput, document.getElementById('save-target'), document.getElementById('save-daily')].forEach(input => {
        if (input) {
            input.addEventListener('input', (e) => {
                e.target.value = formatNumber(e.target.value);
                if (input.id !== 'input-amount') runCalculator(); 
            });
        }
    });

    // --- TOMBOL RESET ---
    const btnReset = document.getElementById('btn-reset');
    if(btnReset) {
        btnReset.onclick = () => { 
            showModal("Reset Data", "Semua data akan dihapus permanen!", () => { 
                localStorage.clear(); 
                transactions = []; 
                savings = []; 
                updateUI(); 
                showToast("Data berhasil dibersihkan!");
            }); 
        };
    }

    // --- SIMPAN TRANSAKSI ---
    document.getElementById('btn-save').onclick = () => {
        const amt = getRawValue(amountInput.value);
        if (amt <= 0) return showToast("Masukkan nominal!");
        
        transactions.unshift({
            id: Date.now(),
            amount: amt,
            desc: document.getElementById('input-desc').value.trim() || "Aktivitas",
            category: document.getElementById('input-category').value,
            type: currentType,
            date: new Date().toLocaleDateString('id-ID', {day:'numeric', month:'short'})
        });
        
        saveAndUpdate();
        showToast("Transaksi berhasil!");
        amountInput.value = ''; 
        document.getElementById('input-desc').value = '';
    };

    // --- TAMBAH TABUNGAN ---
    document.getElementById('btn-add-saving').onclick = () => {
        const name = document.getElementById('save-name').value.trim();
        const target = getRawValue(document.getElementById('save-target').value);
        const fill = getRawValue(document.getElementById('save-daily').value);
        
        if(!name || target <= 0 || fill <= 0) return showToast("Lengkapi data!");
        
        savings.unshift({ 
            id: Date.now(), name, target, fill, 
            cycle: document.getElementById('save-cycle').value, 
            collected: 0, status: 'ongoing' 
        });
        
        localStorage.setItem('neo_savings', JSON.stringify(savings));
        updateUI();
        showToast("Rencana dibuat!");
        document.getElementById('save-name').value = ''; 
        document.getElementById('save-target').value = ''; 
        document.getElementById('save-daily').value = '';
    };

    // Tombol Backspace & Chips
    document.getElementById('btn-backspace').onclick = () => {
        let current = amountInput.value.replace(/\./g, "");
        amountInput.value = formatNumber(current.slice(0, -1));
    };

    document.querySelectorAll('.chip').forEach(chip => {
        chip.onclick = () => {
            let currentVal = getRawValue(amountInput.value);
            amountInput.value = formatNumber((currentVal + parseInt(chip.dataset.val)).toString());
        };
    });

    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentType = btn.dataset.type;
        };
    });

    updateUI(); 
});

// --- FUNGSI GLOBAL ---

function saveAndUpdate() {
    localStorage.setItem('neo_data', JSON.stringify(transactions));
    updateUI();
}

function updateUI() {
    const listContainer = document.getElementById('transaction-list');
    if(!listContainer) return;
    listContainer.innerHTML = '';
    
    let totalInc = 0; let totalExp = 0;

    transactions.forEach(t => {
        const amt = parseFloat(t.amount);
        t.type === 'income' ? totalInc += amt : totalExp += amt;

        const li = document.createElement('li');
        li.className = 'item';
        li.innerHTML = `
            <div class="item-info"><p>${t.category}: ${t.desc}</p><small>${t.date}</small></div>
            <div style="display:flex; align-items:center; gap:12px">
                <p class="${t.type === 'income' ? 'text-success' : 'text-danger'}" style="font-weight:800; font-size:13px">
                    ${t.type === 'income' ? '+' : '-'} ${amt.toLocaleString('id-ID')}
                </p>
                <button onclick="deleteItem(${t.id})" style="background:none; border:none; color:var(--sub); cursor:pointer;"><span class="material-icons-round" style="font-size:18px">delete_outline</span></button>
            </div>`;
        listContainer.appendChild(li);
    });

    document.getElementById('display-balance').innerText = "Rp " + (totalInc - totalExp).toLocaleString('id-ID');
    document.getElementById('stat-inc').innerText = "Rp " + totalInc.toLocaleString('id-ID');
    document.getElementById('stat-exp').innerText = "Rp " + totalExp.toLocaleString('id-ID');

    // 3. PERSENTASE STATUS AMAN (Lengkungan)
    const ratio = totalInc > 0 ? (totalExp / totalInc) * 100 : 0;
    const circle = document.getElementById('chart-progress');
    if(circle) circle.setAttribute('stroke-dasharray', `${Math.min(ratio, 100)}, 100`);
    document.getElementById('chart-pct').textContent = Math.round(ratio) + "%";
    
    const statusTxt = document.getElementById('analysis-status');
    if(ratio > 80) { statusTxt.innerText = "Boros!"; statusTxt.style.color = "#ff4757"; }
    else { statusTxt.innerText = "Status Aman"; statusTxt.style.color = "#2ed573"; }

    // 4. PERSENTASE GLOBAL GOAL (Progress Bar)
    let totalTarget = 0; let totalColl = 0;
    savings.forEach(s => { totalTarget += s.target; totalColl += s.collected; });
    
    const globalPct = totalTarget > 0 ? (totalColl / totalTarget) * 100 : 0;
    const fillBar = document.getElementById('goal-fill');
    if(fillBar) fillBar.style.width = Math.min(globalPct, 100) + "%";
    document.getElementById('goal-pct').innerText = Math.round(globalPct) + "%";

    document.getElementById('list-empty').style.display = transactions.length ? 'none' : 'block';
    updateSavingsUI();
}

function updateSavingsUI() {
    const container = document.getElementById('savings-list');
    if(!container) return;
    container.innerHTML = '';
    const filtered = savings.filter(s => s.status === activeSubTab);
    
    document.getElementById('sum-active-saving').innerText = savings.filter(s => s.status === 'ongoing').length;
    document.getElementById('sum-done-saving').innerText = savings.filter(s => s.status === 'done').length;

    filtered.forEach(s => {
        const pct = (s.collected / s.target) * 100;
        const div = document.createElement('div');
        div.className = 'saving-item';
        div.innerHTML = `
            <h4>${s.name} <span class="text-success">${Math.round(pct)}%</span></h4>
            <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
            <div class="saving-grid">
                <div>Target: <b>Rp ${s.target.toLocaleString('id-ID')}</b></div>
                <div>Terkumpul: <b>Rp ${s.collected.toLocaleString('id-ID')}</b></div>
            </div>
            ${s.status === 'ongoing' ? `<button class="btn-primary" onclick="addSavingMoney(${s.id})" style="padding:10px; margin-top:10px; font-size:12px; height:auto;">+ Isi Saldo</button>` : ''}
            <p onclick="deleteSaving(${s.id})" style="text-align:center; font-size:10px; color:var(--sub); margin-top:15px; cursor:pointer">Hapus Rencana</p>`;
        container.appendChild(div);
    });
}

// --- AKSI ---
function addSavingMoney(id) {
    const s = savings.find(x => x.id === id);
    if(!s) return;
    s.collected += s.fill;
    if(s.collected >= s.target) { s.collected = s.target; s.status = 'done'; }
    
    transactions.unshift({ 
        id: Date.now(), amount: s.fill, desc: `Setoran: ${s.name}`, 
        category: 'Tabungan', type: 'expense', date: 'Hari ini' 
    });
    localStorage.setItem('neo_savings', JSON.stringify(savings));
    saveAndUpdate();
}

function deleteItem(id) {
    showModal("Hapus Data", "Yakin hapus riwayat ini?", () => {
        transactions = transactions.filter(t => t.id !== id);
        saveAndUpdate();
    });
}

function deleteSaving(id) {
    showModal("Hapus Rencana", "Hapus tabungan ini?", () => {
        savings = savings.filter(s => s.id !== id);
        localStorage.setItem('neo_savings', JSON.stringify(savings));
        updateUI();
    });
}

function switchMenu(menuId) {
    document.querySelectorAll('.menu-content').forEach(m => m.classList.remove('active-menu'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`menu-${menuId}`).classList.add('active-menu');
    if(event) event.currentTarget.classList.add('active');
    updateUI();
}

function filterSavings(status) {
    activeSubTab = status;
    document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    if(event) event.target.classList.add('active');
    updateSavingsUI();
}

function showModal(title, msg, onConfirm) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-msg').innerText = msg;
    document.getElementById('custom-modal').classList.add('active');
    modalAction = onConfirm;
}

document.getElementById('modal-cancel').onclick = () => document.getElementById('custom-modal').classList.remove('active');
document.getElementById('modal-confirm').onclick = () => {
    if(modalAction) modalAction();
    document.getElementById('custom-modal').classList.remove('active');
};

function showToast(msg) {
    const t = document.getElementById('toast');
    if(t) { t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }
}

function runCalculator() {
    const target = parseFloat(document.getElementById('save-target').value.replace(/\./g, "")) || 0;
    const fill = parseFloat(document.getElementById('save-daily').value.replace(/\./g, "")) || 0;
    const cycle = parseInt(document.getElementById('save-cycle').value);
    if(target > 0 && fill > 0) {
        const days = Math.ceil(target / fill) * cycle;
        const eta = new Date(); eta.setDate(eta.getDate() + days);
        const res = document.getElementById('calc-result');
        if(res) res.innerHTML = `Estimasi Selesai: <b>${eta.toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</b>`;
    }
        }
                                            
