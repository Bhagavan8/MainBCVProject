import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, query, where, limit, orderBy, getDocs,getDoc,doc} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Initialize Firebase (using existing config)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Load Chart.js
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
document.head.appendChild(script);

class FooterDashboard {
    constructor() {
        this.initializeComponents();
        this.setupEventListeners();
        this.checkAuthState();
    }

    initializeComponents() {
        this.recentJobsList = document.getElementById('recentJobsList');
        this.todoInput = document.getElementById('todoInput');
        this.addTodoBtn = document.getElementById('addTodoBtn');
        this.todoList = document.getElementById('todoList');
        this.companiesChart = document.getElementById('companiesChart');
    }

    setupEventListeners() {
        this.addTodoBtn?.addEventListener('click', () => this.addTodo());
        this.todoInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });
    }

    checkAuthState() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                this.loadUserData();
            } else {
                this.handleNotLoggedIn();
            }
        });
    }

    async loadUserData() {
        try {
            await Promise.all([
                this.loadRecentJobs(),
                this.loadTodos(),
                this.loadTopCompanies()
            ]);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    async loadRecentJobs() {
        if (!this.recentJobsList) return;
        
        try {
            const userSkills = await this.getUserSkills();
            const jobsQuery = query(
                collection(db, 'jobs'),
                // where('skills', 'array-contains-any', userSkills),
                orderBy('createdAt', 'desc'),
                limit(3)
            );

            const jobsSnapshot = await getDocs(jobsQuery);
            this.recentJobsList.innerHTML = '';

            jobsSnapshot.forEach(doc => {
                const job = doc.data();
                const jobElement = document.createElement('div');
                jobElement.className = 'p-3 bg-gray-50 dark:bg-gray-600 rounded-lg';
                jobElement.innerHTML = `
                    <h4 class="font-medium text-gray-800 dark:text-white">${job.title}</h4>
                    <p class="text-sm text-gray-600 dark:text-gray-300">${job.company}</p>
                `;
                this.recentJobsList.appendChild(jobElement);
            });
        } catch (error) {
            console.error('Error loading recent jobs:', error);
            this.recentJobsList.innerHTML = '<p class="text-red-500">Error loading jobs</p>';
        }
    }

    async loadTodos() {
        if (!this.todoList) return;

        try {
            const todosQuery = query(
                collection(db, 'todos'),
                where('userId', '==', this.currentUser.uid),
                orderBy('createdAt', 'desc')
            );

            const todosSnapshot = await getDocs(todosQuery);
            this.todoList.innerHTML = '';

            todosSnapshot.forEach(doc => {
                const todo = doc.data();
                this.createTodoElement(todo, doc.id);
            });
        } catch (error) {
            console.error('Error loading todos:', error);
        }
    }

    async loadTopCompanies() {
        if (!this.companiesChart) return;

        try {
            const jobsQuery = query(
                collection(db, 'jobs'),
                orderBy('company'),
                limit(3)
            );

            const jobsSnapshot = await getDocs(jobsQuery);
            const companies = {};

            jobsSnapshot.forEach(doc => {
                const company = doc.data().company;
                companies[company] = (companies[company] || 0) + 1;
            });

            const topCompanies = Object.entries(companies)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3);

            this.renderPieChart(topCompanies);
        } catch (error) {
            console.error('Error loading top companies:', error);
        }
    }

    renderPieChart(companies) {
        const ctx = document.createElement('canvas');
        this.companiesChart.innerHTML = '';
        this.companiesChart.appendChild(ctx);

        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: companies.map(([name]) => name),
                datasets: [{
                    data: companies.map(([, count]) => count),
                    backgroundColor: ['#4F46E5', '#10B981', '#F59E0B']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: document.documentElement.classList.contains('dark') ? '#fff' : '#000'
                        }
                    }
                }
            }
        });
    }

    async getUserSkills() {
        try {
            const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
            return userDoc.data()?.skills || [];
        } catch (error) {
            console.error('Error getting user skills:', error);
            return [];
        }
    }

    handleNotLoggedIn() {
        const elements = [this.recentJobsList, this.todoList, this.companiesChart];
        elements.forEach(element => {
            if (element) {
                element.innerHTML = '<p class="text-center text-gray-500">Please log in to view this content</p>';
            }
        });
    }

    async addTodo() {
        if (!this.todoInput?.value.trim()) return;

        try {
            const todoRef = await addDoc(collection(db, 'todos'), {
                userId: this.currentUser.uid,
                text: this.todoInput.value.trim(),
                completed: false,
                createdAt: new Date()
            });

            this.createTodoElement({ 
                text: this.todoInput.value.trim(),
                completed: false 
            }, todoRef.id);
            
            this.todoInput.value = '';
        } catch (error) {
            console.error('Error adding todo:', error);
        }
    }

    createTodoElement(todo, todoId) {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-2';
        li.innerHTML = `
            <input type="checkbox" ${todo.completed ? 'checked' : ''} class="rounded">
            <span class="flex-1 ${todo.completed ? 'line-through text-gray-400' : ''}">${todo.text}</span>
            <button class="text-red-500 hover:text-red-600"><i class="fas fa-trash"></i></button>
        `;

        const checkbox = li.querySelector('input');
        checkbox?.addEventListener('change', () => this.toggleTodo(todoId, checkbox.checked));

        const deleteBtn = li.querySelector('button');
        deleteBtn?.addEventListener('click', () => this.deleteTodo(todoId, li));

        this.todoList?.insertBefore(li, this.todoList.firstChild);
    }

    async toggleTodo(todoId, completed) {
        try {
            await updateDoc(doc(db, 'todos', todoId), { completed });
        } catch (error) {
            console.error('Error updating todo:', error);
        }
    }

    async deleteTodo(todoId, element) {
        try {
            await deleteDoc(doc(db, 'todos', todoId));
            element.remove();
        } catch (error) {
            console.error('Error deleting todo:', error);
        }
    }
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FooterDashboard();
});