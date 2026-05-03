/* =============================================
   JASNO. — charts.js
   Grafy v monochromatic stylu
============================================= */
const charts = {
    trendChart: null,
    categoryChart: null,

    init() {
        this.renderTrend();
        this.renderCategory();
        this.renderPrediction();
    },

    renderPrediction() {
        const warning = document.getElementById('prediction-warning');
        const text = document.getElementById('prediction-text');
        if (!warning || !text) return;

        const ref = ui.selectedDate;
        const predicted = logic.getPredictedMonthEnd(ref);
        const budget = logic.getNetIncome(ref) - logic.getFixedMonthlyTotal(ref);
        const dayOfMonth = ref.getDate();
        const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();

        if (dayOfMonth < 3 || budget <= 0) { warning.classList.add('hidden'); return; }

        if (predicted > budget * 1.1) {
            warning.classList.remove('hidden');
            const overshoot = Math.round(predicted - budget);
            text.textContent = `Při tomto tempu přesáhneš rozpočet o ${ui.formatCurrency(overshoot)}.`;
        } else {
            warning.classList.add('hidden');
        }
    },

    renderTrend() {
        const canvas = document.getElementById('trendChart');
        if (!canvas) return;

        if (this.trendChart) { this.trendChart.destroy(); this.trendChart = null; }

        const ref = ui.selectedDate;
        const year = ref.getFullYear();
        const labels = [];
        const data = [];

        for (let m = 0; m < 12; m++) {
            const monthDate = new Date(year, m, 1);
            const shortNames = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čec', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
            labels.push(shortNames[m]);
            data.push(Math.round(logic.getMonthlyTotalSpent(monthDate)));
        }

        const ctx = canvas.getContext('2d');
        this.trendChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Výdaje',
                    data,
                    backgroundColor: data.map((_, i) => i === ref.getMonth() ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)'),
                    borderRadius: 4,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(10,10,10,0.95)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        titleColor: 'rgba(255,255,255,0.5)',
                        bodyColor: '#fff',
                        padding: 10,
                        callbacks: {
                            label: ctx => ui.formatCurrency(ctx.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255,255,255,0.35)', font: { size: 10 } },
                        border: { display: false }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: 'rgba(255,255,255,0.3)',
                            font: { size: 10 },
                            callback: v => v === 0 ? '' : (v / 1000) + 'k'
                        },
                        border: { display: false }
                    }
                }
            }
        });
    },

    renderCategory() {
        const canvas = document.getElementById('categoryChart');
        if (!canvas) return;
        if (this.categoryChart) { this.categoryChart.destroy(); this.categoryChart = null; }

        const ref = ui.selectedDate;
        const netIncome = logic.getNetIncome(ref);
        const fixedTotal = logic.getFixedMonthlyTotal(ref);
        const totalBudget = netIncome - fixedTotal; // volný rozpočet (základ koláče)

        const m = ref.getMonth();
        const y = ref.getFullYear();
        const txs = logic.data.transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === m && d.getFullYear() === y;
        });

        // Seskupit transakce po kategoriích
        const catMap = {};
        txs.forEach(t => {
            catMap[t.category] = (catMap[t.category] || 0) + t.amount;
        });

        const catNames = { food: 'Jídlo', coffee: 'Káva', transport: 'Doprava', entertainment: 'Zábava', health: 'Zdraví', other: 'Ostatní' };

        const labels = [];
        const values = [];
        const colors = [];

        // 1. Fixní výdaje — nejtmavší
        if (fixedTotal > 0) {
            labels.push('Fixní výdaje');
            values.push(Math.round(fixedTotal));
            colors.push('rgba(255,255,255,0.75)');
        }

        // 2. Transakce podle kategorií — střední tóny
        const txGrays = [
            'rgba(255,255,255,0.45)',
            'rgba(255,255,255,0.35)',
            'rgba(255,255,255,0.27)',
            'rgba(255,255,255,0.20)',
            'rgba(255,255,255,0.14)',
        ];
        let grayIdx = 0;
        Object.entries(catMap).forEach(([cat, amount]) => {
            const custom = logic.data.customCategories.find(c => c.id === cat);
            labels.push(custom ? custom.name : (catNames[cat] || cat));
            values.push(Math.round(amount));
            colors.push(txGrays[grayIdx % txGrays.length]);
            grayIdx++;
        });

        // 3. Zbývající neutracené — jen obrys
        const totalSpent = txs.reduce((s, t) => s + t.amount, 0);
        const remaining = totalBudget - totalSpent;
        if (remaining > 0) {
            labels.push('Zbývá');
            values.push(Math.round(remaining));
            colors.push('rgba(255,255,255,0.06)');
        }

        if (values.length === 0) return;

        const ctx = canvas.getContext('2d');
        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors.map((_, i) =>
                        i === labels.indexOf('Zbývá')
                            ? 'rgba(255,255,255,0.15)'
                            : 'rgba(0,0,0,0.4)'
                    ),
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgba(255,255,255,0.45)',
                            font: { size: 10 },
                            padding: 12,
                            boxWidth: 10,
                            boxHeight: 10,
                            borderRadius: 2,
                            filter: (item) => item.text !== 'Zbývá' || remaining > 0
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10,10,10,0.95)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        titleColor: 'rgba(255,255,255,0.5)',
                        bodyColor: '#fff',
                        padding: 10,
                        callbacks: {
                            label: ctx => ` ${ui.formatCurrency(ctx.parsed)}`
                        }
                    }
                }
            }
        });
    }
};