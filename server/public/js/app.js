(function () {
  const STORAGE_KEY = "netWorthTrackerState_v1";

  // ---------- STATE AND STORAGE ----------

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        accounts: [],
        incomes: [],
        expenses: [],
        debts: [],
        lastBalanceUpdateDate: new Date().toISOString().slice(0, 10)
      };
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse saved state", e);
      return {
        accounts: [],
        incomes: [],
        expenses: [],
        debts: [],
        lastBalanceUpdateDate: new Date().toISOString().slice(0, 10)
      };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function generateId(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 9);
  }

  let state = loadState();

  // ---------- BASIC HELPER FUNCTIONS ----------

  function fmtMoney(value) {
    return "$" + Number(value || 0).toFixed(2);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function parseISODate(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function withinMonthRange(item, monthStart, monthEnd) {
    const start = item.startDate ? parseISODate(item.startDate) : null;
    const end = item.endDate ? parseISODate(item.endDate) : null;

    if (start && start > monthEnd) return false;
    if (end && end < monthStart) return false;
    return true;
  }

  function addMonths(date, months) {
    const d = new Date(date.getTime());
    const targetMonth = d.getMonth() + months;
    d.setMonth(targetMonth);
    return d;
  }

  function formatDateShort(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "-";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function applyAccrualsIfNeeded() {
    state.lastBalanceUpdateDate = todayISO();
  }

  // ---------- NET WORTH AND CASH FLOW ----------

  function computeNetWorth() {
    const totalAccounts = state.accounts.reduce(
      (sum, acc) => sum + Number(acc.currentBalance || 0),
      0
    );
    const totalDebt = state.debts.reduce(
      (sum, d) => sum + Number(d.principal || 0),
      0
    );
    return { totalAccounts, totalDebt, netWorth: totalAccounts - totalDebt };
  }

  function roughMonthlyCashFlow() {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);

    let inflow = 0;
    let outflow = 0;

    // incomes
    state.incomes.forEach((inc) => {
      if (!withinMonthRange(inc, monthStart, monthEnd)) return;
      const amt = Number(inc.amount || 0);
      const freq = inc.frequency || "monthly";

      switch (freq) {
        case "once":
          if (inc.startDate) {
            const start = parseISODate(inc.startDate);
            if (start && start.getFullYear() === year && start.getMonth() === monthIndex) {
              inflow += amt;
            }
          } else {
            inflow += amt;
          }
          break;
        case "daily":
          inflow += amt * 30;
          break;
        case "weekly":
          inflow += amt * 4;
          break;
        case "monthly":
          inflow += amt;
          break;
        case "yearly":
          inflow += amt / 12;
          break;
      }
    });

    // expenses
    state.expenses.forEach((exp) => {
      if (!withinMonthRange(exp, monthStart, monthEnd)) return;
      const amt = Number(exp.amount || 0);
      const freq = exp.frequency || "monthly";

      switch (freq) {
        case "once":
          if (exp.startDate) {
            const start = parseISODate(exp.startDate);
            if (start && start.getFullYear() === year && start.getMonth() === monthIndex) {
              outflow += amt;
            }
          } else {
            outflow += amt;
          }
          break;
        case "daily":
          outflow += amt * 30;
          break;
        case "weekly":
          outflow += amt * 4;
          break;
        case "monthly":
          outflow += amt;
          break;
        case "yearly":
          outflow += amt / 12;
          break;
      }
    });

    return { inflow, outflow, net: inflow - outflow };
  }

  // ---------- DOM REFERENCES ----------

  const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
  const views = Array.from(document.querySelectorAll(".view"));
  const dashboardCards = Array.from(document.querySelectorAll("[data-view-target]"));

  const netWorthValueEl = document.getElementById("netWorthValue");
  const totalAccountsValueEl = document.getElementById("totalAccountsValue");
  const thisMonthExpensesEl = document.getElementById("thisMonthExpenses");
  const thisMonthIncomesEl = document.getElementById("thisMonthIncomes");
  const totalDebtEl = document.getElementById("totalDebt");
  const flowInflowsEl = document.getElementById("flowInflows");
  const flowOutflowsEl = document.getElementById("flowOutflows");
  const flowNetEl = document.getElementById("flowNet");

  // Accounts view
  const accountsTableBody = document.getElementById("accountsTableBody");
  const accountSortSelect = document.getElementById("accountSort");
  const accountTypeFilterSelect = document.getElementById("accountTypeFilter");
  const btnAddAccount = document.getElementById("btnAddAccount");

  // Account modal
  const accountModal = document.getElementById("accountModal");
  const accountModalTitle = document.getElementById("accountModalTitle");
  const accountForm = document.getElementById("accountForm");
  const accountIdInput = document.getElementById("accountId");
  const accountNameInput = document.getElementById("accountName");
  const accountTypeInput = document.getElementById("accountType");
  const accountBalanceInput = document.getElementById("accountBalance");
  const accountInterestRateInput = document.getElementById("accountInterestRate");
  const accountCompoundingInput = document.getElementById("accountCompounding");
  const btnCancelAccount = document.getElementById("btnCancelAccount");

  // Incomes view
  const incomesTableBody = document.getElementById("incomesTableBody");
  const incomeSortSelect = document.getElementById("incomeSort");
  const incomeFrequencyFilterSelect = document.getElementById("incomeFrequencyFilter");
  const btnAddIncome = document.getElementById("btnAddIncome");

  // Income modal
  const incomeModal = document.getElementById("incomeModal");
  const incomeModalTitle = document.getElementById("incomeModalTitle");
  const incomeForm = document.getElementById("incomeForm");
  const incomeIdInput = document.getElementById("incomeId");
  const incomeNameInput = document.getElementById("incomeName");
  const incomeAmountInput = document.getElementById("incomeAmount");
  const incomeFrequencyInput = document.getElementById("incomeFrequency");
  const incomeStartDateInput = document.getElementById("incomeStartDate");
  const incomeEndDateInput = document.getElementById("incomeEndDate");
  const incomeDestinationTypeInput = document.getElementById("incomeDestinationType");
  const incomeDestinationAccountSelect = document.getElementById("incomeDestinationAccount");
  const incomeAccountWrapper = document.getElementById("incomeAccountWrapper");
  const btnCancelIncome = document.getElementById("btnCancelIncome");

  // Expenses view
  const expensesTableBody = document.getElementById("expensesTableBody");
  const expenseSortSelect = document.getElementById("expenseSort");
  const expenseFrequencyFilterSelect = document.getElementById("expenseFrequencyFilter");
  const btnAddExpense = document.getElementById("btnAddExpense");

  // Expense modal
  const expenseModal = document.getElementById("expenseModal");
  const expenseModalTitle = document.getElementById("expenseModalTitle");
  const expenseForm = document.getElementById("expenseForm");
  const expenseIdInput = document.getElementById("expenseId");
  const expenseNameInput = document.getElementById("expenseName");
  const expenseAmountInput = document.getElementById("expenseAmount");
  const expenseFrequencyInput = document.getElementById("expenseFrequency");
  const expenseStartDateInput = document.getElementById("expenseStartDate");
  const expenseEndDateInput = document.getElementById("expenseEndDate");
  const expensePaidFromTypeInput = document.getElementById("expensePaidFromType");
  const expensePaidFromAccountSelect = document.getElementById("expensePaidFromAccount");
  const expenseAccountWrapper = document.getElementById("expenseAccountWrapper");
  const expenseCategoryInput = document.getElementById("expenseCategory");
  const btnCancelExpense = document.getElementById("btnCancelExpense");

  // Debts view
  const debtsTableBody = document.getElementById("debtsTableBody");
  const debtSortSelect = document.getElementById("debtSort");
  const debtTypeFilterSelect = document.getElementById("debtTypeFilter");
  const btnAddDebt = document.getElementById("btnAddDebt");

  // Debt modal
  const debtModal = document.getElementById("debtModal");
  const debtModalTitle = document.getElementById("debtModalTitle");
  const debtForm = document.getElementById("debtForm");
  const debtIdInput = document.getElementById("debtId");
  const debtNameInput = document.getElementById("debtName");
  const debtPrincipalInput = document.getElementById("debtPrincipal");
  const debtInterestRateInput = document.getElementById("debtInterestRate");
  const debtTypeInput = document.getElementById("debtType");
  const debtCategoryInput = document.getElementById("debtCategory");
  const debtMinPaymentInput = document.getElementById("debtMinPayment");
  const btnCancelDebt = document.getElementById("btnCancelDebt");

  // Debt calculator
  const debtCalcDebtSelect = document.getElementById("debtCalcDebt");
  const debtCalcPaymentInput = document.getElementById("debtCalcPayment");
  const btnDebtCalcRun = document.getElementById("btnDebtCalcRun");
  const debtCalcMonthsEl = document.getElementById("debtCalcMonths");
  const debtCalcPayoffDateEl = document.getElementById("debtCalcPayoffDate");
  const debtCalcTotalPaidEl = document.getElementById("debtCalcTotalPaid");
  const debtCalcTotalInterestEl = document.getElementById("debtCalcTotalInterest");
  const debtCalcMessageEl = document.getElementById("debtCalcMessage");

  // Debt chart
  const debtChartModal = document.getElementById("debtChartModal");
  const debtChartTitle = document.getElementById("debtChartTitle");
  const debtChartPaymentInput = document.getElementById("debtChartPayment");
  const btnDebtChartUpdate = document.getElementById("btnDebtChartUpdate");
  const btnCloseDebtChart = document.getElementById("btnCloseDebtChart");
  const debtChartCanvas = document.getElementById("debtChartCanvas");

  let currentDebtForChart = null;
  let debtChartInstance = null;

  // Debt strategy helper
  const debtStrategySelect = document.getElementById("debtStrategy");
  const debtStrategyBudgetInput = document.getElementById("debtStrategyBudget");
  const btnDebtStrategyRun = document.getElementById("btnDebtStrategyRun");
  const debtStrategyTableBody = document.getElementById("debtStrategyTableBody");
  const debtStrategyMessageEl = document.getElementById("debtStrategyMessage");

  // ---------- NAVIGATION ----------

  function showView(id) {
    views.forEach((v) => {
      v.classList.toggle("active-view", v.id === id);
    });
    navButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === id);
    });

    if (id === "dashboard-view") {
      renderDashboard();
    } else if (id === "accounts-view") {
      renderAccountsTable();
    } else if (id === "incomes-view") {
      renderIncomesTable();
    } else if (id === "expenses-view") {
      renderExpensesTable();
    } else if (id === "debts-view") {
      renderDebtsTable();
      refreshDebtCalcOptions();
    }
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const viewId = btn.dataset.view;
      showView(viewId);
    });
  });

  dashboardCards.forEach((card) => {
    card.addEventListener("click", () => {
      const target = card.dataset.viewTarget;
      showView(target);
    });
  });

  // ---------- DASHBOARD RENDER ----------

  function renderDashboard() {
    applyAccrualsIfNeeded();
    const { totalAccounts, totalDebt, netWorth } = computeNetWorth();
    netWorthValueEl.textContent = fmtMoney(netWorth);
    totalAccountsValueEl.textContent = fmtMoney(totalAccounts);
    totalDebtEl.textContent = fmtMoney(totalDebt);

    const { inflow, outflow, net } = roughMonthlyCashFlow();
    thisMonthIncomesEl.textContent = fmtMoney(inflow);
    thisMonthExpensesEl.textContent = fmtMoney(outflow);
    flowInflowsEl.textContent = fmtMoney(inflow);
    flowOutflowsEl.textContent = fmtMoney(outflow);
    flowNetEl.textContent = fmtMoney(net);

    flowNetEl.classList.remove("flow-net-positive", "flow-net-negative", "flow-net-neutral");
    if (net > 0) {
      flowNetEl.classList.add("flow-net-positive");
    } else if (net < 0) {
      flowNetEl.classList.add("flow-net-negative");
    } else {
      flowNetEl.classList.add("flow-net-neutral");
    }
  }

  // ---------- ACCOUNT SELECT HELPER ----------

  function populateAccountSelect(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = "";

    if (state.accounts.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No accounts yet";
      selectEl.appendChild(opt);
      selectEl.disabled = true;
      return;
    }

    selectEl.disabled = false;
    state.accounts.forEach((acc) => {
      const opt = document.createElement("option");
      opt.value = acc.id;
      opt.textContent = `${acc.name} (${acc.type})`;
      selectEl.appendChild(opt);
    });
  }

  function refreshIncomeAccountOptions() {
    populateAccountSelect(incomeDestinationAccountSelect);
  }

  function refreshExpenseAccountOptions() {
    populateAccountSelect(expensePaidFromAccountSelect);
  }

  // ---------- ACCOUNTS CRUD ----------

  function openAccountModal(editId) {
    if (editId) {
      const acc = state.accounts.find((a) => a.id === editId);
      if (!acc) return;
      accountModalTitle.textContent = "Edit Account";
      accountIdInput.value = acc.id;
      accountNameInput.value = acc.name;
      accountTypeInput.value = acc.type;
      accountBalanceInput.value = acc.currentBalance;
      accountInterestRateInput.value = acc.interestRate * 100;
      accountCompoundingInput.value = acc.interestCompounding;
    } else {
      accountModalTitle.textContent = "New Account";
      accountIdInput.value = "";
      accountNameInput.value = "";
      accountTypeInput.value = "savings";
      accountBalanceInput.value = "";
      accountInterestRateInput.value = 0;
      accountCompoundingInput.value = "monthly";
    }
    accountModal.classList.remove("hidden");
  }

  function closeAccountModal() {
    accountModal.classList.add("hidden");
  }

  if (btnAddAccount) {
    btnAddAccount.addEventListener("click", () => openAccountModal());
  }

  if (btnCancelAccount) {
    btnCancelAccount.addEventListener("click", () => {
      closeAccountModal();
    });
  }

  if (accountModal) {
    accountModal.addEventListener("click", (e) => {
      if (e.target === accountModal || e.target.classList.contains("modal-backdrop")) {
        closeAccountModal();
      }
    });
  }

  if (accountForm) {
    accountForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const id = accountIdInput.value || generateId("acc");
      const name = accountNameInput.value.trim();
      const type = accountTypeInput.value;
      const balance = Number(accountBalanceInput.value || 0);
      const interestRatePercent = Number(accountInterestRateInput.value || 0);
      const interestRateDecimal = interestRatePercent / 100;
      const compounding = accountCompoundingInput.value;
      const now = todayISO();

      const existingIndex = state.accounts.findIndex((a) => a.id === id);
      if (existingIndex >= 0) {
        state.accounts[existingIndex] = {
          ...state.accounts[existingIndex],
          name,
          type,
          currentBalance: balance,
          interestRate: interestRateDecimal,
          interestCompounding: compounding,
          updatedAt: now
        };
      } else {
        state.accounts.push({
          id,
          name,
          type,
          currentBalance: balance,
          interestRate: interestRateDecimal,
          interestCompounding: compounding,
          createdAt: now,
          updatedAt: now
        });
      }

      saveState();
      closeAccountModal();
      renderAccountsTable();
      renderIncomesTable();
      renderExpensesTable();
      renderDashboard();
    });
  }

  function renderAccountsTable() {
    if (!accountsTableBody) return;

    const sortValue = accountSortSelect.value;
    const typeFilter = accountTypeFilterSelect.value;

    let rows = [...state.accounts];

    if (typeFilter !== "all") {
      rows = rows.filter((a) => a.type === typeFilter);
    }

    rows.sort((a, b) => {
      switch (sortValue) {
        case "createdAt_desc":
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        case "createdAt_asc":
          return (a.createdAt || "").localeCompare(b.createdAt || "");
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "balance_desc":
          return b.currentBalance - a.currentBalance;
        case "balance_asc":
          return a.currentBalance - b.currentBalance;
        default:
          return 0;
      }
    });

    accountsTableBody.innerHTML = "";
    rows.forEach((acc) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = acc.name;

      const tdType = document.createElement("td");
      tdType.textContent = acc.type.charAt(0).toUpperCase() + acc.type.slice(1);

      const tdBalance = document.createElement("td");
      tdBalance.textContent = fmtMoney(acc.currentBalance);

      const tdInterest = document.createElement("td");
      tdInterest.textContent = (acc.interestRate * 100).toFixed(2) + "%";

      const tdComp = document.createElement("td");
      tdComp.textContent = acc.interestRate > 0 ? acc.interestCompounding : "None";

      const tdActions = document.createElement("td");

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.className = "secondary-btn";
      editBtn.style.marginRight = "0.25rem";
      editBtn.addEventListener("click", () => openAccountModal(acc.id));

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "secondary-btn";
      delBtn.addEventListener("click", () => {
        if (confirm("Delete this account?")) {
          // Remove the account
          state.accounts = state.accounts.filter((a) => a.id !== acc.id);

          // Clear incomes pointing to this account
          state.incomes = state.incomes.map((inc) => {
            if (inc.destinationType === "account" && inc.destinationAccountId === acc.id) {
              return { ...inc, destinationType: "cash", destinationAccountId: null };
            }
            return inc;
          });

          // Clear expenses pointing to this account
          state.expenses = state.expenses.map((exp) => {
            if (exp.paidFromType === "account" && exp.paidFromAccountId === acc.id) {
              return { ...exp, paidFromType: "cash", paidFromAccountId: null };
            }
            return exp;
          });

          saveState();
          renderAccountsTable();
          renderIncomesTable();
          renderExpensesTable();
          renderDashboard();
        }
      });

      tdActions.appendChild(editBtn);
      tdActions.appendChild(delBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdType);
      tr.appendChild(tdBalance);
      tr.appendChild(tdInterest);
      tr.appendChild(tdComp);
      tr.appendChild(tdActions);

      accountsTableBody.appendChild(tr);
    });

    refreshIncomeAccountOptions();
    refreshExpenseAccountOptions();
  }

  if (accountSortSelect) {
    accountSortSelect.addEventListener("change", renderAccountsTable);
  }
  if (accountTypeFilterSelect) {
    accountTypeFilterSelect.addEventListener("change", renderAccountsTable);
  }

  // ---------- INCOMES CRUD ----------

  function updateIncomeDestinationVisibility() {
    if (!incomeDestinationTypeInput || !incomeAccountWrapper) return;
    if (incomeDestinationTypeInput.value === "account") {
      incomeAccountWrapper.style.display = "block";
    } else {
      incomeAccountWrapper.style.display = "none";
    }
  }

  function openIncomeModal(editId) {
    refreshIncomeAccountOptions();
    updateIncomeDestinationVisibility();

    if (editId) {
      const inc = state.incomes.find((i) => i.id === editId);
      if (!inc) return;
      incomeModalTitle.textContent = "Edit Income";
      incomeIdInput.value = inc.id;
      incomeNameInput.value = inc.name;
      incomeAmountInput.value = inc.amount;
      incomeFrequencyInput.value = inc.frequency || "monthly";
      incomeStartDateInput.value = inc.startDate || "";
      incomeEndDateInput.value = inc.endDate || "";
      incomeDestinationTypeInput.value = inc.destinationType || "account";
      refreshIncomeAccountOptions();
      if (inc.destinationType === "account" && inc.destinationAccountId) {
        incomeDestinationAccountSelect.value = inc.destinationAccountId;
      }
    } else {
      incomeModalTitle.textContent = "New Income";
      incomeIdInput.value = "";
      incomeNameInput.value = "";
      incomeAmountInput.value = "";
      incomeFrequencyInput.value = "monthly";
      incomeStartDateInput.value = "";
      incomeEndDateInput.value = "";
      incomeDestinationTypeInput.value = "account";
      refreshIncomeAccountOptions();
      if (state.accounts.length > 0 && incomeDestinationAccountSelect) {
        incomeDestinationAccountSelect.value = state.accounts[0].id;
      }
    }

    updateIncomeDestinationVisibility();
    incomeModal.classList.remove("hidden");
  }

  function closeIncomeModal() {
    incomeModal.classList.add("hidden");
  }

  if (btnAddIncome) {
    btnAddIncome.addEventListener("click", () => openIncomeModal());
  }

  if (btnCancelIncome) {
    btnCancelIncome.addEventListener("click", () => {
      closeIncomeModal();
    });
  }

  if (incomeModal) {
    incomeModal.addEventListener("click", (e) => {
      if (e.target === incomeModal || e.target.classList.contains("modal-backdrop")) {
        closeIncomeModal();
      }
    });
  }

  if (incomeDestinationTypeInput) {
    incomeDestinationTypeInput.addEventListener("change", () => {
      updateIncomeDestinationVisibility();
    });
  }

  if (incomeForm) {
    incomeForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const id = incomeIdInput.value || generateId("inc");
      const name = incomeNameInput.value.trim();
      const amount = Number(incomeAmountInput.value || 0);
      const frequency = incomeFrequencyInput.value;
      const startDate = incomeStartDateInput.value || null;
      const endDate = incomeEndDateInput.value || null;
      const destinationType = incomeDestinationTypeInput.value;
      const destinationAccountId =
        destinationType === "account" && incomeDestinationAccountSelect
          ? incomeDestinationAccountSelect.value || null
          : null;

      const now = todayISO();

      const existingIndex = state.incomes.findIndex((i) => i.id === id);
      const payload = {
        id,
        name,
        amount,
        frequency,
        startDate,
        endDate,
        destinationType,
        destinationAccountId,
        createdAt: existingIndex >= 0 ? state.incomes[existingIndex].createdAt : now,
        updatedAt: now
      };

      if (existingIndex >= 0) {
        state.incomes[existingIndex] = payload;
      } else {
        state.incomes.push(payload);
      }

      saveState();
      closeIncomeModal();
      renderIncomesTable();
      renderDashboard();
    });
  }

  function renderIncomesTable() {
    if (!incomesTableBody) return;

    const sortValue = incomeSortSelect.value;
    const freqFilter = incomeFrequencyFilterSelect.value;

    let rows = [...state.incomes];

    if (freqFilter !== "all") {
      rows = rows.filter((i) => i.frequency === freqFilter);
    }

    rows.sort((a, b) => {
      switch (sortValue) {
        case "createdAt_desc":
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        case "createdAt_asc":
          return (a.createdAt || "").localeCompare(b.createdAt || "");
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "amount_desc":
          return b.amount - a.amount;
        case "amount_asc":
          return a.amount - b.amount;
        default:
          return 0;
      }
    });

    incomesTableBody.innerHTML = "";
    rows.forEach((inc) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = inc.name;

      const tdAmount = document.createElement("td");
      tdAmount.textContent = fmtMoney(inc.amount);

      const tdFreq = document.createElement("td");
      tdFreq.textContent = inc.frequency.charAt(0).toUpperCase() + inc.frequency.slice(1);

      const tdActive = document.createElement("td");
      const start = inc.startDate || "—";
      const end = inc.endDate || "∞";
      tdActive.textContent = `${start} → ${end}`;

      const tdDest = document.createElement("td");
      if (inc.destinationType === "cash") {
        tdDest.textContent = "Cash";
      } else if (inc.destinationType === "account" && inc.destinationAccountId) {
        const acc = state.accounts.find((a) => a.id === inc.destinationAccountId);
        tdDest.textContent = acc ? acc.name : "Account (deleted)";
      } else {
        tdDest.textContent = "Account";
      }

      const tdActions = document.createElement("td");
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.className = "secondary-btn";
      editBtn.style.marginRight = "0.25rem";
      editBtn.addEventListener("click", () => openIncomeModal(inc.id));

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "secondary-btn";
      delBtn.addEventListener("click", () => {
        if (confirm("Delete this income?")) {
          state.incomes = state.incomes.filter((i) => i.id !== inc.id);
          saveState();
          renderIncomesTable();
          renderDashboard();
        }
      });

      tdActions.appendChild(editBtn);
      tdActions.appendChild(delBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdAmount);
      tr.appendChild(tdFreq);
      tr.appendChild(tdActive);
      tr.appendChild(tdDest);
      tr.appendChild(tdActions);

      incomesTableBody.appendChild(tr);
    });
  }

  if (incomeSortSelect) {
    incomeSortSelect.addEventListener("change", renderIncomesTable);
  }
  if (incomeFrequencyFilterSelect) {
    incomeFrequencyFilterSelect.addEventListener("change", renderIncomesTable);
  }

  // ---------- EXPENSES CRUD ----------

  function updateExpensePaidFromVisibility() {
    if (!expensePaidFromTypeInput || !expenseAccountWrapper) return;
    if (expensePaidFromTypeInput.value === "account") {
      expenseAccountWrapper.style.display = "block";
    } else {
      expenseAccountWrapper.style.display = "none";
    }
  }

  function openExpenseModal(editId) {
    refreshExpenseAccountOptions();
    updateExpensePaidFromVisibility();

    if (editId) {
      const exp = state.expenses.find((e) => e.id === editId);
      if (!exp) return;
      expenseModalTitle.textContent = "Edit Expense";
      expenseIdInput.value = exp.id;
      expenseNameInput.value = exp.name;
      expenseAmountInput.value = exp.amount;
      expenseFrequencyInput.value = exp.frequency || "monthly";
      expenseStartDateInput.value = exp.startDate || "";
      expenseEndDateInput.value = exp.endDate || "";
      expensePaidFromTypeInput.value = exp.paidFromType || "account";
      refreshExpenseAccountOptions();
      if (exp.paidFromType === "account" && exp.paidFromAccountId) {
        expensePaidFromAccountSelect.value = exp.paidFromAccountId;
      }
      expenseCategoryInput.value = exp.category || "";
    } else {
      expenseModalTitle.textContent = "New Expense";
      expenseIdInput.value = "";
      expenseNameInput.value = "";
      expenseAmountInput.value = "";
      expenseFrequencyInput.value = "monthly";
      expenseStartDateInput.value = "";
      expenseEndDateInput.value = "";
      expensePaidFromTypeInput.value = "account";
      refreshExpenseAccountOptions();
      if (state.accounts.length > 0 && expensePaidFromAccountSelect) {
        expensePaidFromAccountSelect.value = state.accounts[0].id;
      }
      expenseCategoryInput.value = "";
    }

    updateExpensePaidFromVisibility();
    expenseModal.classList.remove("hidden");
  }

  function closeExpenseModal() {
    expenseModal.classList.add("hidden");
  }

  if (btnAddExpense) {
    btnAddExpense.addEventListener("click", () => openExpenseModal());
  }

  if (btnCancelExpense) {
    btnCancelExpense.addEventListener("click", () => {
      closeExpenseModal();
    });
  }

  if (expenseModal) {
    expenseModal.addEventListener("click", (e) => {
      if (e.target === expenseModal || e.target.classList.contains("modal-backdrop")) {
        closeExpenseModal();
      }
    });
  }

  if (expensePaidFromTypeInput) {
    expensePaidFromTypeInput.addEventListener("change", () => {
      updateExpensePaidFromVisibility();
    });
  }

  if (expenseForm) {
    expenseForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const id = expenseIdInput.value || generateId("exp");
      const name = expenseNameInput.value.trim();
      const amount = Number(expenseAmountInput.value || 0);
      const frequency = expenseFrequencyInput.value;
      const startDate = expenseStartDateInput.value || null;
      const endDate = expenseEndDateInput.value || null;
      const paidFromType = expensePaidFromTypeInput.value;
      const paidFromAccountId =
        paidFromType === "account" && expensePaidFromAccountSelect
          ? expensePaidFromAccountSelect.value || null
          : null;
      const category = expenseCategoryInput.value.trim() || null;

      const now = todayISO();

      const existingIndex = state.expenses.findIndex((e2) => e2.id === id);
      const payload = {
        id,
        name,
        amount,
        frequency,
        startDate,
        endDate,
        paidFromType,
        paidFromAccountId,
        category,
        createdAt: existingIndex >= 0 ? state.expenses[existingIndex].createdAt : now,
        updatedAt: now
      };

      if (existingIndex >= 0) {
        state.expenses[existingIndex] = payload;
      } else {
        state.expenses.push(payload);
      }

      saveState();
      closeExpenseModal();
      renderExpensesTable();
      renderDashboard();
    });
  }

  function renderExpensesTable() {
    if (!expensesTableBody) return;

    const sortValue = expenseSortSelect.value;
    const freqFilter = expenseFrequencyFilterSelect.value;

    let rows = [...state.expenses];

    if (freqFilter !== "all") {
      rows = rows.filter((e) => e.frequency === freqFilter);
    }

    rows.sort((a, b) => {
      switch (sortValue) {
        case "createdAt_desc":
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        case "createdAt_asc":
          return (a.createdAt || "").localeCompare(b.createdAt || "");
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "amount_desc":
          return b.amount - a.amount;
        case "amount_asc":
          return a.amount - b.amount;
        default:
          return 0;
      }
    });

    expensesTableBody.innerHTML = "";
    rows.forEach((exp) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = exp.name;

      const tdAmount = document.createElement("td");
      tdAmount.textContent = fmtMoney(exp.amount);

      const tdFreq = document.createElement("td");
      tdFreq.textContent = exp.frequency.charAt(0).toUpperCase() + exp.frequency.slice(1);

      const tdActive = document.createElement("td");
      const start = exp.startDate || "—";
      const end = exp.endDate || "∞";
      tdActive.textContent = `${start} → ${end}`;

      const tdPaidFrom = document.createElement("td");
      if (exp.paidFromType === "cash") {
        tdPaidFrom.textContent = "Cash";
      } else if (exp.paidFromType === "account" && exp.paidFromAccountId) {
        const acc = state.accounts.find((a) => a.id === exp.paidFromAccountId);
        tdPaidFrom.textContent = acc ? acc.name : "Account (deleted)";
      } else {
        tdPaidFrom.textContent = "Account";
      }

      const tdCategory = document.createElement("td");
      tdCategory.textContent = exp.category || "—";

      const tdActions = document.createElement("td");
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.className = "secondary-btn";
      editBtn.style.marginRight = "0.25rem";
      editBtn.addEventListener("click", () => openExpenseModal(exp.id));

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "secondary-btn";
      delBtn.addEventListener("click", () => {
        if (confirm("Delete this expense?")) {
          state.expenses = state.expenses.filter((e2) => e2.id !== exp.id);
          saveState();
          renderExpensesTable();
          renderDashboard();
        }
      });

      tdActions.appendChild(editBtn);
      tdActions.appendChild(delBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdAmount);
      tr.appendChild(tdFreq);
      tr.appendChild(tdActive);
      tr.appendChild(tdPaidFrom);
      tr.appendChild(tdCategory);
      tr.appendChild(tdActions);

      expensesTableBody.appendChild(tr);
    });
  }

  if (expenseSortSelect) {
    expenseSortSelect.addEventListener("change", renderExpensesTable);
  }
  if (expenseFrequencyFilterSelect) {
    expenseFrequencyFilterSelect.addEventListener("change", renderExpensesTable);
  }

  // ---------- DEBTS CRUD ----------

  function refreshDebtCalcOptions() {
    if (!debtCalcDebtSelect) return;
    debtCalcDebtSelect.innerHTML = "";

    if (!state.debts.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No debts yet";
      debtCalcDebtSelect.appendChild(opt);
      debtCalcDebtSelect.disabled = true;
      return;
    }

    debtCalcDebtSelect.disabled = false;
    state.debts.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${d.name} (${fmtMoney(d.principal)})`;
      debtCalcDebtSelect.appendChild(opt);
    });
  }

  function openDebtModal(editId) {
    if (editId) {
      const d = state.debts.find((x) => x.id === editId);
      if (!d) return;
      debtModalTitle.textContent = "Edit Debt";
      debtIdInput.value = d.id;
      debtNameInput.value = d.name;
      debtPrincipalInput.value = d.principal;
      debtInterestRateInput.value = (d.interestRate || 0) * 100;
      debtTypeInput.value = d.type || "long_term";
      debtCategoryInput.value = d.category || "other";
      debtMinPaymentInput.value = d.minPaymentMonthly || "";
    } else {
      debtModalTitle.textContent = "New Debt";
      debtIdInput.value = "";
      debtNameInput.value = "";
      debtPrincipalInput.value = "";
      debtInterestRateInput.value = 0;
      debtTypeInput.value = "long_term";
      debtCategoryInput.value = "other";
      debtMinPaymentInput.value = "";
    }

    debtModal.classList.remove("hidden");
  }

  function closeDebtModal() {
    debtModal.classList.add("hidden");
  }

  if (btnAddDebt) {
    btnAddDebt.addEventListener("click", () => openDebtModal());
  }

  if (btnCancelDebt) {
    btnCancelDebt.addEventListener("click", () => {
      closeDebtModal();
    });
  }

  if (debtModal) {
    debtModal.addEventListener("click", (e) => {
      if (e.target === debtModal || e.target.classList.contains("modal-backdrop")) {
        closeDebtModal();
      }
    });
  }

  if (debtForm) {
    debtForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const id = debtIdInput.value || generateId("debt");
      const name = debtNameInput.value.trim();
      const principal = Number(debtPrincipalInput.value || 0);
      const interestRatePercent = Number(debtInterestRateInput.value || 0);
      const interestRateDecimal = interestRatePercent / 100;
      const type = debtTypeInput.value;
      const category = debtCategoryInput.value || "other";
      const minPaymentMonthly = Number(debtMinPaymentInput.value || 0);

      const now = todayISO();
      const existingIndex = state.debts.findIndex((d) => d.id === id);
      const payload = {
        id,
        name,
        principal,
        interestRate: interestRateDecimal,
        type,
        category,
        minPaymentMonthly,
        createdAt: existingIndex >= 0 ? state.debts[existingIndex].createdAt : now,
        updatedAt: now
      };

      if (existingIndex >= 0) {
        state.debts[existingIndex] = payload;
      } else {
        state.debts.push(payload);
      }

      saveState();
      closeDebtModal();
      renderDebtsTable();
      refreshDebtCalcOptions();
      renderDashboard();
    });
  }

  function renderDebtsTable() {
    if (!debtsTableBody) return;

    const sortValue = debtSortSelect.value;
    const typeFilter = debtTypeFilterSelect.value;

    let rows = [...state.debts];

    if (typeFilter !== "all") {
      rows = rows.filter((d) => d.type === typeFilter);
    }

    rows.sort((a, b) => {
      switch (sortValue) {
        case "createdAt_desc":
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        case "createdAt_asc":
          return (a.createdAt || "").localeCompare(b.createdAt || "");
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "balance_desc":
          return b.principal - a.principal;
        case "balance_asc":
          return a.principal - b.principal;
        default:
          return 0;
      }
    });

    debtsTableBody.innerHTML = "";
    rows.forEach((d) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = d.name;

      const tdBalance = document.createElement("td");
      tdBalance.textContent = fmtMoney(d.principal);

      const tdAPR = document.createElement("td");
      tdAPR.textContent = ((d.interestRate || 0) * 100).toFixed(2) + "%";

      const tdType = document.createElement("td");
      tdType.textContent = d.type === "long_term" ? "Long term" : "Short term";

      const tdCategory = document.createElement("td");
      const friendlyCat = {
        mortgage: "Mortgage",
        car_loan: "Car loan",
        student_loan: "Student loan",
        personal_loan: "Personal loan",
        credit_card: "Credit card",
        pay_later: "Pay later",
        other: "Other"
      }[d.category || "other"];
      tdCategory.textContent = friendlyCat;

      const tdMinPay = document.createElement("td");
      tdMinPay.textContent = d.minPaymentMonthly ? fmtMoney(d.minPaymentMonthly) : "—";

      const tdActions = document.createElement("td");

      const chartBtn = document.createElement("button");
      chartBtn.textContent = "Chart";
      chartBtn.className = "secondary-btn";
      chartBtn.style.marginRight = "0.25rem";
      chartBtn.addEventListener("click", () => openDebtChartModal(d));

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.className = "secondary-btn";
      editBtn.style.marginRight = "0.25rem";
      editBtn.addEventListener("click", () => openDebtModal(d.id));

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.className = "secondary-btn";
      delBtn.addEventListener("click", () => {
        if (confirm("Delete this debt?")) {
          state.debts = state.debts.filter((x) => x.id !== d.id);
          saveState();
          renderDebtsTable();
          refreshDebtCalcOptions();
          renderDashboard();
        }
      });

      tdActions.appendChild(chartBtn);
      tdActions.appendChild(editBtn);
      tdActions.appendChild(delBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdBalance);
      tr.appendChild(tdAPR);
      tr.appendChild(tdType);
      tr.appendChild(tdCategory);
      tr.appendChild(tdMinPay);
      tr.appendChild(tdActions);

      debtsTableBody.appendChild(tr);
    });
  }

  if (debtSortSelect) {
    debtSortSelect.addEventListener("change", renderDebtsTable);
  }
  if (debtTypeFilterSelect) {
    debtTypeFilterSelect.addEventListener("change", renderDebtsTable);
  }

  // ---------- DEBT PAYOFF CALCULATOR ----------

  function computeDebtPayoff(principal, annualRate, monthlyPayment) {
    principal = Number(principal || 0);
    annualRate = Number(annualRate || 0);
    monthlyPayment = Number(monthlyPayment || 0);

    if (principal <= 0 || monthlyPayment <= 0) {
      return { ok: false, message: "Principal and monthly payment must be greater than zero." };
    }

    if (annualRate === 0) {
      const monthsExact = principal / monthlyPayment;
      const months = Math.ceil(monthsExact);
      const totalPaid =
        monthlyPayment * (months - 1) + (principal - monthlyPayment * (months - 1));
      const totalInterest = totalPaid - principal;
      return {
        ok: true,
        months,
        totalPaid,
        totalInterest,
        message: ""
      };
    }

    const r = annualRate / 12;
    const interestPortion = r * principal;

    if (monthlyPayment <= interestPortion) {
      return {
        ok: false,
        message:
          "Monthly payment is too low. It does not even cover the interest. Increase the payment to pay this off."
      };
    }

    const numerator = monthlyPayment;
    const denominator = monthlyPayment - r * principal;

    if (denominator <= 0) {
      return {
        ok: false,
        message:
          "Payment is too low to ever pay off this debt. Increase your monthly payment."
      };
    }

    const n = Math.log(numerator / denominator) / Math.log(1 + r);

    if (!isFinite(n) || n <= 0) {
      return {
        ok: false,
        message:
          "Could not compute a valid payoff. Try adjusting the payment or interest rate."
      };
    }

    const months = Math.ceil(n);
    const totalPaid = monthlyPayment * months;
    const totalInterest = totalPaid - principal;

    return { ok: true, months, totalPaid, totalInterest, message: "" };
  }

  function runDebtCalculator() {
    if (!debtCalcDebtSelect || !debtCalcPaymentInput) return;
    const debtId = debtCalcDebtSelect.value;
    const payment = Number(debtCalcPaymentInput.value || 0);

    const debt = state.debts.find((d) => d.id === debtId);
    if (!debt) {
      debtCalcMessageEl.textContent = "Select a debt first.";
      return;
    }

    const result = computeDebtPayoff(debt.principal, debt.interestRate, payment);

    if (!result.ok) {
      debtCalcMonthsEl.textContent = "-";
      debtCalcPayoffDateEl.textContent = "-";
      debtCalcTotalPaidEl.textContent = "-";
      debtCalcTotalInterestEl.textContent = "-";
      debtCalcMessageEl.textContent = result.message;
      return;
    }

    const months = result.months;
    const payoffDate = addMonths(new Date(), months);
    debtCalcMonthsEl.textContent = String(months);
    debtCalcPayoffDateEl.textContent = formatDateShort(payoffDate);
    debtCalcTotalPaidEl.textContent = fmtMoney(result.totalPaid);
    debtCalcTotalInterestEl.textContent = fmtMoney(result.totalInterest);
    debtCalcMessageEl.textContent =
      "This is an approximate payoff timeline assuming a fixed payment and interest rate.";
  }

  if (btnDebtCalcRun) {
    btnDebtCalcRun.addEventListener("click", runDebtCalculator);
  }

  // ---------- DEBT STRATEGY (SNOWBALL / AVALANCHE) ----------

  function simulateDebtStrategy(strategy, monthlyBudget) {
    const budget = Number(monthlyBudget || 0);
    if (budget <= 0) {
      return { ok: false, message: "Enter a monthly budget greater than zero.", rows: [] };
    }

    if (!state.debts.length) {
      return { ok: false, message: "Add at least one debt first.", rows: [] };
    }

    let debts = state.debts.map((d) => ({ ...d }));

    if (strategy === "snowball") {
      debts.sort((a, b) => a.principal - b.principal);
    } else {
      debts.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
    }

    const rows = [];
    let cumulativeMonths = 0;
    const startDate = new Date();

    for (const d of debts) {
      if (d.principal <= 0) continue;

      const result = computeDebtPayoff(d.principal, d.interestRate || 0, budget);
      if (!result.ok) {
        return {
          ok: false,
          message: `For debt "${d.name}", ${result.message}`,
          rows: []
        };
      }

      cumulativeMonths += result.months;
      const payoffDate = addMonths(startDate, cumulativeMonths);

      rows.push({
        debt: d,
        months: result.months,
        payoffDate,
        paymentUsed: budget
      });
    }

    return {
      ok: true,
      message:
        "This assumes you focus this monthly debt budget on one debt at a time in the chosen order.",
      rows
    };
  }

  function runDebtStrategyHelper() {
    if (!debtStrategySelect || !debtStrategyBudgetInput) return;
    const strategy = debtStrategySelect.value || "snowball";
    const budget = Number(debtStrategyBudgetInput.value || 0);

    const result = simulateDebtStrategy(strategy, budget);

    debtStrategyTableBody.innerHTML = "";

    if (!result.ok) {
      debtStrategyMessageEl.textContent = result.message;
      return;
    }

    result.rows.forEach((row, index) => {
      const tr = document.createElement("tr");

      const tdOrder = document.createElement("td");
      tdOrder.textContent = index + 1;

      const tdName = document.createElement("td");
      tdName.textContent = row.debt.name;

      const tdBalance = document.createElement("td");
      tdBalance.textContent = fmtMoney(row.debt.principal);

      const tdAPR = document.createElement("td");
      tdAPR.textContent = ((row.debt.interestRate || 0) * 100).toFixed(2) + "%";

      const tdPayment = document.createElement("td");
      tdPayment.textContent = fmtMoney(row.paymentUsed);

      const tdMonths = document.createElement("td");
      tdMonths.textContent = String(row.months);

      const tdPayoffDate = document.createElement("td");
      tdPayoffDate.textContent = formatDateShort(row.payoffDate);

      tr.appendChild(tdOrder);
      tr.appendChild(tdName);
      tr.appendChild(tdBalance);
      tr.appendChild(tdAPR);
      tr.appendChild(tdPayment);
      tr.appendChild(tdMonths);
      tr.appendChild(tdPayoffDate);

      debtStrategyTableBody.appendChild(tr);
    });

    debtStrategyMessageEl.textContent = result.message;
  }

  if (btnDebtStrategyRun) {
    btnDebtStrategyRun.addEventListener("click", runDebtStrategyHelper);
  }

  // ---------- DEBT BALANCE CHART ----------

  function simulateDebtBalances(principal, annualRate, monthlyPayment, maxMonths = 600) {
    principal = Number(principal || 0);
    annualRate = Number(annualRate || 0);
    monthlyPayment = Number(monthlyPayment || 0);
    const r = annualRate / 12;

    const balances = [];
    const labels = [];
    let month = 0;
    let balance = principal;

    if (principal <= 0 || monthlyPayment <= 0) {
      return { labels: [], balances: [] };
    }

    while (balance > 0 && month < maxMonths) {
      labels.push("M" + month);
      balances.push(Number(balance.toFixed(2)));

      const interest = balance * r;
      let newBalance = balance + interest - monthlyPayment;
      if (newBalance < 0) newBalance = 0;

      balance = newBalance;
      month++;
    }

    labels.push("M" + month);
    balances.push(Number(balance.toFixed(2)));

    return { labels, balances };
  }

  function openDebtChartModal(debt) {
    currentDebtForChart = debt;
    if (!debt) return;

    debtChartTitle.textContent = `Debt balance over time – ${debt.name}`;

    const defaultPayment =
      debt.minPaymentMonthly && debt.minPaymentMonthly > 0
        ? debt.minPaymentMonthly
        : debt.principal * 0.03;

    debtChartPaymentInput.value = defaultPayment.toFixed(2);

    renderDebtChart();

    debtChartModal.classList.remove("hidden");
  }

  function closeDebtChartModal() {
    debtChartModal.classList.add("hidden");
    currentDebtForChart = null;
  }

  function renderDebtChart() {
    if (!currentDebtForChart || !debtChartCanvas) return;

    const payment = Number(debtChartPaymentInput.value || 0);
    const principal = currentDebtForChart.principal;
    const rate = currentDebtForChart.interestRate || 0;

    const series = simulateDebtBalances(principal, rate, payment);
    const ctx = debtChartCanvas.getContext("2d");

    if (debtChartInstance) {
      debtChartInstance.destroy();
    }

    debtChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [
          {
            label: "Balance",
            data: series.balances
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  if (btnDebtChartUpdate) {
    btnDebtChartUpdate.addEventListener("click", (e) => {
      e.preventDefault();
      renderDebtChart();
    });
  }

  if (btnCloseDebtChart) {
    btnCloseDebtChart.addEventListener("click", () => {
      closeDebtChartModal();
    });
  }

  if (debtChartModal) {
    debtChartModal.addEventListener("click", (e) => {
      if (e.target === debtChartModal || e.target.classList.contains("modal-backdrop")) {
        closeDebtChartModal();
      }
    });
  }

  // ---------- INITIAL RENDER ----------

  refreshIncomeAccountOptions();
  refreshExpenseAccountOptions();
  updateIncomeDestinationVisibility();
  updateExpensePaidFromVisibility();
  renderDashboard();
  renderAccountsTable();
  renderIncomesTable();
  renderExpensesTable();
  renderDebtsTable();
  refreshDebtCalcOptions();
})();
