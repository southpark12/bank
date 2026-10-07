// app.js - Educational Bank Web Application Logic

// --- STATE MANAGEMENT ---
let appState = {
    get balanceBusiness() {
        if (!this.transactions || !Array.isArray(this.transactions)) return 10;
        const sum = this.transactions.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);
        return sum + 10;
    },
    set balanceBusiness(val) {
        // Business balance is always strictly derived from transactions + 10 RUB
    },
    balancePersonal: (typeof INITIAL_BALANCES !== 'undefined' && INITIAL_BALANCES.personal !== undefined) ? INITIAL_BALANCES.personal : 0.00,
    activeTab: 'home',
    theme: 'dark', // 'dark' or 'light'
    activeDetailTxId: null, // If viewing transaction details
    paymentsSegment: 'send', // 'send' or 'receive'

    // Initial Transaction History loaded from data.js
    // Only transactions dated up to now are shown; later ones stay in futureTransactions (hidden)
    transactions: [],
    futureTransactions: [],

    // Support Chat Messages
    chatMessages: [
        { sender: 'user', text: 'Реквизиты', time: '21:23', date: '25 марта' },
        { sender: 'support', text: 'Реквизиты счёта можно использовать, чтобы:\n• пополнять по ним счёт;\n• получать деньги от контрагентов и выплаты от Ozon Seller.', time: '21:23', date: '25 марта' },
        { sender: 'support', text: 'Реквизиты вашего счёта:', time: '21:23', date: '25 марта' },
        {
            sender: 'support',
            isRequisites: true,
            time: '21:23',
            date: '25 марта'
        },
        { sender: 'user', text: 'Спасибо, всё понятно', time: '21:24', date: '25 марта' }
    ]
};

// Only transactions dated up to now are shown; later ones stay in futureTransactions (hidden)
function splitTransactionsByDate(list) {
    const now = Date.now();
    appState.transactions = [];
    appState.futureTransactions = [];
    list.forEach(tx => {
        (tx.date.getTime() <= now ? appState.transactions : appState.futureTransactions).push(tx);
    });
}

// Russian Months mapping
const monthNominative = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const monthGenitive = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

// Formatting helper
function formatAmount(amount) {
    const parts = Math.abs(amount).toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (amount < 0 ? '-' : '') + parts.join(',') + ' ₽';
}

function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initNavigation();
    try {
        splitTransactionsByDate(await loadBankTransactions());
    } catch (err) {
        console.error(err);
    }
    renderActiveView();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme-preference');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (themeName) => {
        appState.theme = themeName;
        document.documentElement.setAttribute('data-ob-theme', themeName);

        // Update header button icon if present
        const themeIconSpan = document.getElementById('header-theme-icon');
        if (themeIconSpan) {
            themeIconSpan.textContent = themeName === 'light' ? '☀️' : '🌙';
        }

        // Update meta tag
        let metaTheme = document.querySelector('meta[name="theme-color"]');
        if (!metaTheme) {
            metaTheme = document.createElement('meta');
            metaTheme.setAttribute('name', 'theme-color');
            document.head.appendChild(metaTheme);
        }
        metaTheme.setAttribute('content', themeName === 'light' ? '#ffffff' : '#1d2024');

        // Update avatar image if it exists in the active view
        const avatar = document.getElementById('profile-avatar');
        if (avatar) {
            avatar.src = themeName === 'light' ? './assets/avatar_light.png' : './assets/avatar_dark.png';
        }
    };

    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme(systemPrefersDark.matches ? 'dark' : 'light');
    }

    // Watch system changes
    systemPrefersDark.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme-preference')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

function initTabbarListeners() {
    const tabbar = document.getElementById('app-tabbar');
    if (!tabbar) return;

    tabbar.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (tab) {
            const dest = tab.getAttribute('data-tab');
            if (dest) {
                navigateToTab(dest);
            }
        }
    });
}

window.toggleAppTheme = function () {
    const newTheme = appState.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme-preference', newTheme);
    appState.theme = newTheme;
    document.documentElement.setAttribute('data-ob-theme', newTheme);
    renderActiveView();
};

// Navigation / Tabs SPA routing
function initNavigation() {
    initTabbarListeners();
}

function navigateToTab(tabName) {
    appState.activeTab = tabName;
    appState.activeDetailTxId = null; // Close any transaction details

    // Highlight active tab
    const tabs = document.querySelectorAll('#app-tabbar .tab');
    tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Show tabbar in case it was hidden
    document.getElementById('app-tabbar').style.display = 'flex';

    window.scrollTo(0, 0);
    const container = document.getElementById('view-container');
    if (container) container.scrollTop = 0;

    renderActiveView();
}

// --- VIEW RENDERING ENGINE ---
function renderActiveView() {
    const container = document.getElementById('view-container');
    container.innerHTML = ''; // Clear viewport
    container.classList.toggle('chat-view-active', appState.activeTab === 'chat' && appState.activeDetailTxId === null);

    if (appState.activeDetailTxId !== null) {
        renderTransactionDetails(container, appState.activeDetailTxId);
        return;
    }

    switch (appState.activeTab) {
        case 'home':
            renderHomeView(container);
            break;
        case 'history':
            renderHistoryView(container);
            break;
        case 'payments':
            renderPaymentsView(container);
            break;
        case 'chat':
            renderChatView(container);
            break;
        case 'services':
            renderServicesView(container);
            break;
    }
}

// --- 1. HOME VIEW ---
function renderHomeView(container) {
    const avatarFile = appState.theme === 'light' ? 'avatar_light.png' : 'avatar_dark.png';
    const themeEmoji = appState.theme === 'light' ? '☀️' : '🌙';

    container.innerHTML = `
        <!-- Profile Header -->
        <div class="header svelte-1hmh4r3" style="padding: 12px 16px; background: transparent;">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <!-- Left: Avatar & Vertical Text (Name + INN) -->
                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                    <div class="avatar svelte-15bejo8" style="flex-shrink: 0;">
                        <img id="profile-avatar" alt="" src="./assets/${avatarFile}" width="38" height="38" style="border-radius: 50%;">
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: center; gap: 1px; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                            <span class="name svelte-15bejo8" style="font-weight: 600; font-size: 14px; color: var(--textPrimary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">ИП Фон Берг Юрген Алекс...</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="color: var(--textSecondary); flex-shrink: 0;"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor"/></svg>
                        </div>
                        <div style="font-size: 11px; color: var(--textSecondary); font-weight: 400;">ИНН 233803342844</div>
                    </div>
                </div>

                <!-- Right Header Actions -->
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    <!-- Notifications Bell -->
                    <button class="icon-button" style="color: #0084ff; background: transparent; border: none; cursor: pointer; padding: 4px; position: relative;" onclick="alert('У вас нет новых уведомлений')">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/></svg>
                        <!-- Red/Blue notification badge dot -->
                        <span style="position: absolute; top: 4px; right: 4px; width: 6px; height: 6px; border-radius: 50%; background: #0084ff;"></span>
                    </button>

                    <!-- Gear Settings -->
                    <button class="icon-button" style="color: var(--graphicSecondary); background: transparent; border: none; cursor: pointer; padding: 4px;" onclick="alert('Настройки профиля')">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="currentColor"/></svg>
                    </button>
                </div>
            </div>
        </div>

        <!-- Accounts & Cards Section (Page-Wide) -->
        <div style="padding: 0 16px; width: 100%;">
            <div class="title" style="font-size: 17px; font-weight: 700; margin-bottom: 12px; color: var(--textPrimary);">Счета и карты</div>
            
            <div class="ozon-cards-box">
                <!-- 1. Счёт для бизнеса -->
                <div class="ozon-account-card">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="account-icon-circle">
                            ₽
                        </div>
                        <div>
                            <div style="font-size: 13px; color: var(--textSecondary);">Счёт для бизнеса •• 9691</div>
                            <div style="font-size: 20px; font-weight: 700; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                                <span>${formatAmount(appState.balanceBusiness)}</span>
                                <span style="color: var(--textSecondary); display: flex; align-items: center; cursor: help;" onclick="alert('Этот счёт используется для всех расчетов вашего ИП.')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/></svg>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. Счёт ежедневных выплат -->
                <div class="ozon-account-card" style="position: relative;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="account-icon-circle">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" fill="currentColor"/></svg>
                        </div>
                        <div>
                            <div style="font-size: 13px; color: var(--textSecondary);">Счёт ежедневных выплат</div>
                            <div style="font-size: 18px; font-weight: 700; margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <span>10,85% годовых</span>
                                <span style="background: rgba(21, 201, 107, 0.15); color: #15c96b; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Ставка повышена</span>
                            </div>
                        </div>
                    </div>
                    <button style="background: transparent; border: none; color: var(--textSecondary); cursor: pointer; padding: 4px;" onclick="event.stopPropagation(); this.closest('.ozon-account-card').style.display='none';">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
                    </button>
                </div>

                <!-- 3. Личный счёт -->
                <div class="ozon-account-card">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="account-icon-circle">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/></svg>
                        </div>
                        <div>
                            <div style="font-size: 13px; color: var(--textSecondary);">Личный счёт</div>
                            <div style="font-size: 20px; font-weight: 700; margin-top: 2px;">
                                <span>${formatAmount(appState.balancePersonal)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 4. Отсрочка платежа -->
                <div class="ozon-account-card">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="account-icon-circle">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8-8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" fill="currentColor"/></svg>
                        </div>
                        <div>
                            <div style="font-size: 13px; color: var(--textSecondary);">Отсрочка платежа</div>
                            <div style="margin-top: 2px; display: flex; flex-direction: column; gap: 2px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="background: rgba(255, 168, 0, 0.15); color: #ffa800; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Обновите лимит</span>
                                </div>
                                <span style="color: var(--textSecondary); font-size: 11px;">Ваш лимит устарел</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- New Product Button (Page Wide) -->
            <button class="btn-new-product" onclick="createNewProduct()">
                Новый счёт или продукт
            </button>

            <!-- Promo Banner -->
            <div class="card svelte-12c3w97" style="background: linear-gradient(135deg, #005bff, #0096ff); border: none; padding: 20px; position: relative; color: white; border-radius: 20px; margin-top: 16px; min-height: 110px; overflow: hidden; box-shadow: 0 10px 20px rgba(0,91,255,0.15); width: 100%; min-width: 100%;">
                <div style="position: absolute; top: 12px; right: 12px; cursor: pointer; background: rgba(255,255,255,0.2); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;" onclick="this.parentElement.style.display='none'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
                </div>
                <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; opacity: 0.9; margin-bottom: 4px; letter-spacing: 0.5px;">ozon банк</div>
                <div style="font-size: 18px; font-weight: 700; line-height: 1.2;">Бесплатная бизнес-карта</div>
                <div style="font-size: 12px; opacity: 0.85; margin-top: 4px; max-width: 75%;">Для удобной оплаты повседневных расходов</div>
                
                <!-- 3D Green Arrow -->
                <div style="position: absolute; right: 12px; bottom: 8px; font-size: 54px; line-height: 1; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.25)); transform: rotate(-45deg); pointer-events: none;">
                    ↗️
                </div>
            </div>

            <!-- Bottom Quick Actions (Accurate Blue Cards) -->
            <div style="margin-top: 20px; display: flex; gap: 10px; width: 100%;">
                <div class="quick-action-card" onclick="openQuickPaymentModal()">
                    <div class="quick-action-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/></svg>
                    </div>
                    <span class="quick-action-text">Новый платёж</span>
                </div>
                <div class="quick-action-card" onclick="openReplenishModal()">
                    <div class="quick-action-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" fill="currentColor"/><path d="M12 17l4-4h-3V9h-2v4H8l4 4z" fill="currentColor"/></svg>
                    </div>
                    <span class="quick-action-text">Пополнить счёт</span>
                </div>
                <div class="quick-action-card" onclick="openBetweenAccountsModal()">
                    <div class="quick-action-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" transform="rotate(45)"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z" fill="currentColor"/></svg>
                    </div>
                    <span class="quick-action-text">Между счетами</span>
                </div>
            </div>
        </div>
    `;
}

function getTxIconSvg(tx) {
    const title = (tx.title || '').toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    if (title.includes('снятие') || desc.includes('снятие') || title.includes('наличн') || desc.includes('наличн') || title.includes('максим') || title.includes('юрий') || desc.includes('сбп')) {
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M19 14V6c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2zm-7-1c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm-9 5h18v2H3v-2z" fill="currentColor"/></svg>`;
    } else if (title.includes('кофейня') || title.includes('coffee')) {
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18.5 3H6c-1.1 0-2 .9-2 2v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h.5c1.38 0 2.5-1.12 2.5-2.5S19.88 7 18.5 7H18V5c0-1.1-.9-2-2-2zm0 6H18V9h.5c.28 0 .5.22.5.5s-.22.5-.5.5zM16 15c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2V5h10v10z" fill="currentColor"/></svg>`;
    } else if (title.includes('такси') || title.includes('taxi')) {
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" fill="currentColor"/></svg>`;
    } else if (title.includes('супермаркет') || title.includes('вкусвилл') || title.includes('пятёрочка') || title.includes('перекрёсток') || title.includes('продукты')) {
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" fill="currentColor"/></svg>`;
    } else if (title.includes('азс') || title.includes('лукойл') || title.includes('газпромнефть')) {
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H4V5h8v5zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="currentColor"/></svg>`;
    } else if (title.includes('аптека')) {
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M19 10.5h-5.5V5h-3v5.5H5v3h5.5V19h3v-5.5H19v-3z" fill="currentColor"/></svg>`;
    } else if (title.includes('ozon') || tx.amount > 0) {
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" fill="currentColor"/><path d="M12 17l4-4h-3V9h-2v4H8l4 4z" fill="currentColor"/></svg>`;
    }
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7v2h20V7L12 2zm9 8H3v10h3v-7h4v7h4v-7h4v7h3V10zm-9 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="currentColor"/></svg>`;
}

// --- 2. TRANSACTION HISTORY VIEW ---
function renderHistoryView(container) {
    const grouped = {};
    appState.transactions.forEach(tx => {
        const monthIndex = tx.date.getMonth();
        const year = tx.date.getFullYear();
        const key = `${monthNominative[monthIndex]} ${year}`;
        if (!grouped[key]) {
            grouped[key] = {
                monthName: monthNominative[monthIndex],
                outcomingSum: 0,
                incomingSum: 0,
                txs: []
            };
        }
        grouped[key].txs.push(tx);
        if (tx.amount < 0) {
            grouped[key].outcomingSum += tx.amount;
        } else {
            grouped[key].incomingSum += tx.amount;
        }
    });

    let historyListHtml = '';

    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const [m1, y1] = a.split(' ');
        const [m2, y2] = b.split(' ');
        const d1 = new Date(y1, monthNominative.indexOf(m1), 1);
        const d2 = new Date(y2, monthNominative.indexOf(m2), 1);
        return d2 - d1;
    });

    sortedKeys.forEach(monthKey => {
        const group = grouped[monthKey];

        let txRows = '';
        group.txs.sort((t1, t2) => t2.date - t1.date).forEach(tx => {
            const day = tx.date.getDate();
            const monthG = monthGenitive[tx.date.getMonth()];
            const timeStr = formatTime(tx.date);
            const amtClass = tx.amount > 0 ? '#15c96b' : 'var(--textPrimary)';
            const amtPrefix = tx.amount > 0 ? '+' : '';

            txRows += `
                <div class="transaction-row" onclick="viewTransactionDetails(${tx.id})" style="display: flex; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--border-dark); align-items: center; cursor: pointer;">
                    <div class="tx-icon-box">
                        ${getTxIconSvg(tx)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--textSecondary);">
                            <span>${day} ${monthG}, ${timeStr} • ${tx.status || 'Исполнен'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 4px; align-items: center;">
                            <span style="font-weight: 500; font-size: 14px; color: var(--textPrimary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 65%;">${tx.title}</span>
                            <span style="font-weight: 600; font-size: 14px; color: ${amtClass}; flex-shrink: 0;">
                                ${amtPrefix}${formatAmount(tx.amount)}
                            </span>
                        </div>
                        <div style="font-size: 12px; color: var(--textSecondary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${tx.description}
                        </div>
                    </div>
                </div>
            `;
        });

        historyListHtml += `
            <div style="margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 16px; background: rgba(128,128,128,0.04); font-size: 13px; color: var(--textSecondary); font-weight: 600;">
                    <span>${group.monthName}</span>
                    <span style="font-weight: 400; font-size: 11px;">
                        ${group.outcomingSum < 0 ? formatAmount(group.outcomingSum) : ''} 
                        ${group.incomingSum > 0 ? ' | +' + formatAmount(group.incomingSum) : ''}
                    </span>
                </div>
                <div>
                    ${txRows}
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="header svelte-1hmh4r3" style="padding: 16px; display: flex; justify-content: center; align-items: center; border-bottom: 1px solid var(--border-dark);">
            <h3 style="font-size: 18px; font-weight: 700;">История</h3>
        </div>

        <div style="padding: 12px 16px 8px 16px;">
            <div style="position: relative; width: 100%;">
                <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--textSecondary); display: flex; align-items: center; z-index: 1;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>
                </span>
                <input type="text" id="search-history-input" class="history-search-input" placeholder="Поиск" oninput="filterHistoryList(this.value)">
            </div>
        </div>

        <div style="display: flex; gap: 8px; padding: 0 16px 12px 16px; overflow-x: auto; white-space: nowrap;">
            <button style="border: none; border-radius: 8px; background: var(--layerFloor1, #1d2124); color: var(--textPrimary); padding: 8px 12px; font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 500;" onclick="alert('Все фильтры применены')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" fill="currentColor"/></svg>
                Фильтры
            </button>
            <button id="chip-own-transfers" style="border: none; border-radius: 8px; background: var(--layerFloor1, #1d2124); color: var(--textPrimary); padding: 8px 12px; font-size: 12px; cursor: pointer; font-weight: 500;" onclick="toggleOwnTransfersFilter(this)">
                Между своими счетами
            </button>
        </div>

        <div id="history-items-list">
            ${historyListHtml || '<div style="text-align: center; color: var(--textSecondary); margin-top: 40px; font-size: 14px;">Нет операций</div>'}
        </div>
    `;
}

function filterHistoryList(query) {
    const term = query.toLowerCase().trim();
    const rows = document.querySelectorAll('.transaction-row');

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if (text.includes(term)) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    });
}

function toggleOwnTransfersFilter(button) {
    const isActive = button.classList.toggle('active-chip');
    if (isActive) {
        button.style.background = '#005bff';
        button.style.color = 'white';
        document.querySelectorAll('.transaction-row').forEach(row => {
            const desc = row.querySelector('div > div:last-child').innerText.toLowerCase();
            if (desc.includes('между счетами') || desc.includes('собственных средств')) {
                row.style.display = 'flex';
            } else {
                row.style.display = 'none';
            }
        });
    } else {
        button.style.background = 'var(--layerFloor1, #1d2124)';
        button.style.color = 'var(--textPrimary)';
        document.querySelectorAll('.transaction-row').forEach(row => row.style.display = 'flex');
    }
}

// --- 3. TRANSACTION DETAILS VIEW ---
function renderTransactionDetails(container, txId) {
    document.getElementById('app-tabbar').style.display = 'none';

    const tx = appState.transactions.find(t => t.id === txId);
    if (!tx) return;

    const day = tx.date.getDate();
    const monthG = monthGenitive[tx.date.getMonth()];
    const year = tx.date.getFullYear();
    const timeStr = formatTime(tx.date);

    const amtColor = tx.amount > 0 ? '#15c96b' : 'var(--textPrimary)';
    const amtPrefix = tx.amount > 0 ? '+' : '';

    let requisitesBlock = '';
    if (tx.inn || tx.account || tx.bank || tx.bik) {
        requisitesBlock = `
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border-dark); font-size: 13px; color: var(--textSecondary); display: flex; flex-direction: column; gap: 6px;">
                <div style="font-weight: 600; color: var(--textPrimary); margin-bottom: 2px;">Реквизиты контрагента</div>
                ${tx.inn ? `<div><span style="color: var(--textSecondary);">ИНН:</span> <span style="color: var(--textPrimary); font-weight: 500;">${tx.inn}</span></div>` : ''}
                ${tx.ogrn ? `<div><span style="color: var(--textSecondary);">ОГРН:</span> <span style="color: var(--textPrimary); font-weight: 500;">${tx.ogrn}</span></div>` : ''}
                ${tx.account ? `<div><span style="color: var(--textSecondary);">Р/с:</span> <span style="color: var(--textPrimary); font-weight: 500;">${tx.account}</span></div>` : ''}
                ${tx.bank ? `<div><span style="color: var(--textSecondary);">Банк:</span> <span style="color: var(--textPrimary); font-weight: 500;">${tx.bank}</span></div>` : ''}
                ${tx.bik ? `<div><span style="color: var(--textSecondary);">БИК:</span> <span style="color: var(--textPrimary); font-weight: 500;">${tx.bik}</span></div>` : ''}
                ${tx.corrAccount ? `<div><span style="color: var(--textSecondary);">К/с:</span> <span style="color: var(--textPrimary); font-weight: 500;">${tx.corrAccount}</span></div>` : ''}
                ${tx.address ? `<div><span style="color: var(--textSecondary);">Адрес:</span> <span style="color: var(--textPrimary); font-weight: 500;">${tx.address}</span></div>` : ''}
            </div>
        `;
    }

    const detailAlertText = tx.inn ? 
        `Реквизиты платежа:\\n` +
        `Получатель: ${tx.title}\\n` +
        `ИНН: ${tx.inn}\\n` +
        `ОГРН: ${tx.ogrn || 'Н/Д'}\\n` +
        `Р/с: ${tx.account || 'Н/Д'}\\n` +
        `Банк: ${tx.bank || 'АО Альфа-Банк'}\\n` +
        `БИК: ${tx.bik || '046015207'}\\n` +
        `Счёт списания: 40802810900001979691` 
        : `Реквизиты платежа:\\nСчет списания: 40802810900001979691\\nБанк получателя: ООО Озон Банк\\nБИК: 044525104`;

    container.innerHTML = `
        <div class="header svelte-1hmh4r3" style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-dark);">
            <div class="details-back-btn" onclick="closeTransactionDetails()" style="cursor: pointer; padding: 4px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor"/></svg>
            </div>
            <span style="font-size: 14px; font-weight: 600; color: var(--textPrimary);">№${tx.id} от ${day}.${String(tx.date.getMonth() + 1).padStart(2, '0')}.${year}, ${timeStr}</span>
            <div style="width: 24px;"></div>
        </div>

        <div style="padding: 16px;">
            <div class="card" style="background: var(--layerFloor1, #1d2124); border-radius: 20px; padding: 24px; text-align: left; border: 1px solid var(--border-dark); position: relative; width: 100%;">
                <div style="margin: 0 0 16px 0; display: inline-flex; align-items: center; gap: 6px; background: rgba(21, 201, 107, 0.12); color: #15c96b; padding: 4px 12px; border-radius: 50px; font-size: 12px; font-weight: 600;">
                    ✓ Исполнен
                </div>
                
                <div style="font-size: 28px; font-weight: 700; color: ${amtColor}; margin-bottom: 16px; text-align: left;">
                    ${amtPrefix}${formatAmount(Math.abs(tx.amount))}
                </div>

                <div style="font-size: 15px; font-weight: 600; color: var(--textPrimary); margin-bottom: 8px; text-align: left;">
                    ${tx.title}
                </div>

                <div style="font-size: 13px; color: var(--textSecondary); line-height: 1.4; margin-bottom: 16px; text-align: left;">
                    ${tx.description}
                </div>

                ${requisitesBlock}

                <button style="border: none; background: rgba(0, 91, 255, 0.12); color: #0084ff; font-weight: 600; font-size: 13px; padding: 10px 24px; border-radius: 10px; cursor: pointer; width: 100%; margin-top: 16px;" onclick="alert('${detailAlertText}')">
                    Подробнее
                </button>
            </div>

            <div style="margin-top: 20px; background: var(--layerFloor1, #1d2124); border-radius: 16px; overflow: hidden; border: 1px solid var(--border-dark);">
                <div onclick="repeatTransaction(${tx.id})" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--border-dark); cursor: pointer;" class="transaction-row">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="color: #0084ff; display: flex; align-items: center;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6 0 3.31-2.69 6-6 6s-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" fill="currentColor"/></svg>
                        </div>
                        <span style="font-size: 14px; font-weight: 500; color: var(--textPrimary);">Повторить</span>
                    </div>
                    <div style="color: var(--graphicSecondary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                    </div>
                </div>

                <div onclick="downloadReceipt(${tx.id})" style="display: flex; justify-content: space-between; align-items: center; padding: 16px; cursor: pointer;" class="transaction-row">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="color: #0084ff; display: flex; align-items: center;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z" fill="currentColor"/></svg>
                        </div>
                        <span style="font-size: 14px; font-weight: 500; color: var(--textPrimary);">Скачать</span>
                    </div>
                    <div style="color: var(--graphicSecondary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function viewTransactionDetails(txId) {
    appState.activeDetailTxId = txId;
    renderActiveView();
}

function closeTransactionDetails() {
    appState.activeDetailTxId = null;
    document.getElementById('app-tabbar').style.display = 'flex';
    renderActiveView();
}

function repeatTransaction(txId) {
    const tx = appState.transactions.find(t => t.id === txId);
    if (!tx) return;

    if (tx.amount < 0 && appState.balancePersonal < Math.abs(tx.amount)) {
        alert('Недостаточно средств на счете для повторения операции');
        return;
    }

    const newTx = {
        id: appState.transactions.length + 1,
        date: new Date(),
        title: tx.title,
        amount: tx.amount,
        type: tx.type,
        description: tx.description
    };

    if (tx.amount < 0) {
        appState.balancePersonal += tx.amount;
    } else {
        appState.balanceBusiness += tx.amount;
    }

    appState.transactions.unshift(newTx);
    alert('Операция успешно повторена!');
    closeTransactionDetails();
}

function downloadReceipt(txId) {
    alert('Квитанция успешно загружена в формате PDF');
}

// --- 4. PAYMENTS & TRANSFERS VIEW ---
function renderPaymentsView(container) {
    const sendActive = appState.paymentsSegment === 'send' ? 'active' : '';
    const receiveActive = appState.paymentsSegment === 'receive' ? 'active' : '';

    let listContentHtml = '';

    if (appState.paymentsSegment === 'send') {
        listContentHtml = `
            <div style="border-radius: 16px; overflow: hidden;">
                <div class="transaction-row" onclick="openQuickPaymentModal()" style="display: flex; gap: 14px; padding: 16px; align-items: center; cursor: pointer;">
                    <div style="color: #0084ff; display: flex; align-items: center;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/></svg>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 500; color: var(--textPrimary);">По реквизитам</div>
                        <div style="font-size: 12px; color: var(--textSecondary); margin-top: 2px;">Юрлицу, физлицу, в бюджет</div>
                    </div>
                    <div style="color: var(--graphicSecondary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                    </div>
                </div>

                <div class="transaction-row" onclick="openQuickPaymentModal()" style="display: flex; gap: 14px; padding: 16px; align-items: center; cursor: pointer;">
                    <div style="color: #0084ff; display: flex; align-items: center;">
                        <svg width="24px" height="24px" fill="none" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="color: var(--sbpLogoColorPrimary)" data-testid="sbp-logo"><defs><g id="sbp-logo"><path d="M0 26.12l14.532 25.975v15.844L.017 93.863 0 26.12z" fill="#5B57A2"></path><path d="M55.797 42.643l13.617-8.346 27.868-.026-41.485 25.414V42.643z" fill="#D90751"></path><path d="M55.72 25.967l.077 34.39-14.566-8.95V0l14.49 25.967z" fill="#FAB718"></path><path d="M97.282 34.271l-27.869.026-13.693-8.33L41.231 0l56.05 34.271z" fill="#ED6F26"></path><path d="M55.797 94.007V77.322l-14.566-8.78.008 51.458 14.558-25.993z" fill="#63B22F"></path><path d="M69.38 85.737L14.531 52.095 0 26.12l97.223 59.583-27.844.034z" fill="#1487C9"></path><path d="M41.24 120l14.556-25.993 13.583-8.27 27.843-.034L41.24 120z" fill="#017F36"></path><path d="M.017 93.863l41.333-25.32-13.896-8.526-12.922 7.922L.017 93.863z" fill="#984995"></path></g><g id="sbp-title"><path d="M211.439 33.692V63.03h-10.476V42.45h-10.087v20.58H180.4V33.69h31.039z" class="extended svelte-5vwwso"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M158.885 64.079c9.378 0 16.342-5.75 16.342-14.467 0-8.437-5.138-13.915-13.725-13.915-3.963 0-7.233 1.395-9.696 3.802.588-4.975 4.795-8.607 9.427-8.607 1.069 0 9.117-.017 9.117-.017l4.551-8.709s-10.104.23-14.801.23c-10.732.187-17.981 9.942-17.981 21.79 0 13.803 7.07 19.893 16.766 19.893zm.057-20.668c3.482 0 5.896 2.288 5.896 6.2 0 3.521-2.145 6.422-5.896 6.43-3.588 0-6.002-2.688-6.002-6.37 0-3.913 2.414-6.26 6.002-6.26z" class="extended svelte-5vwwso"></path><path d="M133.592 53.208s-2.474 1.426-6.169 1.696c-4.248.126-8.033-2.557-8.033-7.324 0-4.65 3.34-7.315 7.926-7.315 2.812 0 6.532 1.949 6.532 1.949s2.722-4.995 4.132-7.493c-2.582-1.957-6.021-3.03-10.021-3.03-10.095 0-17.914 6.582-17.914 15.83 0 9.366 7.349 15.795 17.914 15.601 2.953-.11 7.027-1.147 9.51-2.742l-3.877-7.172z" class="extended svelte-5vwwso"></path></g><g id="sbp-description"><path d="M119.393 82.775c-.32.408-.741.716-1.246.924a4.282 4.282 0 01-1.632.316 4.63 4.63 0 01-1.633-.274 3.623 3.623 0 01-1.262-.782 3.539 3.539 0 01-.824-1.224 4.173 4.173 0 01-.295-1.589c0-.54.093-1.04.286-1.514.185-.475.454-.882.791-1.224.337-.349.741-.615 1.195-.823.463-.2.968-.308 1.523-.308.598 0 1.153.075 1.658.224.505.15.934.4 1.287.75l-.614 1.04a2.886 2.886 0 00-1.027-.6 3.612 3.612 0 00-1.119-.174c-.336 0-.656.066-.967.191a2.591 2.591 0 00-.825.533 2.438 2.438 0 00-.564.832c-.143.324-.21.682-.21 1.081 0 .408.075.774.218 1.09.144.325.337.6.581.832.244.234.53.408.858.525.329.125.674.183 1.044.183.454 0 .867-.092 1.22-.267a3.05 3.05 0 00.926-.69l.631.948zM121.126 83.84v-7.405h1.33v5.517l4.325-5.517h1.33v7.406h-1.33v-5.517l-4.325 5.517h-1.33zM136.921 82.775a3.01 3.01 0 01-1.245.924 4.291 4.291 0 01-1.633.316 4.628 4.628 0 01-1.632-.274 3.627 3.627 0 01-1.263-.782 3.539 3.539 0 01-.824-1.224 4.173 4.173 0 01-.295-1.589c0-.54.093-1.04.286-1.514.186-.475.455-.882.791-1.224.337-.349.741-.615 1.195-.823a3.637 3.637 0 011.523-.308c.598 0 1.153.075 1.658.224.505.15.934.4 1.288.75l-.615 1.04a2.874 2.874 0 00-1.026-.6 3.616 3.616 0 00-1.119-.174 2.603 2.603 0 00-1.793.724 2.536 2.536 0 00-.564.832c-.143.324-.21.682-.21 1.081 0 .408.076.774.219 1.09.143.325.336.6.58.832.244.234.531.408.859.525.328.116.673.183 1.043.183.455 0 .859-.092 1.22-.267a3.05 3.05 0 00.926-.69l.631.948zM137.603 76.435h6.824v1.315h-2.743v6.09h-1.33v-6.09h-2.743v-1.315h-.008z" class="extended svelte-5vwwso"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M150.638 83.766c.505-.158.934-.4 1.304-.732l-.404-1.032c-.244.217-.572.4-.967.55-.396.15-.842.224-1.33.224-.732 0-1.338-.191-1.818-.582-.479-.392-.74-.94-.799-1.64h5.756c.059-.258.084-.549.084-.89 0-.508-.093-.965-.278-1.381a3.277 3.277 0 00-.74-1.074 3.295 3.295 0 00-1.111-.69 3.692 3.692 0 00-1.355-.25c-.623 0-1.17.108-1.649.308a3.637 3.637 0 00-1.204.824 3.477 3.477 0 00-.748 1.223 4.272 4.272 0 00-.261 1.514c0 .583.101 1.115.286 1.59a3.5 3.5 0 00.808 1.223c.345.34.765.599 1.262.782a4.772 4.772 0 001.658.274 5.04 5.04 0 001.506-.24zm-3.366-5.7c.412-.374.959-.557 1.649-.557.648 0 1.17.175 1.549.525.379.349.58.832.614 1.447h-4.544a2.26 2.26 0 01.732-1.414z" class="extended svelte-5vwwso"></path><path d="M154.273 76.435h1.212l2.878 3.67 2.726-3.67h1.178v7.406h-1.329v-5.4l-2.592 3.436h-.051l-2.692-3.437v5.4h-1.33v-7.405z" class="extended svelte-5vwwso"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M165.885 76.46a4.187 4.187 0 00-1.144.49l.353 1.05c.303-.15.606-.275.909-.383.303-.109.69-.159 1.153-.159.37 0 .665.059.892.175.227.108.395.275.513.475.118.2.194.449.236.74.042.291.059.607.059.949a2.28 2.28 0 00-.909-.375 5.229 5.229 0 00-.959-.1c-.396 0-.766.059-1.12.158-.353.1-.656.25-.9.45a2.14 2.14 0 00-.589.74 2.3 2.3 0 00-.219 1.007c0 .724.211 1.29.631 1.69.421.399.976.598 1.666.598.623 0 1.12-.108 1.498-.324.379-.217.682-.466.901-.749v.957h1.245v-4.543c0-.966-.21-1.714-.639-2.239-.421-.524-1.17-.79-2.23-.79-.472 0-.918.066-1.347.183zm2.223 6c-.303.216-.699.315-1.187.315-.429 0-.766-.108-1.001-.316-.236-.216-.354-.499-.354-.849 0-.207.042-.382.135-.54.093-.158.219-.283.362-.383a1.6 1.6 0 01.513-.225c.194-.05.387-.075.589-.075.657 0 1.22.158 1.683.491v.94a3.824 3.824 0 01-.74.641zM181.841 73.83c.269-.124.521-.332.757-.64l-.724-1.04c-.185.25-.395.424-.631.516a4.007 4.007 0 01-.774.216l-.252.045c-.219.038-.454.08-.707.122a5.224 5.224 0 00-1.178.366c-.598.258-1.077.607-1.439 1.048-.362.441-.648.94-.842 1.49a7.793 7.793 0 00-.395 1.722c-.068.6-.101 1.173-.101 1.722 0 .708.092 1.348.277 1.922.186.575.446 1.057.791 1.448.345.4.758.7 1.246.916.488.216 1.035.324 1.649.324.564 0 1.086-.108 1.557-.308a3.758 3.758 0 001.212-.823c.336-.342.606-.75.791-1.207.193-.458.286-.949.286-1.465 0-.557-.084-1.064-.244-1.514a3.271 3.271 0 00-.69-1.156 3.072 3.072 0 00-1.103-.75 3.827 3.827 0 00-1.447-.266c-.32 0-.631.042-.934.125a3.604 3.604 0 00-.842.358 3.2 3.2 0 00-.698.54c-.202.209-.37.442-.488.708h-.034c.026-.341.068-.69.143-1.048.076-.358.185-.7.329-1.024.143-.324.328-.616.555-.882a2.52 2.52 0 01.875-.624 4.646 4.646 0 011.153-.374l.264-.048c.263-.048.514-.094.754-.144.32-.066.614-.15.884-.274zm-4.679 7.115a4.146 4.146 0 01-.185-1.298 2.09 2.09 0 01.303-.707c.143-.225.328-.424.547-.6a2.773 2.773 0 011.733-.59c.783 0 1.372.241 1.784.716.413.482.615 1.081.615 1.805 0 .358-.068.683-.185.982a2.36 2.36 0 01-1.279 1.323c-.303.133-.632.2-1.002.2s-.707-.075-1.018-.225a2.34 2.34 0 01-.8-.624 3.129 3.129 0 01-.513-.982zM193.563 76.435h-1.33v7.406h1.33v-7.406zm-8.281 0h1.33v2.222h1.229c.58 0 1.051.075 1.43.216.379.142.682.333.909.566.227.233.387.508.48.815.092.308.143.624.143.957 0 .333-.051.65-.16.966-.101.316-.278.59-.514.84-.235.25-.555.45-.959.6-.404.149-.892.232-1.481.232h-2.415v-7.414h.008zm1.33 3.461v2.713h.968c.665 0 1.136-.116 1.405-.35.27-.233.404-.565.404-1.006 0-.45-.143-.79-.412-1.024-.278-.233-.741-.35-1.38-.35h-.985v.017z" class="extended svelte-5vwwso"></path><path d="M202.357 82.775c-.32.408-.741.716-1.246.924a4.286 4.286 0 01-1.632.316 4.63 4.63 0 01-1.633-.274 3.613 3.613 0 01-1.262-.782 3.555 3.555 0 01-.825-1.224 4.192 4.192 0 01-.294-1.589c0-.54.092-1.04.286-1.514.185-.475.454-.882.791-1.224.337-.349.74-.615 1.195-.823a3.634 3.634 0 011.523-.308c.597 0 1.153.075 1.658.224.505.15.934.4 1.287.75l-.614 1.04a2.886 2.886 0 00-1.027-.6 3.612 3.612 0 00-1.119-.174c-.336 0-.656.066-.968.191a2.587 2.587 0 00-.824.533 2.52 2.52 0 00-.564.832c-.143.324-.21.682-.21 1.081 0 .408.075.774.218 1.09.143.325.337.6.581.832.244.234.53.408.858.525.329.116.674.183 1.044.183.454 0 .858-.092 1.22-.267a3.05 3.05 0 00.926-.69l.631.948zM203.038 76.435h6.825v1.315h-2.744v6.09h-1.329v-6.09h-2.743v-1.315h-.009z" class="extended svelte-5vwwso"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M212.64 76.436h-1.33v10.7h1.33V83.5c.269.175.589.3.959.383.37.083.757.124 1.153.124.589 0 1.119-.108 1.599-.307a3.825 3.825 0 001.228-.84c.345-.359.606-.775.791-1.266.185-.49.278-1.015.278-1.572 0-.55-.084-1.057-.244-1.515a3.524 3.524 0 00-.69-1.181 2.996 2.996 0 00-1.086-.774 3.49 3.49 0 00-1.439-.283c-.521 0-1.009.1-1.472.3-.463.2-.825.44-1.077.74v-.873zm.926 1.373c.379-.2.791-.3 1.237-.3.387 0 .732.058 1.044.183.303.125.555.3.766.533.21.233.37.5.471.815.109.316.16.658.16 1.032 0 .4-.068.757-.185 1.09a2.4 2.4 0 01-.514.849 2.36 2.36 0 01-.816.557 2.685 2.685 0 01-1.086.208c-.361 0-.698-.041-1.018-.124a3.328 3.328 0 01-.984-.45v-3.67c.235-.282.547-.523.925-.723zM228.847 76.435h-1.33v7.406h1.33v-7.406zm-8.289 0h1.33v2.222h1.228c.581 0 1.052.075 1.431.216.379.142.682.333.909.566.227.233.387.508.479.815.093.308.143.624.143.957 0 .333-.05.65-.159.966-.101.316-.278.59-.514.84-.235.25-.555.45-.959.6-.404.149-.892.232-1.481.232h-2.415v-7.414h.008zm1.339 3.461v2.713h.968c.664 0 1.136-.116 1.405-.35.269-.233.404-.565.404-1.006 0-.45-.143-.79-.412-1.024-.278-.233-.741-.35-1.38-.35h-.985v.017z" class="extended svelte-5vwwso"></path><path d="M235.226 80.005l2.844 3.836h-1.632l-2.197-2.996-2.23 2.996h-1.548l2.827-3.77-2.659-3.636h1.633l2.028 2.796 2.061-2.796h1.549l-2.676 3.57zM118.409 92.994h-4.081v6.174h-1.33v-7.405h6.74v7.405h-1.329v-6.174zM127.286 93.077h-2.625l-.085 1.248c-.092 1.057-.218 1.906-.395 2.554-.177.65-.396 1.149-.648 1.498-.252.35-.547.591-.884.708a3.06 3.06 0 01-1.085.183l-.101-1.282c.143.008.311-.025.496-.108.186-.083.371-.266.547-.54.177-.284.337-.683.48-1.199.143-.524.236-1.206.286-2.064l.135-2.305h5.209v7.406h-1.33v-6.1z" class="extended svelte-5vwwso"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M132.201 91.78c-.43.116-.817.282-1.145.49l.354 1.049c.303-.15.606-.275.908-.383.303-.108.691-.158 1.153-.158.371 0 .665.058.892.174.228.109.396.275.514.475.117.2.193.45.235.74.042.292.059.608.059.949a2.277 2.277 0 00-.909-.374 5.22 5.22 0 00-.959-.1c-.395 0-.766.058-1.119.158-.354.1-.657.25-.901.45a2.14 2.14 0 00-.589.74 2.3 2.3 0 00-.218 1.007c0 .723.21 1.29.631 1.689.42.399.976.599 1.666.599.623 0 1.119-.108 1.498-.325.378-.216.681-.466.9-.749v.957h1.246v-4.543c0-.965-.211-1.714-.64-2.238-.421-.525-1.17-.79-2.23-.79a5.1 5.1 0 00-1.346.182zm2.23 5.998c-.302.217-.698.317-1.186.317-.438 0-.766-.108-1.001-.317-.236-.216-.354-.499-.354-.848 0-.208.042-.383.135-.541.092-.158.219-.283.362-.383.143-.1.319-.175.513-.225a2.33 2.33 0 01.589-.074c.656 0 1.22.158 1.683.49v.94a3.83 3.83 0 01-.741.641z" class="extended svelte-5vwwso"></path><path d="M137.72 91.763h6.825v1.314h-2.744v6.091h-1.329v-6.09h-2.743v-1.315h-.009z" class="extended svelte-5vwwso"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M150.756 99.093c.505-.158.934-.4 1.304-.732l-.404-1.032c-.244.217-.572.4-.968.55-.395.15-.841.224-1.329.224-.732 0-1.338-.191-1.818-.582-.48-.391-.74-.94-.799-1.64h5.756c.058-.257.084-.549.084-.89 0-.507-.093-.965-.278-1.381a3.264 3.264 0 00-.741-1.073 3.28 3.28 0 00-1.11-.691 3.696 3.696 0 00-1.355-.25c-.623 0-1.17.108-1.649.308a3.618 3.618 0 00-1.204.824 3.494 3.494 0 00-.749 1.223 4.294 4.294 0 00-.261 1.514c0 .583.101 1.115.286 1.59.186.474.463.882.808 1.223.345.341.766.599 1.263.782a4.766 4.766 0 001.657.275c.497 0 1.002-.084 1.507-.242zm-3.374-5.708c.412-.374.959-.557 1.649-.557.657 0 1.17.183 1.549.524.378.35.58.832.614 1.448h-4.544a2.26 2.26 0 01.732-1.415zM153.23 91.763h1.683l2.566 3.57-2.743 3.835h-1.632l2.877-3.836-2.751-3.57zm4.577 0h1.33v7.405h-1.33v-7.405zm6.084 7.405l-2.928-3.836 2.735-3.57h-1.65l-2.583 3.57 2.777 3.836h1.649zM169.967 99.093c.505-.158.934-.4 1.304-.732l-.404-1.032c-.244.217-.572.4-.967.55-.396.15-.842.224-1.33.224-.732 0-1.338-.191-1.818-.582-.479-.391-.74-.94-.799-1.64h5.756c.059-.257.084-.549.084-.89 0-.507-.092-.965-.278-1.381a3.276 3.276 0 00-.74-1.073 3.284 3.284 0 00-1.111-.691 3.692 3.692 0 00-1.355-.25c-.622 0-1.169.108-1.649.308a3.624 3.624 0 00-1.203.824 3.465 3.465 0 00-.749 1.223 4.272 4.272 0 00-.261 1.514c0 .583.101 1.115.286 1.59.185.474.463.882.808 1.223.345.341.765.599 1.262.782a4.772 4.772 0 001.658.275 5.04 5.04 0 001.506-.242zm-3.374-5.708c.413-.374.96-.557 1.65-.557.648 0 1.169.183 1.548.524.379.35.581.832.614 1.448h-4.544a2.26 2.26 0 01.732-1.415zM177.188 89.275c-.783 0-1.212-.433-1.279-1.298h-1.254c0 .332.059.632.168.915.11.283.27.524.48.724.21.2.48.358.791.482.311.125.673.183 1.085.183.379 0 .716-.058 1.019-.183.303-.116.555-.282.774-.482.21-.2.379-.441.496-.724.118-.283.177-.583.177-.915H178.4c-.059.865-.472 1.298-1.212 1.298zm-3.594 2.487v7.406h1.33l4.325-5.517v5.517h1.33v-7.406h-1.33l-4.325 5.517v-5.517h-1.33z" class="extended svelte-5vwwso"></path></g></defs><use href="#sbp-logo"></use><!--[-1--><!--]--><!--[-1--><!--]--></svg>
                        </div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 500; color: var(--textPrimary);">Физлицу по номеру телефона</div>
                        <div style="font-size: 12px; color: var(--textSecondary); margin-top: 2px;">Перевод через СБП</div>
                    </div>
                    <div style="color: var(--graphicSecondary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                    </div>
                </div>

                <div class="transaction-row" onclick="openBetweenAccountsModal()" style="display: flex; gap: 14px; padding: 16px; align-items: center; cursor: pointer;">
                    <div style="color: #0084ff; display: flex; align-items: center;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" transform="rotate(45)"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z" fill="currentColor"/></svg>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 500; color: var(--textPrimary);">Между счетами</div>
                        <div style="font-size: 12px; color: var(--textSecondary); margin-top: 2px;">Перевод без комиссии</div>
                    </div>
                    <div style="color: var(--graphicSecondary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                    </div>
                </div>

                <div class="transaction-row" onclick="alert('Сканирование QR кода')" style="display: flex; gap: 14px; padding: 16px; align-items: center; cursor: pointer;">
                    <div style="color: #0084ff; display: flex; align-items: center;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm-2 16h8v-8H3v8zm2-6h4v4H5v-4zm8-12v8h8V3h-8zm6 6h-4V5h4v4zm0 6h2v2h-2zm-6-2h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zm4-4h2v2h-2zm-4-2h2v2h-2zm4-2h2v2h-2z" fill="currentColor"/></svg>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 500; color: var(--textPrimary);">По QR-коду</div>
                        <div style="font-size: 12px; color: var(--textSecondary); margin-top: 2px;">Оплата квитанций или товаров</div>
                    </div>
                    <div style="color: var(--graphicSecondary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                    </div>
                </div>

                <div class="transaction-row" onclick="alert('Импорт платежных поручений из 1C XML')" style="display: flex; gap: 14px; padding: 16px; align-items: center; cursor: pointer;">
                    <div style="color: #0084ff; display: flex; align-items: center;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" fill="currentColor"/></svg>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 500; color: var(--textPrimary);">Загрузить из 1С</div>
                        <div style="font-size: 12px; color: var(--textSecondary); margin-top: 2px;">Импорт платежных поручений</div>
                    </div>
                    <div style="color: var(--graphicSecondary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                    </div>
                </div>
            </div>
        `;
    } else {
        listContentHtml = `
            <div style="border-radius: 16px; overflow: hidden; margin: 0 16px;">
                <div class="transaction-row" onclick="navigateToTab('chat')" style="display: flex; gap: 14px; padding: 16px; align-items: center; cursor: pointer;">
                    <div style="color: #0084ff; display: flex; align-items: center;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/></svg>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 500; color: var(--textPrimary);">Реквизиты счёта</div>
                        <div style="font-size: 12px; color: var(--textSecondary); margin-top: 2px;">Отправить партнеру (доступно в чате)</div>
                    </div>
                    <div style="color: var(--graphicSecondary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                    </div>
                </div>

                <div class="transaction-row" onclick="alert('Выставить счёт партнеру')" style="display: flex; gap: 14px; padding: 16px; align-items: center; cursor: pointer;">
                    <div style="color: #0084ff; display: flex; align-items: center;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="currentColor"/></svg>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 500; color: var(--textPrimary);">Выставить счёт</div>
                        <div style="font-size: 12px; color: var(--textSecondary); margin-top: 2px;">Создать счет на оплату для клиента</div>
                    </div>
                    <div style="color: var(--graphicSecondary);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="header svelte-1hmh4r3" style="padding: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-dark);">
            <div style="width: 24px;"></div>
            <h3 style="font-size: 18px; font-weight: 700; color: var(--textPrimary);">Платежи и переводы</h3>
            <button style="background: transparent; border: none; color: #0084ff; cursor: pointer;" onclick="alert('Сканирование QR кода')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 4h6v6H4V4zm2 2v2h2V6H6zm0 12v-2h2v2H6zM4 14h6v6H4v-6zm10-10h6v6h-6V4zm2 2v2h2V6h-2zm-2 10h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2-6h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2z" fill="currentColor"/></svg>
            </button>
        </div>

        <div style="display: flex; gap: 8px; padding: 16px; overflow-x: auto; -webkit-overflow-scrolling: touch;">
            <div class="payments-top-card" style="flex: 1; min-width: 110px;" onclick="alert('Запуск процесса заказа карты')">
                <div class="icon-wrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" fill="currentColor"/></svg>
                </div>
                <div style="font-size: 12px; font-weight: 600; color: var(--textPrimary); line-height: 1.25;">Выпустить бизнес-карту</div>
            </div>
            
            <div class="payments-top-card" style="flex: 1; min-width: 110px;" onclick="alert('Создание счета для контрагента')">
                <div class="icon-wrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/></svg>
                </div>
                <div style="font-size: 12px; font-weight: 600; color: var(--textPrimary); line-height: 1.25;">Выставить счёт</div>
            </div>

            <div class="payments-top-card" style="flex: 1; min-width: 110px;" onclick="alert('Переход к оплате налогов в ЕНС')">
                <div class="icon-wrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path fill="currentColor" d="M12.336 4.03h-.672c-.29 0-.435 0-.55-.07a.498.498 0 0 1-.082-.06c-.1-.092-.146-.234-.237-.517-.124-.383-.186-.575-.13-.741a.523.523 0 0 1 .057-.117c.095-.146.28-.21.652-.337l.31-.107C11.842 2.027 11.92 2 12 2c.08 0 .159.027.315.08l.311.108c.372.127.557.191.652.337a.523.523 0 0 1 .057.117c.056.166-.006.358-.13.741-.091.283-.137.425-.237.517a.498.498 0 0 1-.082.06c-.115.07-.26.07-.55.07ZM10.007 8.658c0-1.741-.339-2.209-.339-2.209-.169-.148-.833-.259-1.267-.317-.386-.051-.38-.122-.263-.389.197-.45.652-1.184 1.53-1.184C11.642 4.56 12 8.143 12 10.715c0-2.572.358-6.156 2.332-6.156.878 0 1.333.734 1.53 1.184.117.267.123.338-.263.39-.434.057-1.098.168-1.267.316 0 0-.339.468-.339 2.209C13.993 9.79 14.332 11 15 11c1 0 1.435-.803 1.137-1.944-.416-1.592.097-1.938 1.654-3.004l1.653-1.132c.503-.343.68-.262 1.143.455A8.905 8.905 0 0 1 22 10.2c0 4.558-2.898 6.406-4.626 6.677-.333.052-.337.117-.102.32.383.331.814.7 1.137.978.36.308.632.608.302.992a.556.556 0 0 1-.42.207c-.94 0-1.526-.667-2.065-1.279-.21-.24-.413-.47-.627-.65-.892-.747-2.63-.04-.27 1.596.579.402.7.598.159 1.047-.515.426-1.53.912-3.488.912-1.957 0-2.973-.486-3.488-.912-.541-.45-.42-.645.16-1.047 2.359-1.636.621-2.343-.27-1.595-.215.179-.418.41-.628.65-.539.611-1.125 1.278-2.064 1.278a.556.556 0 0 1-.42-.207c-.331-.384-.058-.684.301-.992l1.137-.977c.235-.204.231-.269-.102-.32C4.898 16.605 2 14.757 2 10.2c0-2.232.816-3.902 1.412-4.825.464-.717.641-.798 1.144-.455l1.653 1.132c1.557 1.066 2.043 1.515 1.654 3.004C7.565 10.198 8 11 9 11c.668 0 1.007-.602 1.007-2.342Zm0 6.17c0 1.035.02 1.045.81 1.448l.187.096c.99.51 1.002.51 1.992 0l.188-.096c.79-.403.809-.413.809-1.447V13.8c0-.555.02-.812-.095-.93-.115-.119-.364-.098-.902-.098h-1.992c-.538 0-.787-.02-.902.098-.115.118-.095.375-.095.93v1.029Z"/></svg>
                </div>
                <div style="font-size: 12px; font-weight: 600; color: var(--textPrimary); line-height: 1.25;">Пополнить ЕНС</div>
            </div>

            <div class="payments-top-card" style="flex: 1; min-width: 110px;" onclick="openReplenishModal()">
                <div class="icon-wrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 9.5c0 .83-.67 1.5-1.5 1.5S6 10.33 6 9.5 6.67 8 7.5 8 9 8.67 9 9.5zM17 16H7v-2h10v2zm0-4H10v-2h7v2z" fill="currentColor"/></svg>
                </div>
                <div style="font-size: 12px; font-weight: 600; color: var(--textPrimary); line-height: 1.25;">Пополнить счёт</div>
            </div>
        </div>

        <div class="payments-toggle-custom">
            <button class="${sendActive}" onclick="togglePaymentsSegment('send')">Отправить</button>
            <button class="${receiveActive}" onclick="togglePaymentsSegment('receive')">Получить</button>
        </div>

        <div style="margin-top: 10px;">
            ${listContentHtml}
        </div>
    `;
}

function togglePaymentsSegment(seg) {
    appState.paymentsSegment = seg;
    renderActiveView();
}

// --- 5. SUPPORT CHAT VIEW ---
function renderChatView(container) {
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: calc(100vh - 56px - env(safe-area-inset-bottom, 0px)); overflow: hidden;">
            <!-- Header -->
            <div class="header svelte-1hmh4r3" style="padding: 12px 16px; display: flex; gap: 12px; align-items: center; border-bottom: 1px solid var(--border-dark); background: var(--layerFloor0, #0e1113); flex-shrink: 0; z-index: 10;">
                <div style="width: 38px; height: 38px; border-radius: 50%; background: #005bff; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 9px; line-height: 1.1; flex-shrink: 0;">
                    <span>ozon</span>
                    <span>банк</span>
                </div>
                <div>
                    <h4 style="font-size: 15px; font-weight: 700; color: var(--textPrimary); margin: 0;">Поддержка</h4>
                    <div style="font-size: 12px; color: var(--textSecondary); font-weight: 400; margin-top: 1px;">Онлайн 24/7</div>
                </div>
            </div>

            <!-- Scrollable Messages List -->
            <div class="chat-messages-container" id="chat-scroller" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 12px 0 20px 0; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column;">
                <div style="display: flex; flex-direction: column; min-height: 100%; justify-content: flex-end; width: 100%;">
                    <div style="text-align: center; color: var(--textSecondary); font-size: 12px; margin: 4px 0 14px;">25 марта</div>
                    <div id="chat-messages-list"></div>
                </div>
            </div>
            
            <!-- Bottom Input Bar -->
            <div class="chat-input-area-custom" style="display: flex; gap: 8px; align-items: center; padding: 8px 12px; background: var(--layerFloor0, #0e1113); border-top: 1px solid var(--border-dark); flex-shrink: 0; position: relative; z-index: 10;">
                <button class="chat-attach-btn" onclick="alert('Прикрепить файлы')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-3.31 2.69-6 6-6s6 2.69 6 6v10.5c0 1.38-1.12 2.5-2.5 2.5s-2.5-1.12-2.5-2.5V6H10v9.5c0 2.48 2.02 4.5 4.5 4.5s4.5-2.02 4.5-4.5V5c0-4.42-3.58-8-8-8s-8 3.58-8 8v12.5c0 3.59 2.91 6.5 6.5 6.5s6.5-2.91 6.5-6.5V6h-1.5z" fill="currentColor"/></svg>
                </button>
                <input type="text" id="chat-text-input" class="chat-input-field" placeholder="Напишите сообщение" onkeypress="handleChatKeyPress(event)">
                <button class="chat-send-btn" onclick="sendChatMessage()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="transform: rotate(0deg); margin-left: 2px;"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/></svg>
                </button>
            </div>
        </div>
    `;

    renderChatMessagesOnly();
    triggerChatScrollToBottom();
}

function triggerChatScrollToBottom() {
    scrollChatToBottom();
    requestAnimationFrame(() => {
        scrollChatToBottom();
        setTimeout(scrollChatToBottom, 0);
        setTimeout(scrollChatToBottom, 50);
        setTimeout(scrollChatToBottom, 150);
        setTimeout(scrollChatToBottom, 350);
        setTimeout(scrollChatToBottom, 600);
    });
}

function scrollChatToBottom() {
    const scroller = document.getElementById('chat-scroller');
    if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
    }
}

function renderChatMessagesOnly() {
    const list = document.getElementById('chat-messages-list');
    if (!list) return;

    list.innerHTML = '';

    appState.chatMessages.forEach(msg => {
        if (msg.isRequisites) {
            list.innerHTML += `
                <div style="display: flex; flex-direction: column; margin-bottom: 14px; align-items: flex-start; width: 100%; padding: 0 16px;">
                    <div style="font-size: 11px; color: var(--textSecondary); margin-left: 4px; margin-bottom: 4px;">Ozon Банк</div>
                    <div class="chat-support-card" style="width: 92%; max-width: 380px;">
                        Наименование: ИП Фон Берг Юрген Александрович;<br>
                        ИНН: 233803342844;<br>
                        ОГРН/ОГРНИП: 326237500068762;<br>
                        Расчётный счёт: 40802810900001979691;<br>
                        Корр. счёт: 30101810645374525068;<br>
                        Банк: ООО «ОЗОН Банк»;<br>
                        БИК: 044525068;<br>
                        ИНН Банка: 9703077050;<br>
                        Юр. адрес банка: РФ, 123112, г. Москва, вн.тер.г. Муниципальный Округ Пресненский, Пресненская наб., дом 10, этаж 19.
                        <div style="text-align: right; font-size: 10px; color: var(--textSecondary); margin-top: 8px;">
                            ${msg.time}
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const isUser = msg.sender === 'user';

        if (isUser) {
            list.innerHTML += `
                <div style="display: flex; flex-direction: column; margin-bottom: 12px; align-items: flex-end; width: 100%; padding: 0 16px;">
                    <div class="chat-user-bubble">
                        <span>${msg.text}</span>
                        <span style="font-size: 10px; color: rgba(255,255,255,0.75); display: flex; align-items: center; gap: 2px; white-space: nowrap; margin-top: 4px;">
                            ${msg.time}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="color: #ffffff;"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.41 11.93l-1.41 1.41 5.66 5.66 12-12-1.42-1.41zM.41 13.34l5.66 5.66 1.41-1.41L1.83 11.93.41 13.34z" fill="currentColor"/></svg>
                        </span>
                    </div>
                </div>
            `;
        } else {
            list.innerHTML += `
                <div style="display: flex; flex-direction: column; margin-bottom: 12px; align-items: flex-start; width: 100%; padding: 0 16px;">
                    <div style="font-size: 11px; color: var(--textSecondary); margin-left: 4px; margin-bottom: 4px;">Ozon Банк</div>
                    <div class="chat-support-bubble">
                        ${msg.text}
                        <div style="text-align: right; font-size: 10px; color: var(--textSecondary); margin-top: 6px;">
                            ${msg.time}
                        </div>
                    </div>
                </div>
            `;
        }
    });

    triggerChatScrollToBottom();
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

function sendChatMessage() {
    const input = document.getElementById('chat-text-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const now = new Date();
    const timeStr = formatTime(now);

    appState.chatMessages.push({
        sender: 'user',
        text: text,
        time: timeStr,
        date: `${now.getDate()} ${monthGenitive[now.getMonth()]}`
    });

    input.value = '';
    renderChatMessagesOnly();

    setTimeout(() => {
        const replyNow = new Date();
        const replyTime = formatTime(replyNow);
        let replyText = 'Спасибо за ваше сообщение! Мы передали ваш вопрос дежурному специалисту поддержки.';

        const lowerText = text.toLowerCase();
        if (lowerText.includes('реквизит') || lowerText.includes('счет') || lowerText.includes('банк')) {
            replyText = 'Реквизиты вашего счёта доступны в начале этой переписки. Вы можете скопировать их для отправки вашим партнерам.';
        } else if (lowerText.includes('баланс') || lowerText.includes('деньги') || lowerText.includes('сколько')) {
            replyText = `Ваш текущий баланс:\n• Счёт для бизнеса: ${formatAmount(appState.balanceBusiness)}\n• Личный счёт: ${formatAmount(appState.balancePersonal)}`;
        } else if (lowerText.includes('привет') || lowerText.includes('здравствуй') || lowerText.includes('privet') || lowerText.includes('hello') || lowerText.includes('hi')) {
            replyText = 'Здравствуйте! Я автоматический помощник Ozon Finance. Чем могу помочь?';
        }

        appState.chatMessages.push({
            sender: 'support',
            text: replyText,
            time: replyTime,
            date: `${replyNow.getDate()} ${monthGenitive[replyNow.getMonth()]}`
        });

        renderChatMessagesOnly();
    }, 1000);
}

// --- 6. SERVICES VIEW ---
function renderServicesView(container) {
    container.innerHTML = `
        <div class="header svelte-1hmh4r3" style="padding: 16px; display: flex; justify-content: center; align-items: center; border-bottom: 1px solid var(--border-dark);">
            <h3 style="font-size: 18px; font-weight: 700; color: var(--textPrimary);">Сервисы</h3>
        </div>

        <div style="padding: 16px 0;">
            <div style="padding: 0 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 16px; font-weight: 700; color: var(--textPrimary);">Мои сервисы</span>
                <span style="font-size: 13px; font-weight: 600; color: #0084ff; cursor: pointer;" onclick="alert('Добавление нового сервиса в панель быстрого доступа')">Добавить</span>
            </div>
            
            <div style="display: flex; gap: 10px; padding: 0 16px 16px 16px; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch;">
                <div onclick="alert('Открытие Справок и выписок')" style="flex-shrink: 0; width: 120px; background: var(--layerFloor1, #1d2124); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 12px; border: none; cursor: pointer;">
                    <div style="color: #0084ff; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"/></svg>
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: var(--textPrimary); white-space: normal; line-height: 1.25;">Справки и выписки</div>
                </div>

                <div onclick="alert('Открытие Отсрочки платежа')" style="flex-shrink: 0; width: 120px; background: var(--layerFloor1, #1d2124); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 12px; border: none; cursor: pointer;">
                    <div style="color: #0084ff; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" fill="currentColor"/></svg>
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: var(--textPrimary); white-space: normal; line-height: 1.25;">Отсрочка платежа</div>
                </div>

                <div onclick="alert('Добавить сервис')" style="flex-shrink: 0; width: 100px; background: rgba(128, 128, 128, 0.06); border-radius: 14px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; min-height: 94px;">
                    <div style="font-size: 32px; color: var(--textSecondary);">+</div>
                </div>
            </div>

            <div style="margin-top: 16px; padding: 0 16px;">
                <span style="font-size: 16px; font-weight: 700; color: var(--textPrimary);">Популярные сервисы</span>
                <div style="font-size: 12px; color: var(--textSecondary); margin-top: 2px; margin-bottom: 12px;">У компаний, похожих на вашу</div>
                
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div onclick="alert('Аналитика селлеров')" style="display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--layerFloor1, #1d2124); border-radius: 16px; border: none; cursor: pointer;" class="transaction-row">
                        <div style="width: 42px; height: 42px; border-radius: 10px; background: #e0f2fe; display: flex; align-items: center; justify-content: center; color: #0284c7; flex-shrink: 0;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2 0v8.5l6-6C17.3 2.9 15.3 2 13 2zm0 10.5V22c2.3 0 4.3-.9 6-2.5l-6-6z" fill="currentColor"/></svg>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 14px; font-weight: 600; color: var(--textPrimary);">Аналитика селлеров</div>
                            <div style="font-size: 11px; color: var(--textSecondary); margin-top: 2px;">Для селлеров Ozon и WB</div>
                        </div>
                        <div style="color: var(--graphicSecondary);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                        </div>
                    </div>

                    <div onclick="alert('Зарплатный проект')" style="display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--layerFloor1, #1d2124); border-radius: 16px; border: none; cursor: pointer;" class="transaction-row">
                        <div style="width: 42px; height: 42px; border-radius: 10px; background: #dcfce7; display: flex; align-items: center; justify-content: center; color: #15c96b; flex-shrink: 0;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" fill="currentColor"/></svg>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 14px; font-weight: 600; color: var(--textPrimary);">Зарплатный проект</div>
                            <div style="font-size: 11px; color: var(--textSecondary); margin-top: 2px;">Выплаты сотрудникам в любой банк без комиссии</div>
                        </div>
                        <div style="color: var(--graphicSecondary);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                        </div>
                    </div>

                    <div onclick="alert('Бизнес-карта')" style="display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--layerFloor1, #1d2124); border-radius: 16px; border: none; cursor: pointer;" class="transaction-row">
                        <div style="width: 42px; height: 42px; border-radius: 10px; background: #e0f2fe; display: flex; align-items: center; justify-content: center; color: #0284c7; flex-shrink: 0;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" fill="currentColor"/></svg>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 14px; font-weight: 600; color: var(--textPrimary);">Бизнес-карта</div>
                            <div style="font-size: 11px; color: var(--textSecondary); margin-top: 2px;">Для бизнес-расходов и личных трат</div>
                        </div>
                        <div style="color: var(--graphicSecondary);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z" fill="currentColor"/></svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- INTERACTIVE ACTIONS & MODALS ---

function createNewProduct() {
    alert('Открытие счета временно недоступно.');
}

// Modal Windows Implementation
function createPhoneModal(title, contentHtml, onConfirm) {
    let modal = document.getElementById('phone-modal-wrapper');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'phone-modal-wrapper';
    modal.style = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6);
        z-index: 99999;
        display: flex;
        align-items: flex-end;
        justify-content: center;
    `;

    modal.innerHTML = `
        <div style="
            background: var(--layerFloor1, #1d2124);
            border-top: 1px solid var(--border-dark);
            border-radius: 20px 20px 0 0;
            max-width: 440px;
            width: 100%;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            animation: slideUp 0.25s ease-out;
            color: var(--textPrimary);
        ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="font-size: 16px; font-weight: 700;">${title}</h4>
                <button style="background: transparent; border: none; color: var(--textSecondary); cursor: pointer;" onclick="closePhoneModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
                </button>
            </div>
            
            <div>
                ${contentHtml}
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 8px;">
                <button style="flex: 1; border: none; background: rgba(128,128,128,0.1); color: var(--textPrimary); border-radius: 10px; height: 44px; font-weight: 600; cursor: pointer;" onclick="closePhoneModal()">Отмена</button>
                <button id="modal-confirm-btn" style="flex: 1; border: none; background: #005bff; color: white; border-radius: 10px; height: 44px; font-weight: 600; cursor: pointer;">Готово</button>
            </div>
        </div>
        <style>
            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
        </style>
    `;

    document.body.appendChild(modal);

    document.getElementById('modal-confirm-btn').addEventListener('click', () => {
        if (onConfirm()) {
            closePhoneModal();
        }
    });
}

window.closePhoneModal = function () {
    const modal = document.getElementById('phone-modal-wrapper');
    if (modal) modal.remove();
};

window.openQuickPaymentModal = function () {
    const content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
                <label style="font-size: 11px; color: var(--textSecondary); font-weight: 600;">ПОЛУЧАТЕЛЬ (ФИО)</label>
                <input type="text" id="pay-recipient" value="Иванов Иван Иванович" style="width: 100%; height: 38px; border-radius: 8px; border: 1px solid var(--border-dark); background: var(--layerFloor0, #0e1113); color: var(--textPrimary); padding: 0 10px; outline: none; font-size: 14px; margin-top: 4px;">
            </div>
            <div>
                <label style="font-size: 11px; color: var(--textSecondary); font-weight: 600;">СУММА (₽)</label>
                <input type="number" id="pay-amount" value="500" min="1" style="width: 100%; height: 38px; border-radius: 8px; border: 1px solid var(--border-dark); background: var(--layerFloor0, #0e1113); color: var(--textPrimary); padding: 0 10px; outline: none; font-size: 14px; margin-top: 4px;">
            </div>
            <div>
                <label style="font-size: 11px; color: var(--textSecondary); font-weight: 600;">СПИСАТЬ С</label>
                <select id="pay-source" style="width: 100%; height: 38px; border-radius: 8px; border: 1px solid var(--border-dark); background: var(--layerFloor0, #0e1113); color: var(--textPrimary); padding: 0 10px; outline: none; font-size: 14px; margin-top: 4px;">
                    <option value="personal">Личный счёт (${formatAmount(appState.balancePersonal)})</option>
                    <option value="business">Счёт для бизнеса (${formatAmount(appState.balanceBusiness)})</option>
                </select>
            </div>
        </div>
    `;

    createPhoneModal('Новый платёж', content, () => {
        const recipient = document.getElementById('pay-recipient').value.trim();
        const amtVal = parseFloat(document.getElementById('pay-amount').value);
        const source = document.getElementById('pay-source').value;

        if (!recipient) {
            alert('Пожалуйста, введите получателя');
            return false;
        }
        if (isNaN(amtVal) || amtVal <= 0) {
            alert('Сумма должна быть положительной');
            return false;
        }

        if (source === 'personal') {
            if (appState.balancePersonal < amtVal) {
                alert('Недостаточно средств на личном счете');
                return false;
            }
            appState.balancePersonal -= amtVal;
        } else {
            if (appState.balanceBusiness < amtVal) {
                alert('Недостаточно средств на счете для бизнеса');
                return false;
            }
            appState.balanceBusiness -= amtVal;
        }

        appState.transactions.unshift({
            id: appState.transactions.length + 1,
            date: new Date(),
            title: recipient,
            amount: -amtVal,
            type: 'outcoming',
            description: 'Перевод через интернет-банк. НДС не облагается'
        });

        alert(`Перевод на сумму ${formatAmount(amtVal)} успешно отправлен!`);
        navigateToTab('history');
        return true;
    });
};

window.openReplenishModal = function () {
    const content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
                <label style="font-size: 11px; color: var(--textSecondary); font-weight: 600;">СУММА ПОПОЛНЕНИЯ (₽)</label>
                <input type="number" id="repl-amount" value="1000" min="1" style="width: 100%; height: 38px; border-radius: 8px; border: 1px solid var(--border-dark); background: var(--layerFloor0, #0e1113); color: var(--textPrimary); padding: 0 10px; outline: none; font-size: 14px; margin-top: 4px;">
            </div>
            <div>
                <label style="font-size: 11px; color: var(--textSecondary); font-weight: 600;">ЗАЧИСЛИТЬ НА</label>
                <select id="repl-dest" style="width: 100%; height: 38px; border-radius: 8px; border: 1px solid var(--border-dark); background: var(--layerFloor0, #0e1113); color: var(--textPrimary); padding: 0 10px; outline: none; font-size: 14px; margin-top: 4px;">
                    <option value="business">Счёт для бизнеса (${formatAmount(appState.balanceBusiness)})</option>
                    <option value="personal">Личный счёт (${formatAmount(appState.balancePersonal)})</option>
                </select>
            </div>
        </div>
    `;

    createPhoneModal('Пополнить счёт', content, () => {
        const amtVal = parseFloat(document.getElementById('repl-amount').value);
        const dest = document.getElementById('repl-dest').value;

        if (isNaN(amtVal) || amtVal <= 0) {
            alert('Сумма должна быть положительной');
            return false;
        }

        if (dest === 'personal') {
            appState.balancePersonal += amtVal;
        } else {
            appState.balanceBusiness += amtVal;
        }

        appState.transactions.unshift({
            id: appState.transactions.length + 1,
            date: new Date(),
            title: 'Пополнение счёта',
            amount: amtVal,
            type: 'incoming',
            description: 'Пополнение через сторонний банк (СБП). НДС не облагается'
        });

        alert(`Счёт успешно пополнен на сумму ${formatAmount(amtVal)}!`);
        navigateToTab('home');
        return true;
    });
};

window.openBetweenAccountsModal = function () {
    const content = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
                <label style="font-size: 11px; color: var(--textSecondary); font-weight: 600;">НАПРАВЛЕНИЕ ПЕРЕВОДА</label>
                <select id="xfer-dir" style="width: 100%; height: 38px; border-radius: 8px; border: 1px solid var(--border-dark); background: var(--layerFloor0, #0e1113); color: var(--textPrimary); padding: 0 10px; outline: none; font-size: 14px; margin-top: 4px;">
                    <option value="p-to-b">С Личного на Бизнес-счёт</option>
                    <option value="b-to-p">С Бизнес-счета на Личный</option>
                </select>
            </div>
            <div>
                <label style="font-size: 11px; color: var(--textSecondary); font-weight: 600;">СУММА (₽)</label>
                <input type="number" id="xfer-amount" value="200" min="1" style="width: 100%; height: 38px; border-radius: 8px; border: 1px solid var(--border-dark); background: var(--layerFloor0, #0e1113); color: var(--textPrimary); padding: 0 10px; outline: none; font-size: 14px; margin-top: 4px;">
            </div>
        </div>
    `;

    createPhoneModal('Между своими счетами', content, () => {
        const amtVal = parseFloat(document.getElementById('xfer-amount').value);
        const dir = document.getElementById('xfer-dir').value;

        if (isNaN(amtVal) || amtVal <= 0) {
            alert('Сумма должна быть положительной');
            return false;
        }

        if (dir === 'p-to-b') {
            if (appState.balancePersonal < amtVal) {
                alert('Недостаточно средств на Личном счете');
                return false;
            }
            appState.balancePersonal -= amtVal;
            appState.balanceBusiness += amtVal;
        } else {
            if (appState.balanceBusiness < amtVal) {
                alert('Недостаточно средств на Бизнес-счете');
                return false;
            }
            appState.balanceBusiness -= amtVal;
            appState.balancePersonal += amtVal;
        }

        appState.transactions.unshift({
            id: appState.transactions.length + 1,
            date: new Date(),
            title: 'Перевод между счетами',
            amount: dir === 'p-to-b' ? amtVal : -amtVal,
            type: dir === 'p-to-b' ? 'incoming' : 'outcoming',
            description: dir === 'p-to-b' ? 'Зачисление на бизнес-счёт с личного счета' : 'Списание с бизнес-счета на личный счет'
        });

        alert(`Перевод на сумму ${formatAmount(amtVal)} успешно выполнен!`);
        navigateToTab('home');
        return true;
    });
};
