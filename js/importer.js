/* =============================================
   JASNO. — importer.js
   CSV parsing pro CZ/SK banky
============================================= */
const importer = {
    pendingTransactions: [],

    // Keyword → category mapping
    categoryKeywords: {
        food: ['kaufland', 'lidl', 'albert', 'tesco', 'billa', 'penny', 'globus', 'rohlik', 'potraviny', 'restaurant', 'restaurace', 'oběd', 'mcdonalds', 'kfc', 'burger', 'pizza', 'sushi', 'kebab'],
        coffee: ['starbucks', 'kavárna', 'coffee', 'kafe', 'cafe', 'espresso'],
        transport: ['mhd', 'dopravní', 'idos', 'vlak', 'bus', 'metro', 'taxi', 'bolt', 'uber', 'parking', 'parkování', 'benzín', 'shell', 'orlen', 'esso'],
        health: ['lékárna', 'pharmacy', 'doktor', 'nemocnice', 'zubar', 'optika'],
        entertainment: ['netflix', 'spotify', 'steam', 'cinema', 'kino', 'divadlo', 'museum', 'knihy', 'amazon']
    },

    guessCategory(note) {
        const lower = (note || '').toLowerCase();
        for (const [cat, keywords] of Object.entries(this.categoryKeywords)) {
            if (keywords.some(kw => lower.includes(kw))) return cat;
        }
        return 'other';
    },

    handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => this.parseCSV(e.target.result);
        reader.readAsText(file, 'UTF-8');
    },

    parseCSV(text) {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) return;

        const cols = lines[0].split(/[;,]/);
        let dateIdx = cols.findIndex(c => /datum|date/i.test(c));
        let amountIdx = cols.findIndex(c => /částka|amount|objem|suma/i.test(c));
        let noteIdx = cols.findIndex(c => /poznámka|zpráva|note|popis|příjemce|nazev/i.test(c));

        if (dateIdx === -1) dateIdx = 0;
        if (amountIdx === -1) amountIdx = 1;
        if (noteIdx === -1) noteIdx = 2;

        const transactions = [];
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(/[;,]/);
            if (row.length < 2) continue;

            const dateStr = (row[dateIdx] || '').replace(/"/g, '').trim();
            const amountStr = (row[amountIdx] || '').replace(/"/g, '').replace(/\s/g, '').replace(',', '.').trim();
            const noteStr = (row[noteIdx] || '').replace(/"/g, '').trim() || 'Import';

            const amount = parseFloat(amountStr);
            if (isNaN(amount) || amount >= 0) continue; // jen záporné = výdaje

            transactions.push({
                amount: Math.abs(amount),
                note: noteStr,
                date: this.parseDate(dateStr),
                category: this.guessCategory(noteStr)
            });
        }

        // Deduplikace
        this.pendingTransactions = transactions.filter(tx =>
            !logic.data.transactions.some(t =>
                new Date(t.date).toDateString() === new Date(tx.date).toDateString() &&
                t.amount === tx.amount &&
                t.note === tx.note
            )
        );

        this.showPreview();
    },

    parseDate(str) {
        if (!str) return new Date().toISOString();
        if (str.includes('.')) {
            const parts = str.split('.');
            if (parts.length === 3) {
                const d = new Date(parts[2], parts[1] - 1, parts[0]);
                if (!isNaN(d.getTime())) return d.toISOString();
            }
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    },

    showPreview() {
        const preview = document.getElementById('import-preview');
        const stats = document.getElementById('preview-stats');
        const actions = preview.querySelector('.preview-actions');

        if (this.pendingTransactions.length === 0) {
            stats.textContent = 'Žádné nové transakce k importu.';
            if (actions) actions.style.display = 'none';
        } else {
            stats.textContent = `Nalezeno ${this.pendingTransactions.length} nových transakcí.`;
            if (actions) actions.style.display = 'flex';
        }

        preview.classList.remove('hidden');
        document.getElementById('dropzone').classList.add('hidden');
    },

    confirmImport() {
        this.pendingTransactions.forEach(tx => {
            logic.addTransaction(tx.amount, tx.category, tx.note, tx.date);
        });
        logic.save();
        ui.render();
        this.cancelImport();
        ui.switchTab('overview');
        ui.showToast(`Importováno ${this.pendingTransactions.length} transakcí`);
        this.pendingTransactions = [];
    },

    cancelImport() {
        this.pendingTransactions = [];
        const preview = document.getElementById('import-preview');
        const dropzone = document.getElementById('dropzone');
        if (preview) preview.classList.add('hidden');
        if (dropzone) dropzone.classList.remove('hidden');
        const input = document.getElementById('csv-input');
        if (input) input.value = '';
    }
};