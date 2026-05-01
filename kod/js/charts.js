const charts = {
    trendChart: null,
    categoryChart: null,

    init() {
        this.renderTrendChart();
        this.renderCategoryChart();
        this.updatePrediction();
    },

    renderTrendChart() {
        const ctx = document.getElementById('trendChart').getContext('2d');
        if (this.trendChart) this.trendChart.destroy();

        // Get monthly balance development for the current YEAR
        const labels = ["Led", "Úno", "Bře", "Dub", "Kvě", "Čer", "Čec", "Srp", "Zář", "Říj", "Lis", "Pro"];
        const data = [];
        const ref = ui.selectedDate || new Date();
        const year = ref.getFullYear();
        
        for (let m = 0; m < 12; m++) {
            const d = new Date(year, m, 1);
            const balance = logic.getRemainingTotal(d);
            data.push(balance);
        }

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Měsíční zůstatek',
                    data: data,
                    borderColor: '#ffffff',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: (context) => {
                        const m = context.dataIndex;
                        return m === ref.getMonth() ? '#ffffff' : 'rgba(255,255,255,0.2)';
                    },
                    fill: true,
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: (context) => `${context.parsed.y.toLocaleString('cs-CZ')} Kč`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }
                    }
                }
            }
        });
    },

    renderCategoryChart() {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        if (this.categoryChart) this.categoryChart.destroy();

        const categories = {};
        const ref = ui.selectedDate || new Date();
        const m = ref.getMonth();
        const y = ref.getFullYear();
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        // 1. Přidat variabilní transakce
        logic.data.transactions.forEach(tx => {
            const d = new Date(tx.date);
            if (d.getMonth() === m && d.getFullYear() === y) {
                const cat = tx.category || 'other';
                categories[cat] = (categories[cat] || 0) + tx.amount;
            }
        });

        // 2. Přidat fixní výdaje pro daný měsíc
        const config = logic.getMonthlyConfig(ref);
        config.fixedExpenses.forEach(fx => {
            let amount = fx.amount;
            if (fx.frequency === 'daily') amount *= daysInMonth;
            else if (fx.frequency === 'weekly') amount *= (daysInMonth / 7);
            
            const label = `FIXNÍ: ${fx.name.toUpperCase()}`;
            categories[label] = (categories[label] || 0) + amount;
        });

        const labels = Object.keys(categories).map(c => {
            if (c.startsWith('FIXNÍ:')) return c;
            const custom = logic.data.customCategories.find(cc => cc.id === c);
            if (custom) return custom.name;
            const basics = { food: 'Jídlo', coffee: 'Káva', transport: 'Doprava', other: 'Ostatní' };
            return basics[c] || c;
        });
        const data = Object.values(categories);

        // Nothing-style colors (high contrast monochrome)
        const nothingColors = [
            '#ffffff',           // Čistě bílá
            'rgba(255,255,255,0.6)', // Světle šedá
            'rgba(255,255,255,0.3)', // Středně šedá
            'rgba(255,255,255,0.1)', // Tmavě šedá
            '#ff3b30'            // Nothing Red (pro kontrast)
        ];

        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: nothingColors,
                    borderColor: '#000000',
                    borderWidth: 2,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', // Tenký prstenec
                plugins: { 
                    legend: { 
                        position: 'bottom',
                        labels: {
                            color: 'rgba(255,255,255,0.7)',
                            padding: 20,
                            font: { size: 12, family: 'Inter' },
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: '#111',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                const val = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((val / total) * 100).toFixed(1);
                                return ` ${context.label}: ${val.toLocaleString('cs-CZ')} Kč (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    },
    updatePrediction() {
        const warning = document.getElementById('prediction-warning');
        const text = document.getElementById('prediction-text');
        
        const ref = ui.selectedDate || new Date();
        const remaining = logic.getRemainingTotal(ref);
        const days = logic.getDaysRemainingInMonth(ref);
        const spent = logic.getMonthlyTotalSpent(ref);
        
        // Calculate day index for avg (if viewing past month, use last day)
        const today = new Date();
        let dayIdx = ref.getDate();
        if (ref.getMonth() !== today.getMonth() || ref.getFullYear() !== today.getFullYear()) {
            dayIdx = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
        }

        const avgSpent = spent / dayIdx;
        const dailyLimit = days > 0 ? remaining / days : 0;
        
        if (dailyLimit < avgSpent * 0.7 && remaining < (logic.getNetIncome(ref) * 0.2)) {
            warning.classList.remove('hidden');
            text.textContent = `Pozor: Při současném tempu rozpočet nevystačí. Zbývající denní limit: ${Math.floor(dailyLimit)} Kč.`;
        } else {
            warning.classList.add('hidden');
        }
    }
};
