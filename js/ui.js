const ui = {
    init() {
        this.selectedDate = new Date();
        this.calendarViewDate = new Date();
        this.bindEvents();
        this.render();
        this.updateDate();
        this.activeTab = 'overview';
    },
    
    bindEvents() {
        // Zavření modalů při kliknutí na pozadí overlaye
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeModals();
            });
        });
    },

    updateDate() {
        const dateDisplay = document.getElementById('current-date');
        const nextBtn = document.getElementById('next-day-btn');
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        
        let dateString = this.selectedDate.toLocaleDateString('cs-CZ', options);
        // První písmeno velké
        dateString = dateString.charAt(0).toUpperCase() + dateString.slice(1);
        dateDisplay.textContent = dateString;
        
        // Zakázat tlačítko dopředu, pokud jsme v budoucnu (volitelné, ale logické pro rozpočet)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sel = new Date(this.selectedDate);
        sel.setHours(0, 0, 0, 0);
        
        if (nextBtn) {
            nextBtn.disabled = sel >= today;
            nextBtn.style.opacity = sel >= today ? '0.3' : '1';
        }
    },
    
    changeDate(delta) {
        this.selectedDate.setDate(this.selectedDate.getDate() + delta);
        this.updateDate();
        this.render(); // Překreslit data pro daný den
    },
    
    handleDateSelect(e) {
        const newDate = new Date(e.target.value);
        if (!isNaN(newDate.getTime())) {
            this.selectedDate = newDate;
            this.updateDate();
            this.render();
        }
    },
    
    render() {
        // Natvrdo zobrazeno vždy zbývající měsíční částka podle přání uživatele
        const allowance = logic.getCurrentAllowance(this.selectedDate);
        const allowanceEl = document.getElementById('daily-allowance');
        const allowanceTitle = document.getElementById('allowance-title');
        
        if (this.data?.viewMode === 'monthly') {
            allowanceTitle.textContent = 'TENTO MĚSÍC MŮŽEŠ UTRATIT';
        } else if (this.data?.viewMode === 'weekly') {
            allowanceTitle.textContent = 'TENTO TÝDEN MŮŽEŠ UTRATIT';
        } else {
            allowanceTitle.textContent = 'DNES MŮŽEŠ UTRATIT';
        }
        
        // Vykreslení částky
        allowanceEl.innerHTML = `${this.formatCurrency(allowance, false)} <span class="currency">Kč</span>`;
        if (allowance < 0) {
            allowanceEl.classList.add('negative');
        } else {
            allowanceEl.classList.remove('negative');
        }

        // Logic for visual progress bar (budget status)
        const progressBar = document.getElementById('allowance-progress');
        const totalBudget = logic.getNetIncome(this.selectedDate) - logic.getFixedMonthlyTotal(this.selectedDate);
        if (totalBudget > 0) {
            const spent = logic.getMonthlyTotalSpent(this.selectedDate);
            let percent = 100 - ((spent / totalBudget) * 100);
            if (percent < 0) percent = 0;
            progressBar.style.width = `${percent}%`;
            
            if (percent < 15) {
                progressBar.classList.add('warning');
            } else {
                progressBar.classList.remove('warning');
            }
        } else {
            progressBar.style.width = '0%';
        }
        
        // Vykreslení karet
        document.getElementById('stat-income').textContent = this.formatCurrency(logic.getNetIncome(this.selectedDate));
        document.getElementById('stat-fixed').textContent = this.formatCurrency(logic.getFixedMonthlyTotal(this.selectedDate));
        document.getElementById('stat-remaining').textContent = this.formatCurrency(logic.getRemainingTotal(this.selectedDate));
        
        this.renderTransactions();
        this.renderGoals();
        if (this.activeTab === 'charts') charts.init();
    },
    
    renderTransactions() {
        const container = document.getElementById('transactions-container');
        
        // Filter by selected month
        const m = this.selectedDate.getMonth();
        const y = this.selectedDate.getFullYear();
        
        const txs = logic.data.transactions
            .filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === m && d.getFullYear() === y;
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (txs.length === 0) {
            container.innerHTML = '<div class="empty-state">Zatím žádné výdaje v tomto měsíci.</div>';
            return;
        }
        
        container.innerHTML = txs.map(t => `
            <div class="tx-item">
                <div class="tx-icon-wrapper">
                    ${this.getCategoryIcon(t.category)}
                </div>
                <div class="tx-details">
                    <div class="tx-name">${t.note || 'Výdaj'}</div>
                    <div class="tx-date">${new Date(t.date).toLocaleDateString('cs-CZ')}</div>
                </div>
                <div class="tx-amount">-${this.formatCurrency(t.amount)}</div>
            </div>
        `).join('');
    },

    renderCategoryList() {
        const container = document.getElementById('category-list');
        const basics = [
            { id: 'food', name: 'Jídlo', icon: 'food' },
            { id: 'coffee', name: 'Káva', icon: 'coffee' },
            { id: 'transport', name: 'Doprava', icon: 'transport' }
        ];
        
        const customs = logic.data.customCategories;
        const all = [...basics, ...customs];
        
        let html = all.map((cat, idx) => `
            <label class="category-option" title="${cat.name}">
                <input type="radio" name="category" value="${cat.id}" ${idx === 0 ? 'checked' : ''} onchange="ui.updateModalTitle('${cat.name}')">
                <div class="category-btn">
                    ${this.getCategoryIcon(cat.icon || cat.id)}
                </div>
            </label>
        `).join('');
        
        // Přidat tlacitko pro novou kategorii (pokud jich není moc)
        if (customs.length < 3) {
            html += `
                <div class="add-category-btn" onclick="ui.handleNewCategoryClick()">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                </div>
            `;
        }
        
        container.innerHTML = html;
        this.updateModalTitle(all[0].name);
    },

    updateModalTitle(categoryName) {
        document.getElementById('tx-modal-title').textContent = `VÝDAJ ZA ${categoryName.toUpperCase()}`;
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
        
        const newId = logic.addCustomCategory(name, null);
        if (newId) {
            this.renderCategoryList();
            
            // Vybrat nově vytvořenou kategorii
            const radio = document.querySelector(`input[name="category"][value="${newId}"]`);
            if (radio) radio.checked = true;
            this.updateModalTitle(name);
        }
        
        this.closeCategoryModal();
        input.value = '';
    },
    
    closeCategoryModal() {
        document.getElementById('category-name-modal').classList.add('hidden');
    },
    
    formatInputField(event) {
        let input = event.target;
        // Povolí pouze číslice
        let val = input.value.replace(/\D/g, '');
        
        // Autocomplete Suggestion Logic
        const suggestionBox = document.getElementById(input.id + '-suggestion');
        if (suggestionBox) {
            const suggestion = logic.getAmountSuggestion(val);
            if (suggestion) {
                suggestionBox.innerHTML = `${this.formatCurrency(suggestion)} <span class="tab-hint">TAB</span>`;
                suggestionBox.classList.remove('hidden');
                input.dataset.suggestion = suggestion;
            } else {
                suggestionBox.classList.add('hidden');
                input.dataset.suggestion = '';
            }
        }
        
        if (val) {
            input.value = parseInt(val, 10).toLocaleString('cs-CZ');
        } else {
            input.value = '';
        }
    },
    
    handleAmountKeydown(event) {
        if (event.key === 'Tab') {
            const input = event.target;
            const suggestion = input.dataset.suggestion;
            const suggestionBox = document.getElementById(input.id + '-suggestion');
            
            if (suggestion && suggestionBox && !suggestionBox.classList.contains('hidden')) {
                event.preventDefault();
                input.value = this.formatCurrency(suggestion, false);
                suggestionBox.classList.add('hidden');
                input.dataset.suggestion = '';
                
                // Vynutit update navázaných eventů (např. daně)
                const e = new Event('input', { bubbles: true });
                input.dispatchEvent(e);
            }
        }
    },
    
    formatCurrency(amount, includeSymbol = true) {
        const formatted = Math.floor(amount).toLocaleString('cs-CZ');
        return includeSymbol ? `${formatted} Kč` : formatted;
    },
    
    getCategoryIcon(catId) {
        // Pokud id začíná "data:", jde o custom base64 obrázek
        if (catId.startsWith('data:')) {
            return `<img src="${catId}" class="custom-icon-img" alt="Icon">`;
        }
        
        const icons = {
            food: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/><path d="M12 3v9"/><path d="M7 6v6"/><path d="M17 6v6"/></svg>`,
            coffee: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>`,
            transport: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M10 4v7"/><path d="M14 4v7"/></svg>`,
            other: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`
        };
        
        // Zkusit najít ikonu podle ID (pro custom kategorie)
        const custom = logic.data.customCategories.find(c => c.id === catId);
        if (custom) {
            if (custom.icon) {
                return `<img src="${custom.icon}" class="custom-icon-img" alt="${custom.name}">`;
            } else {
                // Výchozí ikona, pokud uživatel nenahraje obrázek (hvězda)
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            }
        }
        
        return icons[catId] || icons.other;
    },
    
    openTransactionModal() {
        this.renderCategoryList();
        document.getElementById('transaction-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('tx-amount').focus(), 150);
    },
    
    openSetupModal() {
        document.getElementById('setup-modal').classList.remove('hidden');
        const input = document.getElementById('setup-amount');
        const settingsBlock = document.getElementById('income-settings-block');
        
        const config = logic.getMonthlyConfig(this.selectedDate);
        
        input.value = config.income > 0 ? this.formatCurrency(config.income, false) : '';
        input.dataset.type = 'income';
        
        document.getElementById('setup-title').textContent = 'NASTAVIT PŘÍJMY';
        settingsBlock.classList.remove('hidden');
        
        // Set current toggles
        const freqRadio = document.querySelector(`input[name="income-freq"][value="${config.incomeFrequency}"]`);
        if (freqRadio) freqRadio.checked = true;
        
        const taxRadio = document.querySelector(`input[name="tax-mode"][value="${config.isGross ? 'gross' : 'net'}"]`);
        if (taxRadio) taxRadio.checked = true;
        
        this.updateTaxDisplay();
        setTimeout(() => input.focus(), 150);
    },
    
    openFixedModal() {
        this.renderFixedList();
        document.getElementById('fixed-setup-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('fixed-name').focus(), 150);
    },
    
    renderFixedList() {
        const container = document.getElementById('fixed-expenses-list');
        const config = logic.getMonthlyConfig(this.selectedDate);
        const list = config.fixedExpenses;
        
        if (list.length === 0) {
            container.innerHTML = '<div class="empty-state" style="margin: 0;">Zatím žádné fixní výdaje.</div>';
            return;
        }
        
        const freqs = { 'daily': 'Denně', 'weekly': 'Týdně', 'monthly': 'Měsíčně' };
        const daysInMonthTotal = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth() + 1, 0).getDate();
        
        container.innerHTML = list.map(item => {
            let monthlyVal = item.amount;
            let formulaText = '';
            
            if (item.frequency === 'daily') {
                monthlyVal = item.amount * daysInMonthTotal;
                formulaText = ` = ${this.formatCurrency(monthlyVal)} měsíčně`;
            } else if (item.frequency === 'weekly') {
                monthlyVal = item.amount * (daysInMonthTotal / 7);
                formulaText = ` = ${this.formatCurrency(monthlyVal)} měsíčně`;
            }
            
            return `
            <div class="fixed-item">
                <div class="fixed-item-info">
                    <div class="fixed-item-name">${item.name}</div>
                    <div class="fixed-item-amount">${this.formatCurrency(item.amount)} / ${freqs[item.frequency] || 'Měsíčně'} <span style="color: var(--accent); opacity: 0.9;">${formulaText}</span></div>
                </div>
                <button class="fixed-item-delete" onclick="ui.deleteFixedExpense(${item.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
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
        const amountRaw = document.getElementById('fixed-amount').value.replace(/\s/g, '');
        const amount = parseFloat(amountRaw);
        const freq = document.querySelector('input[name="fixed-freq"]:checked').value;
        
        if (!name || !amount || amount <= 0) return;
        
        logic.addFixedExpense(name, amount, freq, this.selectedDate);
        
        document.getElementById('add-fixed-form').reset();
        // Obnovit defaultní rádio tlačítko
        document.querySelector('input[name="fixed-freq"][value="monthly"]').checked = true;
        
        this.renderFixedList();
        this.render();
    },
    
    updateTaxDisplay() {
        const type = document.getElementById('setup-amount').dataset.type;
        if (type !== 'income') return;
        
        const isGross = document.querySelector('input[name="tax-mode"]:checked').value === 'gross';
        const box = document.getElementById('tax-animation-box');
        const amountRaw = document.getElementById('setup-amount').value.replace(/\s/g, '');
        const amount = parseFloat(amountRaw) || 0;
        
        if (isGross && amount > 0) {
            box.classList.remove('collapsed');
            const tax = amount * 0.20; // 20%
            document.getElementById('tax-value-display').textContent = `- ${this.formatCurrency(tax)}`;
        } else {
            box.classList.add('collapsed');
        }
    },
    
    closeModals() {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
    },
    
    submitTransaction(e) {
        e.preventDefault();
        const amountRaw = document.getElementById('tx-amount').value.replace(/\s/g, '');
        const amount = parseFloat(amountRaw);
        const categoryElement = document.querySelector('input[name="category"]:checked');
        const category = categoryElement ? categoryElement.value : 'other';
        
        // Získat název kategorie pro poznámku pokud chybí
        const basics = { food: 'Jídlo', coffee: 'Káva', transport: 'Doprava' };
        let catName = basics[category];
        if (!catName) {
            const custom = logic.data.customCategories.find(c => c.id === category);
            catName = custom ? custom.name : 'Výdaj';
        }

        const noteInput = document.getElementById('tx-note');
        const note = noteInput.value || catName;
        
        if (!amount || amount <= 0) return;
        
        // Použijeme vybraný datum
        const txDate = new Date(this.selectedDate);
        // Pokud je to dnes, necháme i aktuální čas, jinak nastavíme poledne
        const today = new Date();
        if (txDate.toDateString() !== today.toDateString()) {
            txDate.setHours(12, 0, 0, 0);
        } else {
            txDate.setHours(today.getHours(), today.getMinutes(), today.getSeconds());
        }

        logic.addTransaction(amount, category, note, txDate.toISOString());
        this.closeModals();
        
        setTimeout(() => document.getElementById('tx-form').reset(), 300);
        this.render();
    },
    
    submitSetup(e) {
        e.preventDefault();
        const input = document.getElementById('setup-amount');
        const amountRaw = input.value.replace(/\s/g, '');
        const amount = parseFloat(amountRaw) || 0;
        
        const isGross = document.querySelector('input[name="tax-mode"]:checked').value === 'gross';
        const incomeFreq = document.querySelector('input[name="income-freq"]:checked').value;
        logic.setIncome(amount, isGross, incomeFreq, this.selectedDate);
        
        this.closeModals();
        this.render();
    },

    clearData() {
        if (confirm('Opravdu chcete vymazat všechna svá data?')) {
            logic.clearData();
            this.render();
        }
    },

    // --- SPA TAB SYSTEM ---
    switchTab(tabId) {
        this.activeTab = tabId;
        
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.classList.add('hidden');
        });
        
        // Show target tab
        const target = document.getElementById('tab-' + tabId);
        target.classList.remove('hidden');
        target.classList.add('active');
        
        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.getElementById('nav-' + tabId).classList.add('active');
        
        // Tab specific actions
        if (tabId === 'charts') {
            charts.init();
        } else if (tabId === 'goals') {
            this.renderGoals();
        } else if (tabId === 'overview') {
            this.render();
        }

        // Smooth scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // --- GOALS UI ---
    openGoalModal() {
        document.getElementById('goal-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('goal-name').focus(), 150);
    },

    submitGoal(e) {
        e.preventDefault();
        const name = document.getElementById('goal-name').value.trim();
        const amountRaw = document.getElementById('goal-amount').value.replace(/\s/g, '');
        const amount = parseFloat(amountRaw);
        
        if (!name || isNaN(amount) || amount <= 0) return;
        
        logic.addGoal(name, amount);
        this.closeModals();
        document.getElementById('goal-name').value = '';
        document.getElementById('goal-amount').value = '';
        this.renderGoals();
    },

    renderGoals() {
        const container = document.getElementById('goals-container');
        if (!container) return;

        const goals = logic.data.goals || [];
        if (goals.length === 0) {
            container.innerHTML = '<div class="empty-state">Zatím žádné cíle. Přidejte první.</div>';
            return;
        }

        container.innerHTML = goals.map(goal => {
            const percent = Math.min(100, Math.floor((goal.saved / goal.amount) * 100));
            return `
                <div class="glass-card goal-card">
                    <div class="goal-header">
                        <div class="goal-name">${goal.name}</div>
                        <div class="goal-percent">${percent}%</div>
                    </div>
                    <div class="goal-jar-container">
                        <div class="goal-fill" style="height: ${percent}%"></div>
                    </div>
                    <div class="goal-stats">
                        <span>${this.formatCurrency(goal.saved)}</span>
                        <span>z ${this.formatCurrency(goal.amount)}</span>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button class="btn-secondary" style="padding: 10px; font-size: 12px;" onclick="ui.handleGoalDeposit(${goal.id})">+ PŘIDAT</button>
                        <button class="btn-secondary" style="padding: 10px; font-size: 12px; color: var(--accent);" onclick="ui.handleGoalDelete(${goal.id})">SMAZAT</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    handleGoalDeposit(id) {
        const amount = prompt("Kolik chcete přidat do této pokladničky?");
        if (amount && !isNaN(parseFloat(amount))) {
            const goal = logic.data.goals.find(g => g.id === id);
            if (goal) {
                logic.updateGoalSaved(id, goal.saved + parseFloat(amount));
                this.renderGoals();
            }
        }
    },

    handleGoalDelete(id) {
        if (confirm("Opravdu smazat tento cíl?")) {
            logic.deleteGoal(id);
            this.renderGoals();
        }
    },

    // --- CUSTOM CALENDAR LOGIC ---
    openCalendar() {
        this.calendarViewDate = new Date(this.selectedDate);
        this.renderCalendar();
        document.getElementById('calendar-modal').classList.remove('hidden');
    },

    renderCalendar() {
        const monthYearEl = document.getElementById('calendar-month-year');
        const daysContainer = document.getElementById('calendar-days');
        
        const month = this.calendarViewDate.getMonth();
        const year = this.calendarViewDate.getFullYear();
        
        const monthNames = ["LEDEN", "ÚNOR", "BŘEZEN", "DUBEN", "KVĚTEN", "ČERVEN", "ČERVENEC", "SRPEN", "ZÁŘÍ", "ŘÍJEN", "LISTOPAD", "PROSINEC"];
        monthYearEl.textContent = `${monthNames[month]} ${year}`;
        
        // Calculate days
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
        const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
        
        // Convert to European Monday-start (0=Po, 6=Ne)
        let firstDayIdx = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
        
        let html = '';
        
        // Empty slots for previous month
        for (let i = 0; i < firstDayIdx; i++) {
            html += '<div class="calendar-day empty"></div>';
        }
        
        const today = new Date();
        
        for (let i = 1; i <= lastDateOfMonth; i++) {
            const isToday = today.getDate() === i && today.getMonth() === month && today.getFullYear() === year;
            const isSelected = this.selectedDate.getDate() === i && this.selectedDate.getMonth() === month && this.selectedDate.getFullYear() === year;
            
            html += `
                <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" onclick="ui.selectCalendarDate(${i})">
                    ${i}
                </div>
            `;
        }
        
        daysContainer.innerHTML = html;
    },

    selectCalendarDate(day) {
        this.selectedDate = new Date(this.calendarViewDate.getFullYear(), this.calendarViewDate.getMonth(), day);
        this.closeModals();
        this.updateDate();
        this.render();
    },

    prevCalendarMonth() {
        this.calendarViewDate.setMonth(this.calendarViewDate.getMonth() - 1);
        this.renderCalendar();
    },

    nextCalendarMonth() {
        this.calendarViewDate.setMonth(this.calendarViewDate.getMonth() + 1);
        this.renderCalendar();
    }
};
