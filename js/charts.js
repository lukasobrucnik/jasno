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
        const curMonth = ref.getMonth();
        const shortNames = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čec', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
        const labelsArr = [], fixedData = [], varData = [];

        for (let mo = 0; mo < 12; mo++) {
            const monthDate = new Date(year, mo, 1);
            labelsArr.push(shortNames[mo]);
            fixedData.push(Math.round(logic.getFixedMonthlyTotal(monthDate)));
            varData.push(Math.round(logic.getMonthlyTotalSpent(monthDate)));
        }

        const cur = i => i === curMonth;
        const fixedBg  = fixedData.map((_, i) => cur(i) ? 'rgba(100,148,255,0.85)' : 'rgba(100,148,255,0.20)');
        const varBg    = varData.map((_, i)   => cur(i) ? 'rgba(255,168,78,0.85)'  : 'rgba(255,168,78,0.20)');

        const ctx = canvas.getContext('2d');
        this.trendChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labelsArr,
                datasets: [
                    {
                        label: 'Fixní výdaje',
                        data: fixedData,
                        backgroundColor: fixedBg,
                        borderRadius: 0,
                        borderSkipped: false,
                        stack: 'stack',
                    },
                    {
                        label: 'Příležitostné',
                        data: varData,
                        backgroundColor: varBg,
                        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                        borderSkipped: false,
                        stack: 'stack',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: 'rgba(255,255,255,0.38)',
                            font: { size: 9 },
                            padding: 12,
                            boxWidth: 8,
                            boxHeight: 8,
                            borderRadius: 2,
                        }
                    },
                    subtitle: {
                        display: true,
                        text: '↑ klikni na sloupec pro přepnutí měsíce',
                        color: 'rgba(255,255,255,0.18)',
                        font: { size: 9, style: 'normal' },
                        padding: { bottom: 6 },
                        align: 'start',
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10,10,10,0.95)',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        titleColor: 'rgba(255,255,255,0.5)',
                        bodyColor: '#fff',
                        padding: 10,
                        callbacks: {
                            label: ctx => ` ${ctx.dataset.label}: ${ui.formatCurrency(ctx.parsed.y)}`
                        }
                    }
                },
                onClick(_event, elements) {
                    if (elements.length > 0) {
                        ui.selectChartMonth(elements[0].index);
                    }
                },
                onHover(event, elements) {
                    event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { color: 'rgba(255,255,255,0.35)', font: { size: 10 } },
                        border: { display: false }
                    },
                    y: {
                        stacked: true,
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

        const labels = [], values = [], bgColors = [], glowColors = [];
        const groups = [];
        let idx = 0;

        const config = logic.getMonthlyConfig(ref);
        const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();

        // Blue family — fixní výdaje
        const fixedPalette = [
            { bg: 'rgba(128,168,255,0.82)', glow: '#80A8FF' },
            { bg: 'rgba(100,143,245,0.82)', glow: '#648FF5' },
            { bg: 'rgba(76,120,225,0.82)',  glow: '#4C78E1' },
            { bg: 'rgba(55,98,205,0.82)',   glow: '#3762CD' },
            { bg: 'rgba(38,78,185,0.82)',   glow: '#264EB9' },
            { bg: 'rgba(24,60,165,0.82)',   glow: '#183CA5' },
        ];

        // Amber family — příležitostné výdaje
        const txPalette = [
            { bg: 'rgba(255,188,80,0.82)',  glow: '#FFBC50' },
            { bg: 'rgba(248,162,55,0.82)',  glow: '#F8A237' },
            { bg: 'rgba(235,138,35,0.82)',  glow: '#EB8A23' },
            { bg: 'rgba(218,115,20,0.82)',  glow: '#DA7314' },
            { bg: 'rgba(198,95,10,0.82)',   glow: '#C65F0A' },
        ];

        // 1. Fixní výdaje — každá položka zvlášť
        const fixedIndices = [];
        config.fixedExpenses.forEach((fe, fi) => {
            let amt = fe.amount;
            if (fe.frequency === 'daily') amt *= daysInMonth;
            if (fe.frequency === 'weekly') amt *= (daysInMonth / 7);
            const p = fixedPalette[fi % fixedPalette.length];
            labels.push(fe.name);
            values.push(Math.round(amt));
            bgColors.push(p.bg);
            glowColors.push(p.glow);
            fixedIndices.push(idx++);
        });
        if (fixedIndices.length > 0) groups.push({ type: 'fixed', label: 'Fixní výdaje', indices: fixedIndices });

        // 2. Příležitostné výdaje
        const txIndices = [];
        let txPIdx = 0;
        Object.entries(catMap).forEach(([cat, amount]) => {
            const custom = logic.data.customCategories.find(c => c.id === cat);
            const p = txPalette[txPIdx % txPalette.length];
            labels.push(custom ? custom.name : (catNames[cat] || cat));
            values.push(Math.round(amount));
            bgColors.push(p.bg);
            glowColors.push(p.glow);
            txIndices.push(idx++);
            txPIdx++;
        });
        if (txIndices.length > 0) groups.push({ type: 'tx', label: 'Příležitostné', indices: txIndices });

        // 3. Zbývá
        const totalSpent = txs.reduce((s, t) => s + t.amount, 0);
        const remaining = totalBudget - totalSpent;
        if (remaining > 0) {
            labels.push('Zbývá');
            values.push(Math.round(remaining));
            bgColors.push('rgba(255,255,255,0.06)');
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
                const offsetArr = [], bwArr = [], borderArr = [];
                for (let i = 0; i < totalCount; i++) {
                    const g = this._groupForIdx(i);
                    const active = g && g.type === newType;
                    offsetArr.push(active ? 10 : 0);
                    bwArr.push(active ? 1 : 1.5);
                    borderArr.push(labels[i] === 'Zbývá' ? 'rgba(255,255,255,0.12)' : active ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.35)');
                }
                ds.offset = offsetArr;
                ds.borderWidth = bwArr;
                ds.borderColor = borderArr;
                args.changed = true;
            },

            afterDraw(chart) {
                const ctx = chart.ctx;
                const meta = chart.getDatasetMeta(0);
                if (!meta.data.length) return;

                // Glow for hovered group
                if (this._hoveredType) {
                    const group = groups.find(g => g.type === this._hoveredType);
                    if (group) {
                        ctx.save();
                        group.indices.forEach(i => {
                            const arc = meta.data[i];
                            if (!arc) return;
                            ctx.shadowBlur = 18;
                            ctx.shadowColor = glowColors[i];
                            arc.draw(ctx);
                        });
                        ctx.shadowBlur = 0;
                        ctx.restore();
                    }
                }

                // Center text
                const arc0 = meta.data[0];
                if (!arc0) return;
                const cx = arc0.x, cy = arc0.y;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                if (this._hoveredType) {
                    const group = groups.find(g => g.type === this._hoveredType);
                    if (!group) { ctx.restore(); return; }

                    const groupTotal = group.indices.reduce((s, i) => s + values[i], 0);
                    const isBlue = group.type === 'fixed';
                    const headerColor = isBlue ? 'rgba(128,168,255,0.6)' : 'rgba(255,188,80,0.6)';
                    const totalColor  = isBlue ? '#80A8FF' : '#FFBC50';

                    const itemCount = group.indices.length;
                    const lineH = 13;
                    const totalH = lineH + lineH + itemCount * lineH;
                    let ty = cy - totalH / 2 + lineH * 0.5;

                    ctx.font = `600 9px Inter, sans-serif`;
                    ctx.fillStyle = headerColor;
                    ctx.fillText(group.label.toUpperCase(), cx, ty);
                    ty += lineH;

                    ctx.font = `700 13px Inter, sans-serif`;
                    ctx.fillStyle = totalColor;
                    ctx.fillText(ui.formatCurrency(groupTotal), cx, ty);
                    ty += lineH * 1.2;

                    ctx.font = `400 9px Inter, sans-serif`;
                    const maxW = arc0.innerRadius * 1.6;
                    group.indices.forEach(i => {
                        ctx.textAlign = 'left';
                        ctx.fillStyle = 'rgba(255,255,255,0.50)';
                        ctx.fillText(labels[i], cx - maxW / 2, ty);
                        ctx.textAlign = 'right';
                        ctx.fillStyle = 'rgba(255,255,255,0.75)';
                        ctx.fillText(ui.formatCurrency(values[i]), cx + maxW / 2, ty);
                        ty += lineH;
                    });
                } else {
                    // Default: total spent this month
                    const spentTotal = values.filter((_, i) => labels[i] !== 'Zbývá').reduce((s, v) => s + v, 0);
                    ctx.font = `600 9px Inter, sans-serif`;
                    ctx.fillStyle = 'rgba(255,255,255,0.28)';
                    ctx.fillText('CELKEM', cx, cy - 10);
                    ctx.font = `700 14px Inter, sans-serif`;
                    ctx.fillStyle = 'rgba(255,255,255,0.75)';
                    ctx.fillText(ui.formatCurrency(spentTotal), cx, cy + 9);
                }

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
                    backgroundColor: bgColors,
                    borderColor: labels.map(l => l === 'Zbývá' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.35)'),
                    borderWidth: 1.5,
                    hoverOffset: 0,
                    offset: new Array(totalCount).fill(0)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgba(255,255,255,0.38)',
                            font: { size: 9 },
                            padding: 10,
                            boxWidth: 8,
                            boxHeight: 8,
                            borderRadius: 2,
                            filter: item => item.text !== 'Zbývá' || remaining > 0
                        }
                    },
                    tooltip: { enabled: false }
                }
            }
        });
    }
};