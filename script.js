class BudgetTracker {
    constructor() {
        this.income = [];
        this.fixedExpenses = [];
        this.dailySpending = [];
        
        this.loadData();
        this.initializeEventListeners();
        this.updateDisplay();
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
    }

    addIncome() {
        const date = document.getElementById('incomeDate').value;
        const amount = parseFloat(document.getElementById('incomeAmount').value);
        
        if (date && amount > 0) {
            const incomeEntry = {
                id: Date.now(),
                date: date,
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
        const date = document.getElementById('expenseDate').value;
        const description = document.getElementById('expenseDescription').value;
        
        if (amount > 0) {
            const expenseEntry = {
                id: Date.now(),
                amount: amount,
                date: date || null,
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
                date: new Date().toISOString().split('T')[0]
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
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
        
        const monthlyIncome = this.income
            .filter(entry => entry.date.startsWith(currentMonth))
            .reduce((sum, entry) => sum + entry.amount, 0);
        
        const totalFixedExpenses = this.fixedExpenses
            .reduce((sum, entry) => sum + entry.amount, 0);
        
        const totalDailySpending = this.dailySpending
            .filter(entry => entry.date.startsWith(currentMonth))
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
                new Date(entry.date).toLocaleDateString()
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
                entry.date ? new Date(entry.date).toLocaleDateString() : 'No due date',
                entry.description
            );
            expensesList.appendChild(entryElement);
        });
    }

    displayDailySpending() {
        const spendingList = document.getElementById('spendingList');
        spendingList.innerHTML = '';
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentMonthSpending = this.dailySpending
            .filter(entry => entry.date.startsWith(currentMonth))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        currentMonthSpending.forEach(entry => {
            const entryElement = this.createEntryElement(
                entry,
                'spending',
                `$${entry.amount.toFixed(2)}`,
                new Date(entry.date).toLocaleDateString(),
                entry.description
            );
            spendingList.appendChild(entryElement);
        });
    }

    createEntryElement(entry, type, amount, date, description = '') {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'entry-item';
        
        entryDiv.innerHTML = `
            <div class="details">
                <div class="amount">${amount}</div>
                <div class="date">${date}</div>
                ${description ? `<div class="description">${description}</div>` : ''}
            </div>
            <button class="delete-btn" onclick="budgetTracker.deleteEntry('${type}', ${entry.id})">Delete</button>
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
}

const budgetTracker = new BudgetTracker();