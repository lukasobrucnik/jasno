const logic = {
    data: {
        transactions: [],
        customCategories: [],
        goals: [],
        viewMode: 'monthly',
        monthlyConfigs: {} // Store { income, incomeFrequency, isGross, fixedExpenses } per "YYYY-MM"
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

                // Migrace starých dat (pokud existují globální income/fixed)
                if (parsed.income !== undefined || (parsed.fixedExpenses && parsed.fixedExpenses.length > 0)) {
                    const now = new Date();
                    const key = this.getMonthKey(now);
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
            console.error("Chyba při načítání dat z localStorage", e);
        }
    },

    save() {
        try {
            localStorage.setItem('jasno_data', JSON.stringify(this.data));
        } catch (e) {
            console.error("Chyba při ukládání dat", e);
        }
    },

    getMonthKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },

    getMonthlyConfig(date) {
        const key = this.getMonthKey(date);
        return this.data.monthlyConfigs[key] || {
            income: 0,
            incomeFrequency: 'monthly',
            isGross: false,
            fixedExpenses: []
        };
    },

    ensureMonthlyConfig(date) {
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

    addCustomCategory(name, icon = null) {
        if (this.data.customCategories.length >= 3) return null;
        const newCat = {
            id: 'custom_' + Date.now(),
            name: name,
            icon: icon
        };
        this.data.customCategories.push(newCat);
        this.save();
        return newCat.id;
    },

    updateCustomCategoryIcon(id, icon) {
        const cat = this.data.customCategories.find(c => c.id === id);
        if (cat) {
            cat.icon = icon;
            this.save();
        }
    },

    setIncome(amount, isGross, incomeFrequency, refDate = new Date()) {
        const config = this.ensureMonthlyConfig(refDate);
        config.income = amount;
        config.isGross = isGross;
        if (incomeFrequency) config.incomeFrequency = incomeFrequency;
        this.save();
    },

    addFixedExpense(name, amount, frequency, refDate = new Date()) {
        const config = this.ensureMonthlyConfig(refDate);
        config.fixedExpenses.push({
            id: Date.now(),
            name: name,
            amount: amount,
            frequency: frequency
        });
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
            if (item.frequency === 'daily') {
                return sum + (item.amount * daysInMonth);
            } else if (item.frequency === 'weekly') {
                return sum + (item.amount * (daysInMonth / 7));
            }
            return sum + item.amount;
        }, 0);
    },

    setViewMode(mode) {
        this.data.viewMode = mode;
        this.save();
    },

    getNetIncome(refDate = new Date()) {
        const config = this.getMonthlyConfig(refDate);
        let baseIncome = config.income;
        const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();

        if (config.incomeFrequency === 'daily') {
            baseIncome = baseIncome * daysInMonth;
        } else if (config.incomeFrequency === 'weekly') {
            baseIncome = baseIncome * (daysInMonth / 7);
        }

        if (config.isGross) {
            return baseIncome * 0.80;
        }
        return baseIncome;
    },

    getEstimatedTax(refDate = new Date()) {
        const config = this.getMonthlyConfig(refDate);
        if (!config.isGross) return 0;
        let baseIncome = config.income;
        const daysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();

        if (config.incomeFrequency === 'daily') {
            baseIncome = baseIncome * daysInMonth;
        } else if (config.incomeFrequency === 'weekly') {
            baseIncome = baseIncome * (daysInMonth / 7);
        }
        return baseIncome - this.getNetIncome(refDate);
    },

    addTransaction(amount, category, note, date = null) {
        this.data.transactions.push({
            id: Date.now(),
            amount: amount,
            category: category,
            note: note,
            date: date || new Date().toISOString()
        });
        this.save();
    },

    getMonthlyTotalSpent(refDate = new Date()) {
        const currentMonth = refDate.getMonth();
        const currentYear = refDate.getFullYear();

        return this.data.transactions
            .filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            })
            .reduce((sum, t) => sum + t.amount, 0);
    },

    getSpentBeforeToday(refDate = new Date()) {
        const startOfDay = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());

        return this.data.transactions
            .filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear() && d < startOfDay;
            })
            .reduce((sum, t) => sum + t.amount, 0);
    },

    getSpentToday(refDate = new Date()) {
        const startOfDay = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
        const endOfDay = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + 1);

        return this.data.transactions
            .filter(t => {
                const d = new Date(t.date);
                return d >= startOfDay && d < endOfDay;
            })
            .reduce((sum, t) => sum + t.amount, 0);
    },

    getDaysRemainingInMonth(refDate = new Date()) {
        const lastDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
        return lastDay.getDate() - refDate.getDate() + 1; // +1 zahrnuje aktuální den
    },

    getDailyAllowance(refDate = new Date()) {
        const totalBudget = this.getNetIncome(refDate) - this.getFixedMonthlyTotal(refDate);
        const spentBeforeToday = this.getSpentBeforeToday(refDate);
        const remainingBeforeToday = totalBudget - spentBeforeToday;

        const daysRemaining = this.getDaysRemainingInMonth(refDate);

        if (daysRemaining <= 0) {
            return remainingBeforeToday - this.getSpentToday(refDate);
        }

        const startingAllowanceToday = remainingBeforeToday / daysRemaining;
        const spentToday = this.getSpentToday(refDate);
        return startingAllowanceToday - spentToday;
    },

    getCurrentAllowance(refDate = new Date()) {
        const daily = this.getDailyAllowance(refDate);
        const daysRemaining = this.getDaysRemainingInMonth(refDate);

        if (this.data.viewMode === 'monthly') {
            return this.getRemainingTotal(refDate);
        } else if (this.data.viewMode === 'weekly') {
            const daysInWeek = Math.min(7, daysRemaining);
            return daily + (this.getDailyAllowance(refDate) * Math.max(0, daysInWeek - 1));
        }

        return daily;
    },

    getRemainingTotal(refDate = new Date()) {
        return this.getNetIncome(refDate) - this.getFixedMonthlyTotal(refDate) - this.getMonthlyTotalSpent(refDate);
    },

    getRecentTransactions(limit = 5) {
        return [...this.data.transactions]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
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
            // Nabídneme jen pokud částka začíná na zadaný prefix a je delší
            if (str.startsWith(prefixStr) && str !== prefixStr) {
                freqs[str] = (freqs[str] || 0) + 1;
            }
        });

        const sorted = Object.keys(freqs).sort((a, b) => freqs[b] - freqs[a]);
        return sorted.length > 0 ? parseInt(sorted[0], 10) : null;
    },

    clearData() {
        this.data = {
            transactions: [],
            customCategories: [],
            goals: [],
            viewMode: 'monthly',
            monthlyConfigs: {}
        };
        this.save();
    },

    // --- GOALS METHODS ---
    addGoal(name, amount) {
        const goal = {
            id: Date.now(),
            name: name,
            amount: amount,
            saved: 0
        };
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
        if (goal) {
            goal.saved = amount;
            this.save();
        }
    }
};
