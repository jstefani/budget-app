class BudgetTracker {
    constructor() {
        this.income = [];
        this.fixedExpenses = [];
        this.dailySpending = [];
        
        this.loadData();
        this.initializeEventListeners();
        this.updateDisplay();
        
        // Check if user needs onboarding
        if (this.needsOnboarding()) {
            this.showOnboarding();
        }
    }

    initializeEventListeners() {
        document.getElementById('incomeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addIncome();
        });

        document.getElementById('expensesForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addFixedExpense();
        });

        document.getElementById('spendingForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addDailySpending();
        });

        // Onboarding form listeners
        document.getElementById('onboardingIncomeForm').addEventListener('submit', (e) => {
            this.onboarding.handleIncomeSubmit(e);
        });

        document.getElementById('onboardingBankForm').addEventListener('submit', (e) => {
            this.onboarding.handleBankSubmit(e);
        });

        document.getElementById('onboardingAdditionalForm').addEventListener('submit', (e) => {
            this.onboarding.handleAdditionalSubmit(e);
        });
    }

    addIncome() {
        const day = parseInt(document.getElementById('incomeDay').value);
        const amount = parseFloat(document.getElementById('incomeAmount').value);
        
        if (day && amount > 0 && day >= 1 && day <= 31) {
            const incomeEntry = {
                id: Date.now(),
                day: day,
                amount: amount
            };
            
            this.income.push(incomeEntry);
            this.saveData();
            this.updateDisplay();
            this.clearForm('incomeForm');
        }
    }

    addFixedExpense() {
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const dayInput = document.getElementById('expenseDay').value;
        const day = dayInput ? parseInt(dayInput) : null;
        const description = document.getElementById('expenseDescription').value;
        
        if (amount > 0) {
            const expenseEntry = {
                id: Date.now(),
                amount: amount,
                day: day,
                description: description || 'Fixed Expense'
            };
            
            this.fixedExpenses.push(expenseEntry);
            this.saveData();
            this.updateDisplay();
            this.clearForm('expensesForm');
        }
    }

    addDailySpending() {
        const amount = parseFloat(document.getElementById('spendingAmount').value);
        const description = document.getElementById('spendingDescription').value;
        
        if (amount > 0) {
            const spendingEntry = {
                id: Date.now(),
                amount: amount,
                description: description || 'Daily Spending',
                day: new Date().getDate()
            };
            
            this.dailySpending.push(spendingEntry);
            this.saveData();
            this.updateDisplay();
            this.clearForm('spendingForm');
        }
    }

    deleteEntry(type, id) {
        switch(type) {
            case 'income':
                this.income = this.income.filter(entry => entry.id !== id);
                break;
            case 'expense':
                this.fixedExpenses = this.fixedExpenses.filter(entry => entry.id !== id);
                break;
            case 'spending':
                this.dailySpending = this.dailySpending.filter(entry => entry.id !== id);
                break;
        }
        this.saveData();
        this.updateDisplay();
    }

    calculateRemainingBudget() {
        const monthlyIncome = this.income
            .reduce((sum, entry) => sum + entry.amount, 0);
        
        const totalFixedExpenses = this.fixedExpenses
            .reduce((sum, entry) => sum + entry.amount, 0);
        
        const totalDailySpending = this.dailySpending
            .reduce((sum, entry) => sum + entry.amount, 0);
        
        return monthlyIncome - totalFixedExpenses - totalDailySpending;
    }

    updateDisplay() {
        this.updateRemainingBudget();
        this.displayIncome();
        this.displayFixedExpenses();
        this.displayDailySpending();
    }

    updateRemainingBudget() {
        const remaining = this.calculateRemainingBudget();
        const remainingElement = document.getElementById('remainingAmount');
        
        remainingElement.textContent = `$${remaining.toFixed(2)}`;
        
        if (remaining < 0) {
            remainingElement.className = 'amount negative';
        } else {
            remainingElement.className = 'amount';
        }
    }

    displayIncome() {
        const incomeList = document.getElementById('incomeList');
        incomeList.innerHTML = '';
        
        this.income.forEach(entry => {
            const entryElement = this.createEntryElement(
                entry, 
                'income',
                `$${entry.amount.toFixed(2)}`,
                `Day ${entry.day}`
            );
            incomeList.appendChild(entryElement);
        });
    }

    displayFixedExpenses() {
        const expensesList = document.getElementById('expensesList');
        expensesList.innerHTML = '';
        
        this.fixedExpenses.forEach(entry => {
            const entryElement = this.createEntryElement(
                entry,
                'expense',
                `$${entry.amount.toFixed(2)}`,
                entry.day ? `Due Day ${entry.day}` : 'No due date',
                entry.description
            );
            expensesList.appendChild(entryElement);
        });
    }

    displayDailySpending() {
        const spendingList = document.getElementById('spendingList');
        spendingList.innerHTML = '';
        
        const sortedSpending = this.dailySpending
            .sort((a, b) => b.day - a.day);
        
        sortedSpending.forEach(entry => {
            const entryElement = this.createEntryElement(
                entry,
                'spending',
                `$${entry.amount.toFixed(2)}`,
                `Day ${entry.day}`,
                entry.description
            );
            spendingList.appendChild(entryElement);
        });
    }

    createEntryElement(entry, type, amount, date, description = '') {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'entry-item';
        entryDiv.id = `entry-${entry.id}`;
        
        entryDiv.innerHTML = `
            <div class="details">
                <div class="amount">${amount}</div>
                <div class="date">${date}</div>
                ${description ? `<div class="description">${description}</div>` : ''}
            </div>
            <div class="entry-actions">
                <button class="edit-btn" onclick="budgetTracker.editEntry('${type}', ${entry.id})">Edit</button>
                <button class="delete-btn" onclick="budgetTracker.deleteEntry('${type}', ${entry.id})">Delete</button>
            </div>
        `;
        
        return entryDiv;
    }

    clearForm(formId) {
        document.getElementById(formId).reset();
    }

    saveData() {
        const data = {
            income: this.income,
            fixedExpenses: this.fixedExpenses,
            dailySpending: this.dailySpending
        };
        localStorage.setItem('budgetData', JSON.stringify(data));
    }

    loadData() {
        const savedData = localStorage.getItem('budgetData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.income = data.income || [];
            this.fixedExpenses = data.fixedExpenses || [];
            this.dailySpending = data.dailySpending || [];
        }
    }

    editEntry(type, id) {
        const entryElement = document.getElementById(`entry-${id}`);
        let entry;
        
        switch(type) {
            case 'income':
                entry = this.income.find(e => e.id === id);
                break;
            case 'expense':
                entry = this.fixedExpenses.find(e => e.id === id);
                break;
            case 'spending':
                entry = this.dailySpending.find(e => e.id === id);
                break;
        }
        
        if (!entry || !entryElement) return;
        
        this.createEditForm(entryElement, entry, type);
    }

    createEditForm(entryElement, entry, type) {
        let editHTML = '';
        
        switch(type) {
            case 'income':
                editHTML = `
                    <div class="edit-form">
                        <div class="edit-field">
                            <label>Day:</label>
                            <input type="number" id="edit-day-${entry.id}" value="${entry.day}" min="1" max="31">
                        </div>
                        <div class="edit-field">
                            <label>Amount:</label>
                            <input type="number" id="edit-amount-${entry.id}" value="${entry.amount}" step="0.01" min="0">
                        </div>
                        <div class="edit-actions">
                            <button class="save-btn" onclick="budgetTracker.saveEdit('${type}', ${entry.id})">Save</button>
                            <button class="cancel-btn" onclick="budgetTracker.cancelEdit(${entry.id})">Cancel</button>
                        </div>
                    </div>
                `;
                break;
                
            case 'expense':
                editHTML = `
                    <div class="edit-form">
                        <div class="edit-field">
                            <label>Amount:</label>
                            <input type="number" id="edit-amount-${entry.id}" value="${entry.amount}" step="0.01" min="0">
                        </div>
                        <div class="edit-field">
                            <label>Due Day:</label>
                            <input type="number" id="edit-day-${entry.id}" value="${entry.day || ''}" min="1" max="31" placeholder="Optional">
                        </div>
                        <div class="edit-field">
                            <label>Description:</label>
                            <input type="text" id="edit-description-${entry.id}" value="${entry.description || ''}" placeholder="e.g., Rent, Utilities">
                        </div>
                        <div class="edit-actions">
                            <button class="save-btn" onclick="budgetTracker.saveEdit('${type}', ${entry.id})">Save</button>
                            <button class="cancel-btn" onclick="budgetTracker.cancelEdit(${entry.id})">Cancel</button>
                        </div>
                    </div>
                `;
                break;
                
            case 'spending':
                editHTML = `
                    <div class="edit-form">
                        <div class="edit-field">
                            <label>Day:</label>
                            <input type="number" id="edit-day-${entry.id}" value="${entry.day}" min="1" max="31">
                        </div>
                        <div class="edit-field">
                            <label>Amount:</label>
                            <input type="number" id="edit-amount-${entry.id}" value="${entry.amount}" step="0.01" min="0">
                        </div>
                        <div class="edit-field">
                            <label>Description:</label>
                            <input type="text" id="edit-description-${entry.id}" value="${entry.description || ''}" placeholder="e.g., Coffee, Groceries">
                        </div>
                        <div class="edit-actions">
                            <button class="save-btn" onclick="budgetTracker.saveEdit('${type}', ${entry.id})">Save</button>
                            <button class="cancel-btn" onclick="budgetTracker.cancelEdit(${entry.id})">Cancel</button>
                        </div>
                    </div>
                `;
                break;
        }
        
        // Store original content
        entryElement.setAttribute('data-original-content', entryElement.innerHTML);
        entryElement.innerHTML = editHTML;
    }

    saveEdit(type, id) {
        const amount = parseFloat(document.getElementById(`edit-amount-${id}`).value);
        let day = null;
        const dayInput = document.getElementById(`edit-day-${id}`);
        if (dayInput && dayInput.value) {
            day = parseInt(dayInput.value);
        }
        
        let description = '';
        const descInput = document.getElementById(`edit-description-${id}`);
        if (descInput) {
            description = descInput.value;
        }
        
        if (amount <= 0 || (day && (day < 1 || day > 31))) {
            alert('Please enter valid values');
            return;
        }
        
        let entry;
        switch(type) {
            case 'income':
                entry = this.income.find(e => e.id === id);
                if (entry && day) {
                    entry.amount = amount;
                    entry.day = day;
                }
                break;
                
            case 'expense':
                entry = this.fixedExpenses.find(e => e.id === id);
                if (entry) {
                    entry.amount = amount;
                    entry.day = day;
                    entry.description = description || 'Fixed Expense';
                }
                break;
                
            case 'spending':
                entry = this.dailySpending.find(e => e.id === id);
                if (entry && day) {
                    entry.amount = amount;
                    entry.day = day;
                    entry.description = description || 'Daily Spending';
                }
                break;
        }
        
        this.saveData();
        this.updateDisplay();
    }

    cancelEdit(id) {
        const entryElement = document.getElementById(`entry-${id}`);
        const originalContent = entryElement.getAttribute('data-original-content');
        if (originalContent) {
            entryElement.innerHTML = originalContent;
        }
    }

    newMonth() {
        const spendingCount = this.dailySpending.length;
        let confirmMessage = "Are you sure you want to start a new month?";
        
        if (spendingCount > 0) {
            confirmMessage += `\n\nThis will clear all ${spendingCount} daily spending entries.`;
        }
        
        confirmMessage += "\n\nYour income and fixed expenses will remain intact.";
        
        if (confirm(confirmMessage)) {
            this.dailySpending = [];
            this.saveData();
            this.updateDisplay();
            alert("New month started! Daily spending has been cleared.");
        }
    }

    needsOnboarding() {
        return this.income.length === 0 && this.fixedExpenses.length === 0 && this.dailySpending.length === 0;
    }

    showOnboarding() {
        document.getElementById('onboardingModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    hideOnboarding() {
        document.getElementById('onboardingModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Onboarding functionality
const onboardingFlow = {
    currentStep: 'welcome',
    tempData: {},

    showStep(stepId) {
        // Hide all steps
        document.querySelectorAll('.onboarding-step').forEach(step => {
            step.classList.remove('active');
        });
        
        // Show current step
        document.getElementById(`onboarding-${stepId}`).classList.add('active');
        this.currentStep = stepId;
    },

    goToIncome() {
        this.showStep('income');
    },

    goToBankAccount() {
        this.showStep('bank');
    },

    goBack() {
        if (this.currentStep === 'income' || this.currentStep === 'bank') {
            this.showStep('welcome');
        } else if (this.currentStep === 'additional') {
            this.showStep('income');
        }
    },

    handleIncomeSubmit(e) {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('onboardingIncomeAmount').value);
        const name = document.getElementById('onboardingIncomeName').value || 'Main Income';
        const payDays = document.getElementById('onboardingPayDays').value;

        if (amount > 0) {
            // Parse pay days - handle formats like "15, 30", "1st and 15th", "30", etc.
            const parsedDays = this.parsePayDays(payDays);
            
            if (parsedDays.length === 0) {
                // No pay days specified, default to 1st
                parsedDays.push(1);
            }
            
            // Create separate income entries for each pay day
            if (parsedDays.length === 1) {
                // Single pay day - use full amount
                const incomeEntry = {
                    id: Date.now(),
                    day: parsedDays[0],
                    amount: amount
                };
                budgetTracker.income.push(incomeEntry);
            } else {
                // Multiple pay days - split amount evenly
                const amountPerPay = amount / parsedDays.length;
                parsedDays.forEach((day, index) => {
                    const incomeEntry = {
                        id: Date.now() + index,
                        day: day,
                        amount: amountPerPay
                    };
                    budgetTracker.income.push(incomeEntry);
                });
            }
            
            this.showStep('additional');
        }
    },

    parsePayDays(payDaysStr) {
        if (!payDaysStr || payDaysStr.trim() === '') {
            return [];
        }
        
        // Clean the string and extract numbers
        const days = [];
        const cleanStr = payDaysStr.toLowerCase().replace(/[^0-9,\s]/g, '');
        const numbers = cleanStr.split(/[,\s]+/).filter(n => n !== '');
        
        numbers.forEach(numStr => {
            const day = parseInt(numStr);
            if (day >= 1 && day <= 31) {
                days.push(day);
            }
        });
        
        // Remove duplicates and sort
        return [...new Set(days)].sort((a, b) => a - b);
    },

    handleBankSubmit(e) {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('onboardingBankAmount').value);

        if (amount > 0) {
            // Add as income for this month
            const incomeEntry = {
                id: Date.now(),
                day: 1,
                amount: amount,
                name: 'Starting Balance'
            };
            
            budgetTracker.income.push(incomeEntry);
            this.showStep('additional');
        }
    },

    addAdditionalIncome() {
        document.getElementById('additionalIncomeForm').style.display = 'block';
    },

    handleAdditionalSubmit(e) {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('onboardingAdditionalAmount').value);
        const name = document.getElementById('onboardingAdditionalName').value || 'Additional Income';
        const days = document.getElementById('onboardingAdditionalDays').value;

        if (amount > 0) {
            const incomeEntry = {
                id: Date.now(),
                day: 15, // Default to mid-month
                amount: amount,
                name: name,
                payDays: days
            };
            
            budgetTracker.income.push(incomeEntry);
            
            // Clear form
            e.target.reset();
            alert('Additional income added! You can add more or continue.');
        }
    },

    skipAdditional() {
        this.goToIncomeSummary();
    },

    goToIncomeSummary() {
        // Calculate total income
        const totalIncome = budgetTracker.income.reduce((sum, entry) => sum + entry.amount, 0);
        document.getElementById('totalIncomeAmount').textContent = `$${totalIncome.toFixed(2)}`;
        this.showStep('income-summary');
    },

    goToExpenses() {
        this.showStep('expenses');
    },

    finishExpenses() {
        // Collect all expense inputs and add them
        const expenseInputs = document.querySelectorAll('.expense-form input');
        expenseInputs.forEach(input => {
            const amount = parseFloat(input.value);
            const name = input.dataset.name;
            
            if (amount > 0 && name) {
                const expenseEntry = {
                    id: Date.now() + Math.random(), // Ensure unique IDs
                    amount: amount,
                    day: null,
                    description: name
                };
                budgetTracker.fixedExpenses.push(expenseEntry);
            }
        });
        
        this.showFinalSummary();
    },

    showFinalSummary() {
        const totalIncome = budgetTracker.income.reduce((sum, entry) => sum + entry.amount, 0);
        const totalExpenses = budgetTracker.fixedExpenses.reduce((sum, entry) => sum + entry.amount, 0);
        const leftover = totalIncome - totalExpenses;
        
        document.getElementById('finalIncomeAmount').textContent = `$${totalIncome.toFixed(2)}`;
        document.getElementById('finalExpensesAmount').textContent = `$${totalExpenses.toFixed(2)}`;
        document.getElementById('finalLeftoverAmount').textContent = `$${leftover.toFixed(2)}`;
        
        // Color the leftover amount
        const leftoverElement = document.getElementById('finalLeftoverAmount');
        if (leftover < 0) {
            leftoverElement.style.color = 'var(--danger)';
        } else {
            leftoverElement.style.color = 'var(--success)';
        }
        
        this.showStep('final-summary');
    },

    finishOnboarding() {
        budgetTracker.saveData();
        budgetTracker.updateDisplay();
        budgetTracker.hideOnboarding();
    }
};

// Add onboarding to budget tracker
BudgetTracker.prototype.onboarding = onboardingFlow;

const budgetTracker = new BudgetTracker();