/* =============================================
   JASNO. — main.js
   Vstupní bod aplikace
============================================= */
document.addEventListener('DOMContentLoaded', () => {
    logic.init();
    ui.init();

    // Pokud uživatel nemá nastavené příjmy a žádné transakce → onboarding
    const config = logic.getMonthlyConfig(new Date());
    if (config.income === 0 && logic.data.transactions.length === 0) {
        setTimeout(() => ui.openSetupModal(), 700);
    }
});