import { auth, db } from './firebase-config.js';
import { 
    collection, 
    query, 
    onSnapshot, 
    doc, 
    getDoc,
    where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// State
let transactions = []; // General Finance
let investments = [];
let loans = [];
let currentUser = null;

// Format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

// Auth Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // window.location.href = 'login.html';
        handleGuestAccess();
        return;
    }
    
    // Admin Check
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    // const role = userDoc.exists() ? userDoc.data().role : null;

    // if (!role || (role !== 'admin' && role !== 'Admin')) {
    //     alert('Access Denied');
    //     window.location.href = 'dashboard.html';
    //     return;
    // }

    currentUser = user;
    updateUserInterface(userDoc.data(), user);
    initializeData();
});

function handleGuestAccess() {
    // Hide data or show zeros
    const zero = formatCurrency(0);
    const ids = [
        'totalAllIncome', 'totalAllSpending', 'netTotalBalance',
        'spendToday', 'spendWeek', 'spendMonth', 'spendLastMonth', 'spendYear', 'spendLastYear',
        'totalInvestments', 'totalLoans'
    ];
    
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = zero;
    });

    // Disable any potential action buttons (though this page is mostly read-only)
    // If there were any, we'd disable them here.
}


function updateUserInterface(userData, user) {
    const authDropdown = document.getElementById('authDropdown');
    const userProfile = document.getElementById('userProfile');
    
    // Hide Auth Dropdown (Sign In/Up)
    if (authDropdown) {
        authDropdown.style.display = 'none';
    }

    // Show User Profile
    if (userProfile) {
        userProfile.style.display = 'flex';
        
        // Update user details
        const firstName = (userData.firstName || user.email.split('@')[0]);
        // const profileImage = userData.profileImageUrl || user.profileImageUrl || '/images/default.webp'; // If we have images later
        
        const userNameElements = userProfile.querySelectorAll('.user-name, .dropdown-name');
        userNameElements.forEach(el => el.textContent = firstName);
        
        const userAvatarElements = userProfile.querySelectorAll('.user-avatar, .dropdown-avatar');
        userAvatarElements.forEach(el => el.textContent = firstName.substring(0, 2).toUpperCase());
        
        const userEmailElement = userProfile.querySelector('.dropdown-email');
        if (userEmailElement) userEmailElement.textContent = user.email;
    }

    // Show admin content
    const adminEmployerContent = document.getElementById('adminEmployerContent');
    const adminOnlyContent = document.getElementById('adminOnlyContent');
    const adminOnlyJobs = document.getElementById('adminOnlyJobs');

    if (adminEmployerContent) adminEmployerContent.style.display = 'block';
    if (adminOnlyContent) adminOnlyContent.style.display = 'block';
    if (adminOnlyJobs) adminOnlyJobs.style.display = 'block';
}

function initializeData() {
    // 1. General Financial Records (Income & Expenses)
    const qTrx = query(
        collection(db, 'financialRecords'), 
        where('createdBy', '==', currentUser.uid)
    );
    onSnapshot(qTrx, (snap) => {
        transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        calculateAll();
    });

    // 3. Investments
    const qInvest = query(
        collection(db, 'financialInvestments'), 
        where('createdBy', '==', currentUser.uid)
    );
    onSnapshot(qInvest, (snap) => {
        investments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        calculateAll();
    });

    // 4. Loans
    const qLoans = query(
        collection(db, 'financialLoans'), 
        where('createdBy', '==', currentUser.uid)
    );
    onSnapshot(qLoans, (snap) => {
        loans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        calculateAll();
    });
}

function calculateAll() {
    // Dates
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Start of Week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);

    // Last Month
    let lastMonth = currentMonth - 1;
    let lastMonthYear = currentYear;
    if (lastMonth < 0) { lastMonth = 11; lastMonthYear--; }

    // Last Year
    const lastYear = currentYear - 1;

    // --- Aggregators ---
    let totalIncome = 0;
    
    // Expenses (General + Ads)
    let spendAllTime = 0;
    let spendToday = 0;
    let spendWeek = 0;
    let spendMonth = 0;
    let spendLastMonth = 0;
    let spendYear = 0;
    let spendLastYear = 0;

    // Specific Totals
    let totalInvValue = 0;
    let totalLoanBalance = 0;

    // 1. Process General Transactions
    transactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        const date = new Date(t.date);
        const tMonth = date.getMonth();
        const tYear = date.getFullYear();

        if (t.type === 'income') {
            totalIncome += amount;
        } else if (t.type === 'expense') {
            spendAllTime += amount;

            // Today
            if (t.date === todayStr) spendToday += amount;

            // Week
            if (date >= startOfWeek && date <= now) spendWeek += amount;

            // This Month
            if (tMonth === currentMonth && tYear === currentYear) spendMonth += amount;

            // Last Month
            if (tMonth === lastMonth && tYear === lastMonthYear) spendLastMonth += amount;

            // This Year
            if (tYear === currentYear) spendYear += amount;

            // Last Year
            if (tYear === lastYear) spendLastYear += amount;
        }
    });

    // 3. Investments
    investments.forEach(i => {
        totalInvValue += (parseFloat(i.currentValue) || parseFloat(i.investedAmount) || 0);
    });

    // 4. Loans
    loans.forEach(l => {
        if (l.status === 'active') {
            totalLoanBalance += (parseFloat(l.remainingBalance) || 0);
        }
    });

    // Update UI
    // Grand Totals
    document.getElementById('totalAllIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('totalAllSpending').textContent = formatCurrency(spendAllTime);
    document.getElementById('netTotalBalance').textContent = formatCurrency(totalIncome - spendAllTime);

    // Time Based
    document.getElementById('spendToday').textContent = formatCurrency(spendToday);
    document.getElementById('spendWeek').textContent = formatCurrency(spendWeek);
    document.getElementById('spendMonth').textContent = formatCurrency(spendMonth);
    document.getElementById('spendLastMonth').textContent = formatCurrency(spendLastMonth);
    document.getElementById('spendYear').textContent = formatCurrency(spendYear);
    document.getElementById('spendLastYear').textContent = formatCurrency(spendLastYear);

    // Categories
    document.getElementById('totalInvestments').textContent = formatCurrency(totalInvValue);
    document.getElementById('totalLoans').textContent = formatCurrency(totalLoanBalance);
}
