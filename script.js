// Initialize Supabase
const supabaseUrl = 'https://aibtxogpttxdgmclaupg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpYnR4b2dwdHR4ZGdtY2xhdXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MDExNjcsImV4cCI6MjA3MjI3NzE2N30.SFUxC0MChiLaNBGEcgb-GSM7kWkvdLDgELywjBsAyxY';
const { createClient } = supabase;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

class BudgetTracker {
    constructor() {
        this.income = [];
        this.fixedExpenses = [];
        this.dailySpending = [];
        this.user = null;
        this.useCloud = false;
        this.currentMonth = this.getCurrentMonthKey();
        this.lastActiveMonth = null;
        
        this.initializeAuth();
    }

    getCurrentMonthKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    getMonthName(monthKey) {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    async initializeAuth() {
        // Check if user is already logged in
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (user) {
            this.user = user;
            this.useCloud = true;
            this.hideUpgradeButton();
            this.updateSyncStatus('synced', 'Synced');
            await this.loadCloudData();
        } else {
            // Check if they have local data
            this.loadLocalData();
            this.updateSyncStatus('offline', 'Local only');
            if (this.hasLocalData() && !this.hasSeenAuthModal()) {
                // Show auth modal to offer cloud sync for first time
                this.showAuthModal();
                this.markAuthModalSeen();
            } else if (!this.hasLocalData()) {
                // New user - show auth modal before onboarding
                this.showAuthModal();
            }
        }
        
        this.initializeEventListeners();
        this.updateDisplay();
        
        // Check for new month after loading data
        this.checkForNewMonth();
        
        // Check if user needs onboarding
        if (this.needsOnboarding()) {
            this.showOnboarding();
        }

        // Listen for auth changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                this.user = session.user;
                this.useCloud = true;
                this.hideAuthModal();
                this.hideUpgradeModal();
                this.hideUpgradeButton();
                this.updateSyncStatus('syncing', 'Syncing...');
                this.syncLocalToCloud().then(() => {
                    this.updateSyncStatus('synced', 'Synced');
                });
            } else if (event === 'SIGNED_OUT') {
                this.user = null;
                this.useCloud = false;
                this.updateSyncStatus('offline', 'Local only');
                this.showUpgradeButton();
            }
        });
    }

    hasLocalData() {
        return this.income.length > 0 || this.fixedExpenses.length > 0 || this.dailySpending.length > 0;
    }

    hasSeenAuthModal() {
        return localStorage.getItem('budgetTracker_seenAuthModal') === 'true';
    }

    markAuthModalSeen() {
        localStorage.setItem('budgetTracker_seenAuthModal', 'true');
    }

    showAuthModal() {
        document.getElementById('authModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    hideAuthModal() {
        document.getElementById('authModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    showUpgradeButton() {
        document.getElementById('upgradeAccountBtn').style.display = 'inline-flex';
    }

    hideUpgradeButton() {
        document.getElementById('upgradeAccountBtn').style.display = 'none';
    }

    showUpgradeModal() {
        document.getElementById('upgradeModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    hideUpgradeModal() {
        document.getElementById('upgradeModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    backToAuthFromUpgrade() {
        this.hideUpgradeModal();
        this.showAuthModal();
        this.auth.showWelcome();
    }

    async handleUpgrade(e) {
        e.preventDefault();
        
        const email = document.getElementById('upgradeEmail').value;
        const password = document.getElementById('upgradePassword').value;
        
        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password
            });
            
            if (error) {
                alert('Account creation failed: ' + error.message);
                return;
            }
            
            if (data.user && !data.user.email_confirmed_at) {
                alert('Please check your email and click the confirmation link to complete account creation. Your local data will be synced once confirmed.');
            }
            
            this.hideUpgradeModal();
            // Auth state change will handle the rest
        } catch (error) {
            alert('Account creation error: ' + error.message);
        }
    }

    showSyncStatus() {
        document.getElementById('syncStatus').style.display = 'flex';
    }

    hideSyncStatus() {
        document.getElementById('syncStatus').style.display = 'none';
    }

    updateSyncStatus(status, text) {
        const icon = document.getElementById('syncStatusIcon');
        const textElement = document.getElementById('syncStatusText');
        
        // Remove all status classes
        icon.classList.remove('syncing', 'synced', 'offline');
        
        // Add new status class
        if (status) {
            icon.classList.add(status);
        }
        
        // Update text
        if (text) {
            textElement.textContent = text;
        }
        
        // Show status if hidden
        this.showSyncStatus();
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

        // Authentication form listeners
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            this.auth.handleLogin(e);
        });

        document.getElementById('signupForm').addEventListener('submit', (e) => {
            this.auth.handleSignup(e);
        });

        // Upgrade form listener
        document.getElementById('upgradeForm').addEventListener('submit', (e) => {
            this.handleUpgrade(e);
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

        // Calculate and display days left and daily allowance
        const daysLeft = this.getDaysLeftInMonth();
        const dailyAllowance = daysLeft > 0 ? remaining / daysLeft : 0;
        
        document.getElementById('daysLeft').textContent = 
            daysLeft === 1 ? '1 day left in month' : `${daysLeft} days left in month`;
        
        const dailyAllowanceElement = document.getElementById('dailyAllowance');
        dailyAllowanceElement.textContent = `$${Math.max(0, dailyAllowance).toFixed(2)}`;
        
        // Color the daily allowance based on whether it's positive or negative budget
        if (remaining < 0) {
            dailyAllowanceElement.style.color = 'var(--danger)';
        } else {
            dailyAllowanceElement.style.color = 'var(--success)';
        }
    }

    getDaysLeftInMonth() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = now.getDate();
        
        // Get last day of current month
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        
        // Days left including today
        return lastDayOfMonth - today + 1;
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
        
        // Create item name from description and date
        const itemName = description || date;
        
        entryDiv.innerHTML = `
            <div class="entry-left">
                <div class="item-name">${itemName}</div>
                <div class="entry-actions">
                    <button class="edit-btn" onclick="budgetTracker.editEntry('${type}', ${entry.id})">Edit</button>
                    <button class="delete-btn" onclick="budgetTracker.deleteEntry('${type}', ${entry.id})">Delete</button>
                </div>
            </div>
            <div class="entry-right">
                <div class="amount">${amount}</div>
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

    // Data loading methods
    loadLocalData() {
        const savedData = localStorage.getItem('budgetData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.income = data.income || [];
            this.fixedExpenses = data.fixedExpenses || [];
            this.dailySpending = data.dailySpending || [];
            this.lastActiveMonth = data.lastActiveMonth || null;
        }
    }

    async loadCloudData() {
        try {
            const { data, error } = await supabaseClient
                .from('budget_data')
                .select('*')
                .eq('user_id', this.user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // Not found error is ok for new users
                console.error('Error loading cloud data:', error);
                this.loadLocalData(); // Fallback to local
                return;
            }

            if (data) {
                this.income = data.income || [];
                this.fixedExpenses = data.fixed_expenses || [];
                this.dailySpending = data.daily_spending || [];
                this.lastActiveMonth = data.last_active_month || null;
            }
        } catch (error) {
            console.error('Error loading cloud data:', error);
            this.loadLocalData(); // Fallback to local
        }
    }

    loadData() {
        if (this.useCloud) {
            // Cloud data is already loaded in initializeAuth
            return;
        } else {
            this.loadLocalData();
        }
    }

    async saveData() {
        if (this.useCloud && this.user) {
            await this.saveToCloud();
        } else {
            this.saveToLocal();
        }
    }

    saveToLocal() {
        const data = {
            income: this.income,
            fixedExpenses: this.fixedExpenses,
            dailySpending: this.dailySpending,
            lastActiveMonth: this.currentMonth
        };
        localStorage.setItem('budgetData', JSON.stringify(data));
    }

    async saveToCloud() {
        if (!this.user) return;
        
        this.updateSyncStatus('syncing', 'Saving...');
        
        try {
            const budgetData = {
                user_id: this.user.id,
                income: this.income,
                fixed_expenses: this.fixedExpenses,
                daily_spending: this.dailySpending,
                last_active_month: this.currentMonth,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('budget_data')
                .upsert(budgetData);

            if (error) {
                console.error('Error saving to cloud:', error);
                this.updateSyncStatus('offline', 'Save failed - using local');
                // Fallback to local save
                this.saveToLocal();
            } else {
                this.updateSyncStatus('synced', 'Synced');
            }
        } catch (error) {
            console.error('Error saving to cloud:', error);
            this.updateSyncStatus('offline', 'Save failed - using local');
            this.saveToLocal();
        }
    }

    async syncLocalToCloud() {
        if (!this.user || !this.hasLocalData()) return;
        
        // Save current local data to cloud
        await this.saveToCloud();
        
        // Clear local storage since we're now using cloud
        localStorage.removeItem('budgetData');
    }

    checkForNewMonth() {
        // Skip if no previous data or in onboarding
        if (!this.lastActiveMonth || this.needsOnboarding()) {
            this.lastActiveMonth = this.currentMonth;
            return;
        }

        // Check if we're in a new month
        if (this.lastActiveMonth !== this.currentMonth && this.hasSpendingData()) {
            this.showMonthArchivePrompt();
        } else {
            // Update to current month if no spending data
            this.lastActiveMonth = this.currentMonth;
        }
    }

    hasSpendingData() {
        return this.dailySpending.length > 0;
    }

    showMonthArchivePrompt() {
        const oldMonthName = this.getMonthName(this.lastActiveMonth);
        const newMonthName = this.getMonthName(this.currentMonth);
        
        // Calculate last month's summary
        const totalSpent = this.dailySpending.reduce((sum, entry) => sum + entry.amount, 0);
        const totalIncome = this.income.reduce((sum, entry) => sum + entry.amount, 0);
        const totalFixedExpenses = this.fixedExpenses.reduce((sum, entry) => sum + entry.amount, 0);
        const remaining = totalIncome - totalFixedExpenses - totalSpent;
        
        // Update modal content
        document.getElementById('oldMonthName').textContent = oldMonthName;
        document.getElementById('newMonthName').textContent = newMonthName;
        document.getElementById('lastMonthSpent').textContent = `$${totalSpent.toFixed(2)}`;
        document.getElementById('lastMonthRemaining').textContent = `$${remaining.toFixed(2)}`;
        
        // Color the remaining amount
        const remainingElement = document.getElementById('lastMonthRemaining');
        remainingElement.style.color = remaining >= 0 ? 'var(--success)' : 'var(--danger)';
        
        // Show modal
        document.getElementById('monthArchiveModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    archiveMonth() {
        // Clear daily spending for new month
        this.dailySpending = [];
        this.lastActiveMonth = this.currentMonth;
        
        // Save and update display
        this.saveData();
        this.updateDisplay();
        
        // Hide modal
        this.hideMonthArchiveModal();
        
        // Optional: Show success message
        // alert(`Started new month! Daily spending cleared for ${this.getMonthName(this.currentMonth)}.`);
    }

    continueCurrentMonth() {
        // Keep current data but update the last active month
        this.lastActiveMonth = this.currentMonth;
        this.saveData();
        this.hideMonthArchiveModal();
    }

    hideMonthArchiveModal() {
        document.getElementById('monthArchiveModal').style.display = 'none';
        document.body.style.overflow = 'auto';
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
        switch(this.currentStep) {
            case 'income':
            case 'bank':
                // Clear any income data if going back to welcome
                budgetTracker.income = [];
                this.showStep('welcome');
                break;
            case 'additional':
                this.showStep('income');
                break;
            case 'income-summary':
                this.showStep('additional');
                break;
            case 'expenses':
                this.showStep('income-summary');
                break;
            case 'final-summary':
                // Clear expense data if going back to edit expenses
                budgetTracker.fixedExpenses = [];
                this.clearExpenseInputs();
                this.showStep('expenses');
                break;
            default:
                this.showStep('welcome');
                break;
        }
    },

    clearExpenseInputs() {
        // Clear all expense form inputs when going back
        document.querySelectorAll('.expense-form input').forEach(input => {
            input.value = '';
        });
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
            // Each pay day gets the FULL amount (not split)
            parsedDays.forEach((day, index) => {
                const incomeEntry = {
                    id: Date.now() + index,
                    day: day,
                    amount: amount
                };
                budgetTracker.income.push(incomeEntry);
            });
            
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

// Authentication functionality
const authFlow = {
    showWelcome() {
        document.querySelectorAll('.auth-step').forEach(step => step.classList.remove('active'));
        document.getElementById('auth-welcome').classList.add('active');
    },

    showLogin() {
        document.querySelectorAll('.auth-step').forEach(step => step.classList.remove('active'));
        document.getElementById('auth-login').classList.add('active');
    },

    showSignup() {
        // Hide auth modal and show upgrade modal instead
        budgetTracker.hideAuthModal();
        budgetTracker.showUpgradeModal();
    },

    showLoading() {
        document.querySelectorAll('.auth-step').forEach(step => step.classList.remove('active'));
        document.getElementById('auth-loading').classList.add('active');
    },

    async handleLogin(e) {
        e.preventDefault();
        this.showLoading();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                alert('Login failed: ' + error.message);
                this.showLogin();
            }
            // Success is handled by auth state change listener
        } catch (error) {
            alert('Login error: ' + error.message);
            this.showLogin();
        }
    },

    async handleSignup(e) {
        e.preventDefault();
        this.showLoading();

        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password
            });

            if (error) {
                alert('Signup failed: ' + error.message);
                this.showSignup();
                return;
            }

            if (data.user && !data.user.email_confirmed_at) {
                alert('Please check your email and click the confirmation link to complete signup.');
                this.showLogin();
            }
            // Success is handled by auth state change listener
        } catch (error) {
            alert('Signup error: ' + error.message);
            this.showSignup();
        }
    },

    continueAsGuest() {
        budgetTracker.useCloud = false;
        budgetTracker.hideAuthModal();
        budgetTracker.updateSyncStatus('offline', 'Local only');
        // Show upgrade button since user is now in guest mode
        budgetTracker.showUpgradeButton();
    },

    continueOffline() {
        budgetTracker.hideAuthModal();
    }
};

// Add auth to budget tracker
BudgetTracker.prototype.auth = authFlow;

const budgetTracker = new BudgetTracker();