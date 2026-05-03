/* =============================================
   JASNO. — logic.js
   Čistá datová logika. Žádná DOM manipulace.
============================================= */
const logic = {
    data: {
        transactions: [],
        customCategories: [],
        goals: [],
        viewMode: 'monthly',
        monthlyConfigs: {}
    },

    init() {
        try {
            const stored = localStorage.getItem('jasno_data');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = {
                    transactions: parsed.transactions || [],
                    customCategories: parsed.customCategories || [],
                    goals: parsed.goals || [],
                    viewMode: parsed.viewMode || 'monthly',
                    monthlyConfigs: parsed.monthlyConfigs || {}
                };

                // Migrace starých dat (globální income → monthlyConfig)
                if (parsed.income !== undefined || (parsed.fixedExpenses && parsed.fixedExpenses.length > 0)) {
                    const key = this.getMonthKey(new Date());
                    if (!this.data.monthlyConfigs[key]) {
                        this.data.monthlyConfigs[key] = {
                            income: parsed.income || 0,
                            incomeFrequency: parsed.incomeFrequency || 'monthly',
                            isGross: parsed.isGross || false,
                            fixedExpenses: parsed.fixedExpenses || []
                        };
                        this.save();
                    }
                }
            }
        } catch (e) {
            console.error('Chyba při načítání dat:', e);
        }
    },

    save() {
        try {
            localStorage.setItem('jasno_data', JSON.stringify(this.data));
        } catch (e) {
            console.error('Chyba při ukládání dat:', e);
        }
    },

    getMonthKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },

    getMonthlyConfig(date = new Date()) {
        const key = this.getMonthKey(date);
        return this.data.monthlyConfigs[key] || {
            income: 0,
            incomeFrequency: 'monthly',
            isGross: false,
            fixedExpenses: []
        };
    },

    ensureMonthlyConfig(date = new Date()) {
        const key = this.getMonthKey(date);
        if (!this.data.monthlyConfigs[key]) {
            this.data.monthlyConfigs[key] = {
                income: 0,
                incomeFrequency: 'monthly',
                isGross: false,
                fixedExpenses: []
            };
        }
        return this.data.monthlyConfigs[key];
    },

    setIncome(amount, isGross, incomeFrequency, refDate = new Date()) {
        const config = this.ensureMonthlyConfig(refDate);
        config.income = amount;
        config.isGross = isGross;
        if (incomeFrequency) config.incomeFrequency = incomeFrequency;
        this.save();
    },

    getNetIncome(refDate = new Date()) {
        const config = this.getMonthlyConfig(refDate);
        let base = config.income;
        const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();

        if (config.incomeFrequency === 'daily') base *= daysInMonth;
        if (config.incomeFrequency === 'weekly') base *= (daysInMonth / 7);

        return config.isGross ? base * 0.80 : base;
    },

    getEstimatedTax(refDate = new Date()) {
        const config = this.getMonthlyConfig(refDate);
        if (!config.isGross) return 0;
        let base = config.income;
        const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
        if (config.incomeFrequency === 'daily') base *= daysInMonth;
        if (config.incomeFrequency === 'weekly') base *= (daysInMonth / 7);
        return base - this.getNetIncome(refDate);
    },

    addFixedExpense(name, amount, frequency, refDate = new Date()) {
        const config = this.ensureMonthlyConfig(refDate);
        config.fixedExpenses.push({ id: Date.now(), name, amount, frequency });
        this.save();
    },

    removeFixedExpense(id, refDate = new Date()) {
        const config = this.ensureMonthlyConfig(refDate);
        config.fixedExpenses = config.fixedExpenses.filter(f => f.id !== id);
        this.save();
    },

    getFixedMonthlyTotal(refDate = new Date()) {
        const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
        const config = this.getMonthlyConfig(refDate);
        return config.fixedExpenses.reduce((sum, item) => {
            if (item.frequency === 'daily') return sum + item.amount * daysInMonth;
            if (item.frequency === 'weekly') return sum + item.amount * (daysInMonth / 7);
            return sum + item.amount;
        }, 0);
    },

    addTransaction(amount, category, note, date = null) {
        this.data.transactions.push({
            id: Date.now(),
            amount,
            category,
            note,
            date: date || new Date().toISOString()
        });
        this.save();
    },

    deleteTransaction(id) {
        this.data.transactions = this.data.transactions.filter(t => t.id !== id);
        this.save();
    },

    getMonthlyTotalSpent(refDate = new Date()) {
        const m = refDate.getMonth();
        const y = refDate.getFullYear();
        return this.data.transactions
            .filter(t => { const d = new Date(t.date); return d.getMonth() === m && d.getFullYear() === y; })
            .reduce((sum, t) => sum + t.amount, 0);
    },

    getRemainingTotal(refDate = new Date()) {
        return this.getNetIncome(refDate) - this.getFixedMonthlyTotal(refDate) - this.getMonthlyTotalSpent(refDate);
    },

    getCurrentAllowance(refDate = new Date()) {
        return this.getRemainingTotal(refDate);
    },

    getPredictedMonthEnd(refDate = new Date()) {
        const dayOfMonth = refDate.getDate();
        const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
        const spentSoFar = this.getMonthlyTotalSpent(refDate);
        if (dayOfMonth === 0) return 0;
        const dailyRate = spentSoFar / dayOfMonth;
        return dailyRate * daysInMonth;
    },

    getAmountSuggestion(prefix, refDate = new Date()) {
        if (!prefix || prefix === '0') return null;
        const prefixStr = String(prefix).replace(/\s/g, '');
        const config = this.getMonthlyConfig(refDate);
        const allAmounts = [
            ...this.data.transactions.map(t => t.amount),
            ...config.fixedExpenses.map(f => f.amount),
            config.income
        ].filter(a => a > 0);

        const freqs = {};
        allAmounts.forEach(a => {
            const str = String(a);
            if (str.startsWith(prefixStr) && str !== prefixStr) {
                freqs[str] = (freqs[str] || 0) + 1;
            }
        });
        const sorted = Object.keys(freqs).sort((a, b) => freqs[b] - freqs[a]);
        return sorted.length > 0 ? parseInt(sorted[0], 10) : null;
    },

    addCustomCategory(name, icon = null) {
        if (this.data.customCategories.length >= 3) return null;
        const newCat = { id: 'custom_' + Date.now(), name, icon };
        this.data.customCategories.push(newCat);
        this.save();
        return newCat.id;
    },

    // --- GOALS ---
    addGoal(name, amount) {
        const goal = { id: Date.now(), name, amount, saved: 0 };
        this.data.goals.push(goal);
        this.save();
        return goal;
    },

    deleteGoal(id) {
        this.data.goals = this.data.goals.filter(g => g.id !== id);
        this.save();
    },

    updateGoalSaved(id, amount) {
        const goal = this.data.goals.find(g => g.id === id);
        if (goal) { goal.saved = Math.max(0, amount); this.save(); }
    },

    clearData() {
        this.data = { transactions: [], customCategories: [], goals: [], viewMode: 'monthly', monthlyConfigs: {} };
        this.save();
    }
};