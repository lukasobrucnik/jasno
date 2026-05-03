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
        const m = ref.getMonth();
        const y = ref.getFullYear();
        const txs = logic.data.transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === m && d.getFullYear() === y;
        });

        if (txs.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const catMap = {};
        txs.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });

        const catNames = { food: 'Jídlo', coffee: 'Káva', transport: 'Doprava', entertainment: 'Zábava', health: 'Zdraví', other: 'Ostatní' };
        const labels = Object.keys(catMap).map(k => {
            const custom = logic.data.customCategories.find(c => c.id === k);
            return custom ? custom.name : (catNames[k] || k);
        });
        const values = Object.values(catMap);

        // Monochromatic grays
        const grays = ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.1)'];

        const ctx = canvas.getContext('2d');
        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: labels.map((_, i) => grays[i % grays.length]),
                    borderColor: 'rgba(0,0,0,0.3)',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgba(255,255,255,0.5)',
                            font: { size: 10 },
                            padding: 14,
                            boxWidth: 10,
                            boxHeight: 10,
                            borderRadius: 2
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