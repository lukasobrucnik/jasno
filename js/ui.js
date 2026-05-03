/* =============================================
   JASNO. — ui.js
   DOM manipulace a renderování.
============================================= */
const ui = {
    selectedDate: new Date(),
    calendarViewDate: new Date(),
    activeTab: 'overview',
    _pendingDeleteId: null,

    init() {
        this.selectedDate = new Date();
        this.calendarViewDate = new Date();
        this.bindEvents();
        this.updateDate();
        this.render();
    },

    bindEvents() {
        // Zavření modalu kliknutím na overlay pozadí
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', e => {
                if (e.target === overlay) this.closeModals();
            });
        });
    },

    // ---- DATE ----
    updateDate() {
        const el = document.getElementById('current-date');
        const nextBtn = document.getElementById('next-day-btn');
        const options = { weekday: 'short', day: 'numeric', month: 'short' };
        let str = this.selectedDate.toLocaleDateString('cs-CZ', options);
        el.textContent = str.charAt(0).toUpperCase() + str.slice(1);

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const sel = new Date(this.selectedDate); sel.setHours(0, 0, 0, 0);
        if (nextBtn) {
            nextBtn.disabled = sel >= today;
        }
    },

    changeDate(delta) {
        const newDate = new Date(this.selectedDate);
        newDate.setDate(newDate.getDate() + delta);
        const today = new Date(); today.setHours(23, 59, 59, 999);
        if (delta > 0 && newDate > today) return;
        this.selectedDate = newDate;
        this.updateDate();
        this.render();
    },

    // ---- MAIN RENDER ----
    render() {
        const allowance = logic.getCurrentAllowance(this.selectedDate);
        const netIncome = logic.getNetIncome(this.selectedDate);
        const fixedTotal = logic.getFixedMonthlyTotal(this.selectedDate);
        const totalBudget = netIncome - fixedTotal;
        const spent = logic.getMonthlyTotalSpent(this.selectedDate);

        // Hero number
        const numEl = document.querySelector('.hero-number');
        if (numEl) {
            numEl.textContent = this.formatCurrency(allowance, false);
            numEl.classList.toggle('negative', allowance < 0);
        }

        // Arc progress
        this._renderArc(spent, totalBudget);

        // Arc total label
        const arcTotal = document.getElementById('arc-total');
        if (arcTotal) arcTotal.textContent = this.formatCurrency(totalBudget, false);

        // Stat cards
        const si = document.getElementById('stat-income');
        const sf = document.getElementById('stat-fixed');
        const sr = document.getElementById('stat-remaining');
        if (si) si.textContent = this.formatCurrency(netIncome);
        if (sf) sf.textContent = this.formatCurrency(fixedTotal);
        if (sr) {
            sr.textContent = this.formatCurrency(logic.getRemainingTotal(this.selectedDate));
            sr.style.color = logic.getRemainingTotal(this.selectedDate) < 0 ? 'var(--accent)' : '';
        }

        this._renderSpendMeter();
        this.renderTransactions();

        if (this.activeTab === 'charts') charts.init();
        if (this.activeTab === 'goals') this.renderGoals();
    },

    _renderSpendMeter() {
        const meter = document.getElementById('spend-meter');
        if (!meter) return;

        const ref = this.selectedDate;
        const budget = logic.getNetIncome(ref) - logic.getFixedMonthlyTotal(ref);

        if (budget <= 0) { meter.classList.add('hidden'); return; }
        meter.classList.remove('hidden');

        const safeToday = logic.getSafeToSpendToday(ref);
        const todaySpent = logic.getTodaySpent(ref);

        // Dot position: 3 equal visual sections mapped to spending ratio
        // 0–70% of recommended → left section (0%–33.33% of bar)
        // 70–130% → middle (33.33%–66.67%)
        // 130%+ → right (66.67%–100%)
        const ratio = safeToday > 0 ? todaySpent / safeToday : 0;
        let dotPct;
        if (ratio <= 0.7) {
            dotPct = (ratio / 0.7) * 33.33;
        } else if (ratio <= 1.3) {
            dotPct = 33.33 + ((ratio - 0.7) / 0.6) * 33.33;
        } else {
            dotPct = 66.67 + Math.min(1, (ratio - 1.3) / 0.7) * 33.33;
        }
        dotPct = Math.max(0, Math.min(100, dotPct));

        const zone = ratio <= 0.7 ? 'save' : ratio <= 1.3 ? 'ok' : 'over';

        // Dot
        const dot = document.getElementById('sm-dot');
        if (dot) dot.style.left = dotPct + '%';

        // Zone glow
        ['save', 'ok', 'over'].forEach(z => {
            document.getElementById('sm-zone-' + z)?.classList.toggle('active', z === zone);
        });

        // Label active color
        const activeClass = { save: 'active-save', ok: 'active-ok', over: 'active-over' };
        ['save', 'ok', 'over'].forEach(z => {
            const el = document.getElementById('sm-lbl-' + z);
            if (!el) return;
            el.classList.remove('active-save', 'active-ok', 'active-over');
            if (z === zone) el.classList.add(activeClass[z]);
        });

        // Threshold amounts at dividers
        const leftAmt = document.getElementById('sm-amt-left');
        const rightAmt = document.getElementById('sm-amt-right');
        if (leftAmt) leftAmt.textContent = this.formatCurrency(Math.round(safeToday * 0.7));
        if (rightAmt) rightAmt.textContent = this.formatCurrency(Math.round(safeToday * 1.3));

        // Recommended text
        const rec = document.getElementById('sm-rec');
        if (rec) rec.textContent = 'Doporučeno: ' + this.formatCurrency(Math.round(safeToday));
    },

    _renderArc(spent, totalBudget) {
        const arcFill = document.getElementById('arc-fill');
        if (!arcFill) return;
        const totalLength = 283; // approx arc length
        let ratio = 0;
        if (totalBudget > 0) ratio = Math.min(1, Math.max(0, spent / totalBudget));
        // Arc goes from 0% used (full arc visible) to 100% used (no arc visible)
        const offset = totalLength * ratio;
        arcFill.style.strokeDashoffset = offset;
        arcFill.classList.toggle('warning', ratio > 0.85);
    },

    renderTransactions() {
        const container = document.getElementById('transactions-container');
        if (!container) return;

        const m = this.selectedDate.getMonth();
        const y = this.selectedDate.getFullYear();
        const todayStr = this.selectedDate.toDateString();

        const allTxs = logic.data.transactions
            .filter(t => { const d = new Date(t.date); return d.getMonth() === m && d.getFullYear() === y; })
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allTxs.length === 0) {
            container.innerHTML = '<div class="empty-state">Zatím žádné výdaje. Přidej první.</div>';
            return;
        }

        const todayTxs = allTxs.filter(t => new Date(t.date).toDateString() === todayStr);
        const otherTxs = allTxs.filter(t => new Date(t.date).toDateString() !== todayStr);

        const txHTML = t => `
            <div class="tx-item" data-id="${t.id}" onclick="ui.handleTxClick(${t.id})">
                <div class="tx-icon-wrapper">${this.getCategoryIcon(t.category)}</div>
                <div class="tx-details">
                    <div class="tx-name">${t.note || 'Výdaj'}</div>
                    <div class="tx-date">${new Date(t.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div class="tx-amount">- ${this.formatCurrency(t.amount)}</div>
            </div>`;

        let html = '';

        if (todayTxs.length === 0) {
            html += '<div class="tx-empty-today">Zatím žádné výdaje pro dnešek</div>';
        } else {
            html += todayTxs.map(txHTML).join('');
        }

        if (otherTxs.length > 0) {
            html += '<div class="tx-section-label">Výdaje z ostatních dnů</div>';
            html += `<div class="tx-other">${otherTxs.map(txHTML).join('')}</div>`;
        }

        container.innerHTML = html;
    },

    handleTxClick(id) {
        if (this._pendingDeleteId === id) {
            // Second click — smazat
            logic.deleteTransaction(id);
            this._pendingDeleteId = null;
            this.render();
            this.showToast('Transakce smazána');
        } else {
            // First click — oznacit
            if (this._pendingDeleteId) {
                const old = document.querySelector(`[data-id="${this._pendingDeleteId}"]`);
                if (old) old.classList.remove('confirm-delete');
            }
            this._pendingDeleteId = id;
            const el = document.querySelector(`[data-id="${id}"]`);
            if (el) el.classList.add('confirm-delete');
            // Auto-reset po 2s
            setTimeout(() => {
                if (this._pendingDeleteId === id) {
                    this._pendingDeleteId = null;
                    const e = document.querySelector(`[data-id="${id}"]`);
                    if (e) e.classList.remove('confirm-delete');
                }
            }, 2000);
        }
    },

    showToast(msg) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2100);
    },

    // ---- CATEGORIES ----
    renderCategoryList() {
        const container = document.getElementById('category-list');
        const basics = [
            { id: 'food', name: 'Jídlo' },
            { id: 'coffee', name: 'Káva' },
            { id: 'transport', name: 'Doprava' },
            { id: 'entertainment', name: 'Zábava' },
            { id: 'health', name: 'Zdraví' }
        ];
        const all = [...basics, ...logic.data.customCategories];

        let html = all.map((cat, idx) => `
            <label class="category-option" title="${cat.name}">
                <input type="radio" name="category" value="${cat.id}" ${idx === 0 ? 'checked' : ''} onchange="ui.updateModalTitle('${cat.name}')">
                <div class="category-btn">${this.getCategoryIcon(cat.icon || cat.id)}</div>
            </label>
        `).join('');

        if (logic.data.customCategories.length < 3) {
            html += `<div class="add-category-btn" onclick="ui.handleNewCategoryClick()" title="Nová kategorie">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </div>`;
        }

        container.innerHTML = html;
        this.updateModalTitle(all[0].name);
    },

    updateModalTitle(name) {
        const el = document.getElementById('tx-modal-title');
        if (el) el.textContent = `VÝDAJ — ${name.toUpperCase()}`;
    },

    handleNewCategoryClick() {
        document.getElementById('category-name-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('new-category-name').focus(), 150);
    },

    submitNewCategory(e) {
        e.preventDefault();
        const input = document.getElementById('new-category-name');
        const name = input.value.trim();
        if (!name) return;
        const newId = logic.addCustomCategory(name);
        if (newId) {
            this.renderCategoryList();
            const radio = document.querySelector(`input[name="category"][value="${newId}"]`);
            if (radio) { radio.checked = true; this.updateModalTitle(name); }
        }
        this.closeCategoryModal();
        input.value = '';
    },

    closeCategoryModal() {
        document.getElementById('category-name-modal').classList.add('hidden');
    },

    // ---- INPUT FORMATTING ----
    formatInputField(event) {
        const input = event.target;
        const val = input.value.replace(/\D/g, '');

        // Suggestion
        const suggId = input.id + '-suggestion';
        const suggBox = document.getElementById(suggId);
        if (suggBox) {
            const sug = logic.getAmountSuggestion(val, this.selectedDate);
            if (sug) {
                suggBox.innerHTML = `${this.formatCurrency(sug)} <span class="tab-hint">TAB</span>`;
                suggBox.classList.remove('hidden');
                input.dataset.suggestion = sug;
            } else {
                suggBox.classList.add('hidden');
                input.dataset.suggestion = '';
            }
        }

        input.value = val ? parseInt(val, 10).toLocaleString('cs-CZ') : '';
    },

    handleAmountKeydown(event) {
        if (event.key === 'Tab') {
            const input = event.target;
            const sug = input.dataset.suggestion;
            const suggBox = document.getElementById(input.id + '-suggestion');
            if (sug && suggBox && !suggBox.classList.contains('hidden')) {
                event.preventDefault();
                input.value = this.formatCurrency(parseInt(sug, 10), false).replace(/\s/g, '').replace(/\u00a0/g, '');
                // reformat
                const fakeEvent = { target: input };
                const val = input.value.replace(/\D/g, '');
                input.value = val ? parseInt(val, 10).toLocaleString('cs-CZ') : '';
                suggBox.classList.add('hidden');
                input.dataset.suggestion = '';
                // Trigger oninput for tax display etc.
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    },

    // ---- FORMATTERS ----
    formatCurrency(amount, includeSymbol = true) {
        const n = Math.round(Math.abs(amount));
        const formatted = n.toLocaleString('cs-CZ');
        return includeSymbol ? `${formatted} Kč` : formatted;
    },

    getCategoryIcon(catId) {
        if (catId && catId.startsWith('data:')) {
            return `<img src="${catId}" style="width:16px;height:16px;object-fit:contain;filter:grayscale(1) brightness(2)" alt="">`;
        }
        const icons = {
            food: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/><path d="M12 3v9"/><path d="M7 6v6"/><path d="M17 6v6"/></svg>`,
            coffee: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>`,
            transport: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/></svg>`,
            entertainment: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
            health: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
            other: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`
        };

        const custom = logic.data.customCategories.find(c => c.id === catId);
        if (custom) {
            if (custom.icon) return `<img src="${custom.icon}" style="width:16px;height:16px;object-fit:contain;filter:grayscale(1) brightness(2)" alt="${custom.name}">`;
            return icons.other;
        }

        return icons[catId] || icons.other;
    },

    // ---- MODAL OPENERS ----
    openTransactionModal() {
        this.renderCategoryList();
        document.getElementById('transaction-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('tx-amount').focus(), 200);
    },

    openSetupModal() {
        const config = logic.getMonthlyConfig(this.selectedDate);
        const input = document.getElementById('setup-amount');
        input.value = config.income > 0 ? config.income.toLocaleString('cs-CZ') : '';
        input.dataset.suggestion = '';

        const freqRadio = document.querySelector(`input[name="income-freq"][value="${config.incomeFrequency}"]`);
        if (freqRadio) freqRadio.checked = true;

        const taxRadio = document.querySelector(`input[name="tax-mode"][value="${config.isGross ? 'gross' : 'net'}"]`);
        if (taxRadio) taxRadio.checked = true;

        this.updateTaxDisplay();
        document.getElementById('setup-modal').classList.remove('hidden');
        setTimeout(() => input.focus(), 200);
    },

    openFixedModal() {
        this.renderFixedList();
        document.getElementById('fixed-setup-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('fixed-name').focus(), 200);
    },

    openGoalModal() {
        document.getElementById('goal-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('goal-name').focus(), 200);
    },

    openGoalDepositModal(id) {
        document.getElementById('deposit-goal-id').value = id;
        document.getElementById('deposit-amount').value = '';
        document.getElementById('goal-deposit-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('deposit-amount').focus(), 200);
    },

    closeModals() {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
    },

    // ---- FIXED EXPENSES ----
    renderFixedList() {
        const container = document.getElementById('fixed-expenses-list');
        const config = logic.getMonthlyConfig(this.selectedDate);
        const list = config.fixedExpenses;

        if (list.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:16px 0;font-size:0.8rem;">Zatím žádné fixní výdaje.</div>';
            return;
        }

        const freqs = { daily: 'Denně', weekly: 'Týdně', monthly: 'Měsíčně' };
        const daysInMonth = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth() + 1, 0).getDate();

        container.innerHTML = list.map(item => {
            let monthlyVal = item.amount;
            let extra = '';
            if (item.frequency === 'daily') { monthlyVal = item.amount * daysInMonth; extra = ` → ${this.formatCurrency(monthlyVal)}/měs.`; }
            if (item.frequency === 'weekly') { monthlyVal = item.amount * (daysInMonth / 7); extra = ` → ${this.formatCurrency(monthlyVal)}/měs.`; }
            return `
                <div class="fixed-item">
                    <div class="fixed-item-info">
                        <div class="fixed-item-name">${item.name}</div>
                        <div class="fixed-item-amount">${this.formatCurrency(item.amount)} / ${freqs[item.frequency] || 'Měsíčně'}<span style="color:var(--accent);opacity:0.8;"> ${extra}</span></div>
                    </div>
                    <button class="fixed-item-delete" onclick="ui.deleteFixedExpense(${item.id})" aria-label="Smazat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                </div>
            `;
        }).join('');
    },

    deleteFixedExpense(id) {
        logic.removeFixedExpense(id, this.selectedDate);
        this.renderFixedList();
        this.render();
    },

    submitFixedExpense(e) {
        e.preventDefault();
        const name = document.getElementById('fixed-name').value.trim();
        const raw = document.getElementById('fixed-amount').value.replace(/\D/g, '');
        const amount = parseFloat(raw);
        const freq = document.querySelector('input[name="fixed-freq"]:checked').value;

        if (!name || !amount || amount <= 0) return;

        logic.addFixedExpense(name, amount, freq, this.selectedDate);
        document.getElementById('add-fixed-form').reset();
        document.querySelector('input[name="fixed-freq"][value="monthly"]').checked = true;
        this.renderFixedList();
        this.render();
        this.showToast('Fixní výdaj přidán');
    },

    // ---- TAX DISPLAY ----
    updateTaxDisplay() {
        const isGross = document.querySelector('input[name="tax-mode"]:checked')?.value === 'gross';
        const box = document.getElementById('tax-animation-box');
        if (!box) return;
        const raw = document.getElementById('setup-amount').value.replace(/\D/g, '');
        const amount = parseFloat(raw) || 0;

        if (isGross && amount > 0) {
            box.classList.remove('collapsed');
            document.getElementById('tax-value-display').textContent = `- ${this.formatCurrency(amount * 0.20)}`;
        } else {
            box.classList.add('collapsed');
        }
    },

    // ---- FORM SUBMITS ----
    submitTransaction(e) {
        e.preventDefault();
        const raw = document.getElementById('tx-amount').value.replace(/\D/g, '');
        const amount = parseFloat(raw);
        if (!amount || amount <= 0) return;

        const catEl = document.querySelector('input[name="category"]:checked');
        const category = catEl ? catEl.value : 'other';

        const basics = { food: 'Jídlo', coffee: 'Káva', transport: 'Doprava', entertainment: 'Zábava', health: 'Zdraví' };
        let catName = basics[category];
        if (!catName) {
            const custom = logic.data.customCategories.find(c => c.id === category);
            catName = custom ? custom.name : 'Výdaj';
        }

        const noteInput = document.getElementById('tx-note');
        const note = noteInput.value.trim() || catName;

        const txDate = new Date(this.selectedDate);
        const today = new Date();
        if (txDate.toDateString() === today.toDateString()) {
            txDate.setHours(today.getHours(), today.getMinutes(), today.getSeconds());
        } else {
            txDate.setHours(12, 0, 0, 0);
        }

        logic.addTransaction(amount, category, note, txDate.toISOString());
        this.closeModals();
        this.render();
        this.showToast('Máš uloženo ✓');
        setTimeout(() => document.getElementById('tx-form').reset(), 300);
    },

    submitSetup(e) {
        e.preventDefault();
        const raw = document.getElementById('setup-amount').value.replace(/\D/g, '');
        const amount = parseFloat(raw) || 0;
        const isGross = document.querySelector('input[name="tax-mode"]:checked').value === 'gross';
        const incomeFreq = document.querySelector('input[name="income-freq"]:checked').value;
        logic.setIncome(amount, isGross, incomeFreq, this.selectedDate);
        this.closeModals();
        this.render();
        this.showToast('Příjmy uloženy');
    },

    // ---- GOALS ----
    submitGoal(e) {
        e.preventDefault();
        const name = document.getElementById('goal-name').value.trim();
        const raw = document.getElementById('goal-amount').value.replace(/\D/g, '');
        const amount = parseFloat(raw);
        if (!name || isNaN(amount) || amount <= 0) return;
        logic.addGoal(name, amount);
        this.closeModals();
        document.getElementById('goal-name').value = '';
        document.getElementById('goal-amount').value = '';
        this.renderGoals();
        this.showToast('Cíl přidán');
    },

    submitGoalDeposit(e) {
        e.preventDefault();
        const id = parseInt(document.getElementById('deposit-goal-id').value, 10);
        const raw = document.getElementById('deposit-amount').value.replace(/\D/g, '');
        const amount = parseFloat(raw);
        if (!amount || amount <= 0) return;
        const goal = logic.data.goals.find(g => g.id === id);
        if (goal) {
            logic.updateGoalSaved(id, goal.saved + amount);
            this.closeModals();
            this.renderGoals();
            this.showToast(`+ ${this.formatCurrency(amount)} přidáno`);
        }
    },

    renderGoals() {
        const container = document.getElementById('goals-container');
        if (!container) return;
        const goals = logic.data.goals;
        if (goals.length === 0) {
            container.innerHTML = '<div class="empty-state">Zatím žádné cíle. Přidej první.</div>';
            return;
        }
        container.innerHTML = goals.map(goal => {
            const percent = Math.min(100, Math.round((goal.saved / goal.amount) * 100));
            return `
                <div class="glass-card goal-card">
                    <div class="goal-header">
                        <div class="goal-name">${goal.name}</div>
                        <div class="goal-percent">${percent} %</div>
                    </div>
                    <div class="goal-jar-container">
                        <div class="goal-fill" style="width:${percent}%"></div>
                    </div>
                    <div class="goal-stats">
                        <span>${this.formatCurrency(goal.saved)}</span>
                        <span>z ${this.formatCurrency(goal.amount)}</span>
                    </div>
                    <div class="goal-actions">
                        <button class="btn-secondary" onclick="ui.openGoalDepositModal(${goal.id})">+ PŘIDAT</button>
                        <button class="btn-secondary danger" onclick="ui.handleGoalDelete(${goal.id})">SMAZAT</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    handleGoalDelete(id) {
        logic.deleteGoal(id);
        this.renderGoals();
        this.showToast('Cíl smazán');
    },

    // ---- CLEAR DATA ----
    clearData() {
        if (confirm('Opravdu smazat všechna data?')) {
            logic.clearData();
            this.render();
            this.showToast('Data smazána');
        }
    },

    selectChartMonth(monthIndex) {
        const year = this.selectedDate.getFullYear();
        this.selectedDate = new Date(year, monthIndex, 1);
        this.render();
    },

    // ---- TABS ----
    switchTab(tabId) {
        this.selectedDate = new Date();
        this.activeTab = tabId;
        document.querySelectorAll('.tab-content').forEach(t => { t.classList.remove('active'); t.classList.add('hidden'); });
        const target = document.getElementById('tab-' + tabId);
        if (target) { target.classList.remove('hidden'); target.classList.add('active'); }

        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        const navEl = document.getElementById('nav-' + tabId);
        if (navEl) navEl.classList.add('active');

        if (tabId === 'charts') charts.init();
        else if (tabId === 'goals') this.renderGoals();
        else if (tabId === 'overview') this.render();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ---- CALENDAR ----
    openCalendar() {
        this.calendarViewDate = new Date(this.selectedDate);
        this.renderCalendar();
        document.getElementById('calendar-modal').classList.remove('hidden');
    },

    renderCalendar() {
        const el = document.getElementById('calendar-month-year');
        const grid = document.getElementById('calendar-days');
        const month = this.calendarViewDate.getMonth();
        const year = this.calendarViewDate.getFullYear();
        const monthNames = ['LEDEN', 'ÚNOR', 'BŘEZEN', 'DUBEN', 'KVĚTEN', 'ČERVEN', 'ČERVENEC', 'SRPEN', 'ZÁŘÍ', 'ŘÍJEN', 'LISTOPAD', 'PROSINEC'];
        el.textContent = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        let firstDayIdx = firstDay === 0 ? 6 : firstDay - 1;
        const today = new Date();
        let html = '';
        for (let i = 0; i < firstDayIdx; i++) html += '<div class="calendar-day empty"></div>';
        for (let i = 1; i <= lastDate; i++) {
            const isToday = today.getDate() === i && today.getMonth() === month && today.getFullYear() === year;
            const isSel = this.selectedDate.getDate() === i && this.selectedDate.getMonth() === month && this.selectedDate.getFullYear() === year;
            html += `<div class="calendar-day ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''}" onclick="ui.selectCalendarDate(${i})">${i}</div>`;
        }
        grid.innerHTML = html;
    },

    selectCalendarDate(day) {
        this.selectedDate = new Date(this.calendarViewDate.getFullYear(), this.calendarViewDate.getMonth(), day);
        this.closeModals();
        this.updateDate();
        this.render();
    },

    prevCalendarMonth() { this.calendarViewDate.setMonth(this.calendarViewDate.getMonth() - 1); this.renderCalendar(); },
    nextCalendarMonth() { this.calendarViewDate.setMonth(this.calendarViewDate.getMonth() + 1); this.renderCalendar(); }
};