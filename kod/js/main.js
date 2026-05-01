document.addEventListener('DOMContentLoaded', () => {
    // Inicializace logiky (načtení dat)
    logic.init();
    
    // Inicializace UI (vykreslení prvotního stavu)
    ui.init();
    
    // Kontrola, zda uživatel nastavil příjmy. Pokud ne, ukážeme setup.
    if (logic.data.income === 0 && logic.data.transactions.length === 0) {
        // Mírné zpoždění, aby dashboard nejdříve 'najel' a pak se otevřel modal
        setTimeout(() => {
            ui.openSetupModal('income');
        }, 600);
    }
});
