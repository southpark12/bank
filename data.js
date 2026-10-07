// data.js - Initial Data & Configuration for Ozon Finance SPA

// 1. Account Balances for Home Page
var INITIAL_BALANCES = {
    business: 10, // Derived from transactions at runtime (see appState.balanceBusiness)
    personal: 0.00,   // Личный счёт
};

var LAMEI_REQUISITES = {
    inn: "6164134734",
    ogrn: "1216100010092",
    account: "40702810125140002475",
    bank: "ФИЛИАЛ \"РОСТОВСКИЙ\" АО \"АЛЬФА-БАНК\"",
    bik: "046015207",
    corrAccount: "30101810500000000207",
};

var ALD_REQUISITES = {
    inn: "6168112435",
    ogrn: "1206100029684",
    account: "40702810125140002243",
    bank: "ФИЛИАЛ \"РОСТОВСКИЙ\" АО \"АЛЬФА-БАНК\"",
    bik: "046015207",
    corrAccount: "30101810500000000207",
};

// 2. Transaction history: single source of truth is bank_transactions.json
var TRANSACTIONS_URL = './bank_transactions.json';

// Maps one JSON record to the internal transaction object (newest first, ids count down).
function mapBankTransaction(rec, index, total) {
    const incoming = rec.operation_type === 'Поступление';
    const amount = Number(rec.amount_rub) || 0;
    return {
        id: total - index,
        date: new Date(`${rec.date}T${rec.time}Z`),
        title: rec.counterparty_name || '',
        amount: incoming ? amount : -amount,
        type: incoming ? 'incoming' : 'outcoming',
        status: 'Исполнен',
        description: rec.payment_purpose || '',
        inn: rec.counterparty_inn || '',
        ogrn: '',
        account: (incoming ? rec.payer_account : rec.receiver_account) || '',
        bank: rec.counterparty_bank || '',
        bik: rec.counterparty_bik || '',
        corrAccount: '',
        address: ''
    };
}

async function loadBankTransactions(url) {
    const res = await fetch(url || TRANSACTIONS_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${url || TRANSACTIONS_URL}: ${res.status}`);
    const data = await res.json();
    const list = (data.transactions || []).slice().sort((a, b) =>
        `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
    return list.map((rec, i) => mapBankTransaction(rec, i, list.length));
}

if (typeof window !== 'undefined') {
    window.INITIAL_BALANCES = INITIAL_BALANCES;
    window.loadBankTransactions = loadBankTransactions;
}
