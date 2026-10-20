
"use strict";

// ---------- LOCAL STORAGE KEYS ----------
const USERS_KEY = "finest_users";
const SESSION_KEY = "finest_current_user";
const THEME_KEY = "finest_theme";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let transactions = [];
let financeChart = null;
let toastTimeout;

// ---------- HELPERS ----------
function getUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function storageKey() {
  return `finest_transactions_${currentUser.email.toLowerCase()}`;
}

function getTransactions() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey()) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(storageKey(), JSON.stringify(transactions));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(date) {
  if (!date) return "—";
  const parts = date.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return "—";
  return new Date(parts[0], parts[1] - 1, parts[2])
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------- DARK / LIGHT MODE ----------
function applyTheme(theme) {
  const dark = theme === "dark";
  document.body.classList.toggle("dark", dark);

  $("themeBtn").textContent = dark ? "☀" : "☾";
  $("authThemeBtn").textContent = dark ? "☀" : "☾";

  $("themeBtn").title = dark ? "Switch to light mode" : "Switch to dark mode";
  $("authThemeBtn").title = dark ? "Switch to light mode" : "Switch to dark mode";

  if (currentUser && !$("dashboard").classList.contains("hidden")) {
    renderChart();
  }
}

function toggleTheme() {
  const nextTheme = document.body.classList.contains("dark")
    ? "light"
    : "dark";

  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

$("themeBtn").addEventListener("click", toggleTheme);
$("authThemeBtn").addEventListener("click", toggleTheme);

applyTheme(localStorage.getItem(THEME_KEY) || "light");

// ---------- SWITCH AUTH FORMS ----------
$("showRegister").addEventListener("click", () => {
  $("loginForm").classList.add("hidden");
  $("registerForm").classList.remove("hidden");
});

$("showLogin").addEventListener("click", () => {
  $("registerForm").classList.add("hidden");
  $("loginForm").classList.remove("hidden");
});

// ---------- REGISTRATION ----------
$("register").addEventListener("submit", (event) => {
  event.preventDefault();

  const name = $("registerName").value.trim();
  const email = $("registerEmail").value.trim().toLowerCase();
  const password = $("registerPassword").value;

  if (name.length < 2) {
    showToast("Please enter your full name.");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters.");
    return;
  }

  const users = getUsers();

  if (users.some((user) => user.email === email)) {
    showToast("This email is already registered. Please sign in.");
    return;
  }

  // Demo only: passwords are stored in plain text.
  // Production apps must use a secure server-side authentication system.
  users.push({
    id: makeId(),
    name,
    email,
    password
  });

  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  $("register").reset();
  $("registerForm").classList.add("hidden");
  $("loginForm").classList.remove("hidden");
  $("loginEmail").value = email;

  showToast("Account created! Please sign in.");
});

// ---------- LOGIN ----------
$("login").addEventListener("submit", (event) => {
  event.preventDefault();

  const email = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;
  const user = getUsers().find(
    (item) => item.email === email && item.password === password
  );

  if (!user) {
    showToast("Invalid email or password.");
    return;
  }

  startSession(user);
  $("login").reset();
  showToast("Welcome back, " + user.name + "!");
});

// ---------- SESSION MANAGEMENT ----------
function startSession(user) {
  currentUser = {
    id: user.id,
    name: user.name,
    email: user.email
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify({
    id: user.id,
    email: user.email
  }));

  transactions = getTransactions();

  $("authPage").classList.add("hidden");
  $("dashboard").classList.remove("hidden");

  $("profileName").textContent = user.name;
  $("profileEmail").textContent = user.email;
  $("avatar").textContent = user.name.charAt(0).toUpperCase();
  $("welcomeName").textContent = user.name.split(" ")[0];

  $("todayDate").textContent = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  $("transactionDate").value = new Date().toLocaleDateString("en-CA");
  $("transactionDate").max = new Date().toLocaleDateString("en-CA");

  renderDashboard();
  showSection("overview");
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  transactions = [];

  if (financeChart) {
    financeChart.destroy();
    financeChart = null;
  }

  $("dashboard").classList.add("hidden");
  $("authPage").classList.remove("hidden");

  $("loginForm").classList.remove("hidden");
  $("registerForm").classList.add("hidden");

  $("login").reset();
  $("transactionModal").classList.add("hidden");

  showToast("You have logged out.");
}

$("logoutBtn").addEventListener("click", logout);
$("headerLogout").addEventListener("click", logout);

// ---------- NAVIGATION ----------
function showSection(section) {
  const overview = section === "overview";

  $("overviewSection").classList.toggle("hidden", !overview);
  $("transactionsSection").classList.toggle("hidden", overview);
  $("pageTitle").textContent = overview ? "Overview" : "Transactions";

  document.querySelectorAll(".nav-item[data-section]").forEach((button) => {
    button.classList.toggle("active", button.dataset.section === section);
  });

  if (!overview) renderAllTransactions();
  else renderChart();
}

document.querySelectorAll(".nav-item[data-section]").forEach((button) => {
  button.addEventListener("click", () => showSection(button.dataset.section));
});

$("viewAllBtn").addEventListener("click", () => showSection("transactions"));

// ---------- TRANSACTION MODAL ----------
function openModal() {
  $("transactionForm").reset();
  $("transactionDate").value = new Date().toLocaleDateString("en-CA");
  $("transactionDate").max = new Date().toLocaleDateString("en-CA");
  $("transactionType").value = "expense";
  $("transactionModal").classList.remove("hidden");
  $("transactionTitle").focus();
}

function closeModal() {
  $("transactionModal").classList.add("hidden");
}

$("addTopBtn").addEventListener("click", openModal);
$("addAllBtn").addEventListener("click", openModal);
$("closeModal").addEventListener("click", closeModal);

$("transactionModal").addEventListener("click", (event) => {
  if (event.target === $("transactionModal")) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

// ---------- ADD TRANSACTION ----------
$("transactionType").addEventListener("change", () => {
  const type = $("transactionType").value;
  const category = $("transactionCategory");

  if (type === "income" && category.value !== "Salary" &&
      category.value !== "Freelance" && category.value !== "Investment") {
    category.value = "Salary";
  }

  if (type === "expense" &&
      ["Salary", "Freelance", "Investment"].includes(category.value)) {
    category.value = "Food";
  }
});

$("transactionForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const title = $("transactionTitle").value.trim();
  const type = $("transactionType").value;
  const amount = Number($("transactionAmount").value);
  const category = $("transactionCategory").value;
  const date = $("transactionDate").value;
  const today = new Date().toLocaleDateString("en-CA");

  if (!title || title.length > 70) {
    showToast("Enter a valid transaction name.");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    showToast("Enter a valid amount.");
    return;
  }

  if (!date || date > today) {
    showToast("Choose a valid date that is not in the future.");
    return;
  }

  transactions.push({
    id: makeId(),
    title,
    type,
    amount: Math.round(amount * 100) / 100,
    category,
    date
  });

  saveTransactions();
  closeModal();
  renderDashboard();
  showToast("Transaction added successfully!");
});

// ---------- DELETE TRANSACTION ----------
function deleteTransaction(id) {
  const transaction = transactions.find((item) => item.id === id);
  if (!transaction) return;

  if (!confirm(`Delete "${transaction.title}"?`)) return;

  transactions = transactions.filter((item) => item.id !== id);
  saveTransactions();
  renderDashboard();
  showToast("Transaction deleted.");
}

// ---------- TRANSACTION TABLE ----------
const categoryIcons = {
  Food: "☕",
  Transport: "↗",
  Shopping: "◇",
  Bills: "▤",
  Health: "✚",
  Education: "▣",
  Salary: "₹",
  Freelance: "✧",
  Investment: "◈",
  Other: "•"
};

function transactionRow(transaction) {
  const income = transaction.type === "income";
  const safeId = escapeHTML(transaction.id);

  return `
    <tr>
      <td>
        <div class="transaction-name">
          <span class="transaction-symbol">
            ${categoryIcons[transaction.category] || "•"}
          </span>
          <span>${escapeHTML(transaction.title)}</span>
        </div>
      </td>
      <td>${escapeHTML(transaction.category)}</td>
      <td>${formatDate(transaction.date)}</td>
      <td><span class="type-badge ${income ? "type-income" : "type-expense"}">
        ${income ? "Income" : "Expense"}
      </span></td>
      <td class="right ${income ? "amount-income" : "amount-expense"}">
        ${income ? "+" : "−"}${formatMoney(transaction.amount)}
      </td>
      <td><button class="delete-btn" data-delete="${safeId}" title="Delete transaction" aria-label="Delete transaction">×</button></td>
    </tr>`;
}

function attachDeleteButtons(container) {
  container.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.delete));
  });
}

function renderRecentTransactions() {
  const sorted = [...transactions].sort((a, b) =>
    b.date.localeCompare(a.date)
  ).slice(0, 5);

  $("recentTable").innerHTML = sorted.map(transactionRow).join("");
  $("recentEmpty").classList.toggle("hidden", sorted.length > 0);
  $("recentTable").closest("table").classList.toggle("hidden", sorted.length === 0);

  attachDeleteButtons($("recentTable"));
}

function renderAllTransactions() {
  const search = $("searchTransaction").value.trim().toLowerCase();
  const type = $("typeFilter").value;

  const filtered = [...transactions]
    .filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search);

      return matchesSearch && (type === "all" || item.type === type);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  $("allTable").innerHTML = filtered.map(transactionRow).join("");
  $("allEmpty").classList.toggle("hidden", filtered.length > 0);
  $("allTable").closest("table").classList.toggle("hidden", filtered.length === 0);

  attachDeleteButtons($("allTable"));
}

$("searchTransaction").addEventListener("input", renderAllTransactions);
$("typeFilter").addEventListener("change", renderAllTransactions);

// ---------- CALCULATIONS ----------
function getTotals() {
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expense = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  return { income, expense, balance: income - expense };
}

function renderInsights(totals) {
  const rate = totals.income > 0
    ? ((totals.income - totals.expense) / totals.income) * 100
    : 0;

  $("savingsRate").textContent = `${rate.toFixed(1)}%`;
  $("transactionCount").textContent = transactions.length;

  const categories = {};

  transactions.filter((item) => item.type === "expense").forEach((item) => {
    categories[item.category] = (categories[item.category] || 0) + item.amount;
  });

  const top = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  $("topCategory").textContent = top ? top[0] : "None yet";
}

// ---------- CHART ----------
function renderChart() {
  const canvas = $("financeChart");
  if (!canvas || !window.Chart) return;

  if (financeChart) {
    financeChart.destroy();
    financeChart = null;
  }

  const totals = getTotals();
  const dark = document.body.classList.contains("dark");
  const gridColor = dark ? "#303343" : "#eaebf1";
  const textColor = dark ? "#a5a9bb" : "#85899b";

  financeChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Income", "Expenses", "Balance"],
      datasets: [{
        label: "Amount (₹)",
        data: [totals.income, totals.expense, totals.balance],
        backgroundColor: ["#26b985", "#ed7080", "#8172f1"],
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 65
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatMoney(context.raw)
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: (value) => "₹" + Number(value).toLocaleString("en-IN")
          },
          border: { display: false }
        }
      }
    }
  });
}

// ---------- RENDER DASHBOARD ----------
function renderDashboard() {
  const totals = getTotals();

  $("totalBalance").textContent = formatMoney(totals.balance);
  $("totalIncome").textContent = formatMoney(totals.income);
  $("totalExpense").textContent = formatMoney(totals.expense);

  renderInsights(totals);
  renderRecentTransactions();
  renderAllTransactions();
  renderChart();
}

// ---------- RESTORE SESSION ----------
(function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");

    if (!session || !session.email) return;

    const user = getUsers().find(
      (item) => item.email === session.email && item.id === session.id
    );

    if (user) {
      startSession(user);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
})();
