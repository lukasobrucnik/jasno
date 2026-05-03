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
        const totalBudget = netIncome - fixedTotal;

        const m = ref.getMonth();
        const y = ref.getFullYear();
        const txs = logic.data.transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === m && d.getFullYear() === y;
        });

        const catMap = {};
        txs.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });

        const catNames = { food: 'Jídlo', coffee: 'Káva', transport: 'Doprava', entertainment: 'Zábava', health: 'Zdraví', other: 'Ostatní' };

        const labels = [], values = [], monoColors = [], accentColors = [], glowColors = [];
        const groups = [];
        let idx = 0;

        const config = logic.getMonthlyConfig(ref);
        const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();

        const fixedAccents = [
            { bg: 'rgba(74,144,255,0.78)',  glow: '#4A90FF' },
            { bg: 'rgba(255,107,107,0.78)', glow: '#FF6B6B' },
            { bg: 'rgba(80,200,120,0.78)',  glow: '#50C878' },
            { bg: 'rgba(255,215,0,0.78)',   glow: '#FFD700' },
            { bg: 'rgba(200,100,255,0.78)', glow: '#C864FF' },
            { bg: 'rgba(255,152,0,0.78)',   glow: '#FF9800' },
        ];
        const txAccents = [
            { bg: 'rgba(255,107,107,0.78)', glow: '#FF6B6B' },
            { bg: 'rgba(80,200,120,0.78)',  glow: '#50C878' },
            { bg: 'rgba(255,215,0,0.78)',   glow: '#FFD700' },
            { bg: 'rgba(200,100,255,0.78)', glow: '#C864FF' },
            { bg: 'rgba(255,152,0,0.78)',   glow: '#FF9800' },
            { bg: 'rgba(0,188,212,0.78)',   glow: '#00BCD4' },
        ];

        // 1. Fixní výdaje — každá položka zvlášť
        const fixedIndices = [];
        config.fixedExpenses.forEach((fe, fi) => {
            let amt = fe.amount;
            if (fe.frequency === 'daily') amt *= daysInMonth;
            if (fe.frequency === 'weekly') amt *= (daysInMonth / 7);
            const accent = fixedAccents[fi % fixedAccents.length];
            labels.push(fe.name);
            values.push(Math.round(amt));
            monoColors.push(`rgba(255,255,255,${(0.75 - fi * 0.07).toFixed(2)})`);
            accentColors.push(accent.bg);
            glowColors.push(accent.glow);
            fixedIndices.push(idx++);
        });
        if (fixedIndices.length > 0) groups.push({ type: 'fixed', indices: fixedIndices });

        // 2. Příležitostné výdaje po kategoriích
        const txGrays = ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.27)', 'rgba(255,255,255,0.20)', 'rgba(255,255,255,0.14)'];
        const txIndices = [];
        let grayIdx = 0, txAIdx = 0;
        Object.entries(catMap).forEach(([cat, amount]) => {
            const custom = logic.data.customCategories.find(c => c.id === cat);
            const accent = txAccents[txAIdx % txAccents.length];
            labels.push(custom ? custom.name : (catNames[cat] || cat));
            values.push(Math.round(amount));
            monoColors.push(txGrays[grayIdx % txGrays.length]);
            accentColors.push(accent.bg);
            glowColors.push(accent.glow);
            txIndices.push(idx++);
            grayIdx++; txAIdx++;
        });
        if (txIndices.length > 0) groups.push({ type: 'tx', indices: txIndices });

        // 3. Zbývá
        const totalSpent = txs.reduce((s, t) => s + t.amount, 0);
        const remaining = totalBudget - totalSpent;
        if (remaining > 0) {
            labels.push('Zbývá');
            values.push(Math.round(remaining));
            monoColors.push('rgba(255,255,255,0.06)');
            accentColors.push('rgba(255,255,255,0.06)');
            glowColors.push('transparent');
        }

        if (values.length === 0) return;
        const totalCount = labels.length;

        const groupHoverPlugin = {
            id: 'groupHoverPlugin',
            _hoveredType: null,
            _groupForIdx(i) { return groups.find(g => g.indices.includes(i)) || null; },

            afterEvent(chart, args) {
                const ev = args.event;
                if (!['mousemove', 'mouseout', 'mouseleave'].includes(ev.type)) return;

                let newType = null;
                if (ev.type === 'mousemove') {
                    const els = chart.getElementsAtEventForMode(ev.native, 'nearest', { intersect: true }, false);
                    if (els.length > 0) {
                        const g = this._groupForIdx(els[0].index);
                        if (g) newType = g.type;
                    }
                }

                if (newType === this._hoveredType) return;
                this._hoveredType = newType;

                const ds = chart.data.datasets[0];
                const bgArr = [], offsetArr = [], bwArr = [];
                for (let i = 0; i < totalCount; i++) {
                    const g = this._groupForIdx(i);
                    const active = g && g.type === newType;
                    bgArr.push(active ? accentColors[i] : monoColors[i]);
                    offsetArr.push(active ? 10 : 0);
                    bwArr.push(active ? 1 : 2);
                }
                ds.backgroundColor = bgArr;
                ds.offset = offsetArr;
                ds.borderWidth = bwArr;
                args.changed = true;
            },

            afterDatasetsDraw(chart) {
                if (!this._hoveredType) return;
                const group = groups.find(g => g.type === this._hoveredType);
                if (!group) return;

                const ctx = chart.ctx;
                const meta = chart.getDatasetMeta(0);
                ctx.save();

                // Glow pass — redraw hovered arcs with shadow
                group.indices.forEach(i => {
                    const arc = meta.data[i];
                    if (!arc) return;
                    ctx.shadowBlur = 16;
                    ctx.shadowColor = glowColors[i];
                    arc.draw(ctx);
                });
                ctx.shadowBlur = 0;

                // Connector lines + inline labels
                group.indices.forEach(i => {
                    const arc = meta.data[i];
                    if (!arc || values[i] === 0) return;
                    const mid = (arc.startAngle + arc.endAngle) / 2;
                    const r = arc.outerRadius;
                    const cx = arc.x, cy = arc.y;
                    const x1 = cx + Math.cos(mid) * (r + 5);
                    const y1 = cy + Math.sin(mid) * (r + 5);
                    const x2 = cx + Math.cos(mid) * (r + 22);
                    const y2 = cy + Math.sin(mid) * (r + 22);

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.strokeStyle = accentColors[i];
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.65;
                    ctx.stroke();
                    ctx.globalAlpha = 1;

                    const right = Math.cos(mid) >= 0;
                    const lx = x2 + (right ? 4 : -4);
                    ctx.textAlign = right ? 'left' : 'right';
                    ctx.textBaseline = 'middle';
                    ctx.font = '10px Inter, sans-serif';
                    ctx.fillStyle = accentColors[i];
                    ctx.fillText(labels[i], lx, y2 - 6);
                    ctx.font = '9px Inter, sans-serif';
                    ctx.fillStyle = 'rgba(255,255,255,0.45)';
                    ctx.fillText(ui.formatCurrency(values[i]), lx, y2 + 6);
                });

                ctx.restore();
            }
        };

        const ctx = canvas.getContext('2d');
        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            plugins: [groupHoverPlugin],
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: [...monoColors],
                    borderColor: labels.map(l => l === 'Zbývá' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.4)'),
                    borderWidth: 2,
                    hoverOffset: 0,
                    offset: new Array(totalCount).fill(0)
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