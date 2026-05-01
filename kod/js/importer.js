const importer = {
    pendingTransactions: [],

    handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            this.parseCSV(text);
        };
        reader.readAsText(file);
    },

    parseCSV(text) {
        // Simple CSV parsing (handling basic formats like AirBank, CSOB, etc.)
        // Usually: Date, Amount, Note
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        if (lines.length < 2) return;

        const transactions = [];
        // Try to detect headers or just use a basic mapping
        // We'll look for keywords in the first line
        const header = lines[0].toLowerCase();
        
        // Find column indices
        const cols = lines[0].split(/[;,]/);
        let dateIdx = cols.findIndex(c => c.includes('datum') || c.includes('date'));
        let amountIdx = cols.findIndex(c => c.includes('částka') || c.includes('amount') || c.includes('objem'));
        let noteIdx = cols.findIndex(c => c.includes('poznámka') || c.includes('zpráva') || c.includes('note') || c.includes('popis'));

        // Fallback if not found
        if (dateIdx === -1) dateIdx = 0;
        if (amountIdx === -1) amountIdx = 1;
        if (noteIdx === -1) noteIdx = 2;

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(/[;,]/);
            if (row.length < 2) continue;

            const dateStr = row[dateIdx]?.replace(/"/g, '').trim();
            const amountStr = row[amountIdx]?.replace(/"/g, '').replace(/\s/g, '').replace(',', '.').trim();
            const noteStr = row[noteIdx]?.replace(/"/g, '').trim() || 'Importováno';

            const amount = parseFloat(amountStr);
            if (isNaN(amount)) continue;

            // Only expenses (negative amounts in bank export are usually expenses)
            // But some banks use positive numbers for everything and a "type" column.
            // For now, we assume if it's positive it's income, if negative it's expense.
            // User wants to import expenses.
            if (amount < 0) {
                transactions.push({
                    amount: Math.abs(amount),
                    note: noteStr,
                    date: this.parseDate(dateStr)
                });
            }
        }

        // Filter duplicates (same date and amount and note)
        this.pendingTransactions = transactions.filter(tx => {
            const isDuplicate = logic.data.transactions.some(t => {
                const d1 = new Date(t.date).toDateString();
                const d2 = new Date(tx.date).toDateString();
                return d1 === d2 && t.amount === tx.amount && t.note === tx.note;
            });
            return !isDuplicate;
        });

        this.showPreview();
    },

    parseDate(str) {
        // Try to parse DD.MM.YYYY or YYYY-MM-DD
        if (str.includes('.')) {
            const parts = str.split('.');
            if (parts.length === 3) {
                return new Date(parts[2], parts[1] - 1, parts[0]).toISOString();
            }
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    },

    showPreview() {
        const preview = document.getElementById('import-preview');
        const stats = document.getElementById('preview-stats');
        
        if (this.pendingTransactions.length === 0) {
            stats.textContent = "Nenalezeny žádné nové transakce k importu.";
            document.querySelector('.preview-actions').classList.add('hidden');
        } else {
            stats.textContent = `Nalezeno ${this.pendingTransactions.length} nových transakcí k importu.`;
            document.querySelector('.preview-actions').classList.remove('hidden');
        }
        
        preview.classList.remove('hidden');
        document.getElementById('dropzone').classList.add('hidden');
    },

    confirmImport() {
        this.pendingTransactions.forEach(tx => {
            logic.addTransaction(tx.amount, 'other', tx.note);
            // Manually override the date since addTransaction uses Date.now()
            logic.data.transactions[logic.data.transactions.length - 1].date = tx.date;
        });
        logic.save();
        ui.render();
        this.cancelImport();
        ui.switchTab('overview');
    },

    cancelImport() {
        this.pendingTransactions = [];
        document.getElementById('import-preview').classList.add('hidden');
        document.getElementById('dropzone').classList.remove('hidden');
        document.getElementById('csv-input').value = '';
    }
};
