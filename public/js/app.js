// UI Elements
const authButtons = document.getElementById('authButtons');
const userInfo = document.getElementById('userInfo');
const userGreeting = document.getElementById('userGreeting');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const taskSection = document.getElementById('taskSection');
const taskList = document.getElementById('taskList');
const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));

let currentUser = null;
let currentTask = null;

// Dashboard Charts
let priorityChart = null;
let statusChart = null;

// Check authentication status on load
async function checkAuth() {
    try {
        if (authToken) {
            const user = await auth.getCurrentUser();
            handleAuthSuccess(user);
        }
    } catch (error) {
        handleAuthError();
    }
}

// Auth UI handlers
function showLoginForm() {
    loginForm.classList.remove('d-none');
    registerForm.classList.add('d-none');
}

function showRegisterForm() {
    registerForm.classList.remove('d-none');
    loginForm.classList.add('d-none');
}

async function login(event) {
    event.preventDefault();
    try {
        const data = await auth.login({
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value
        });
        handleAuthSuccess(data.user);
        event.target.reset();
    } catch (error) {
        alert(error.message);
    }
}

async function register(event) {
    event.preventDefault();
    try {
        const data = await auth.register({
            username: document.getElementById('registerUsername').value,
            email: document.getElementById('registerEmail').value,
            password: document.getElementById('registerPassword').value,
            firstName: document.getElementById('registerFirstName').value,
            lastName: document.getElementById('registerLastName').value
        });
        handleAuthSuccess(data.user);
        event.target.reset();
    } catch (error) {
        alert(error.message);
    }
}

async function logout() {
    try {
        await auth.logout();
        handleAuthError();
    } catch (error) {
        alert(error.message);
    }
}

function handleAuthSuccess(user) {
    currentUser = user;
    authButtons.classList.add('d-none');
    userInfo.classList.remove('d-none');
    loginForm.classList.add('d-none');
    registerForm.classList.add('d-none');
    taskSection.classList.remove('d-none');
    userGreeting.textContent = `Welcome, ${user.firstName}!`;
    loadTasks();
}

function handleAuthError() {
    currentUser = null;
    authButtons.classList.remove('d-none');
    userInfo.classList.add('d-none');
    taskSection.classList.add('d-none');
    userGreeting.textContent = '';
}

// Task UI handlers
async function createTask(event) {
    event.preventDefault();
    try {
        const task = await tasks.create({
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            priority: document.getElementById('taskPriority').value,
            category: document.getElementById('taskCategory').value,
            dueDate: document.getElementById('taskDueDate').value
        });
        event.target.reset();
        loadTasks();
    } catch (error) {
        alert(error.message);
    }
}

async function loadTasks(filter = 'all') {
    try {
        const filters = {};
        if (filter !== 'all') {
            filters.status = filter;
        }
        const taskData = await tasks.getAll(filters);
        renderTasks(taskData);
        refreshDashboard();
    } catch (error) {
        alert(error.message);
    }
}

function renderTasks(taskData) {
    taskList.innerHTML = taskData.map(task => `
        <div class="list-group-item task-item priority-${task.priority} ${task.status === 'completed' ? 'completed' : ''}"
             onclick="openTaskModal('${task._id}')">
            <div class="d-flex justify-content-between align-items-center">
                <h5 class="mb-1 task-title">${task.title}</h5>
                <span class="task-category">${task.category || 'No category'}</span>
            </div>
            <p class="mb-1">${task.description || ''}</p>
            <div class="task-meta">
                <span class="me-3">
                    <i class="bi bi-flag-fill"></i> ${task.priority}
                </span>
                ${task.dueDate ? `
                    <span class="task-due ${new Date(task.dueDate) < new Date() ? 'overdue' : ''}">
                        <i class="bi bi-calendar"></i> 
                        ${new Date(task.dueDate).toLocaleDateString()}
                    </span>
                ` : ''}
            </div>
        </div>
    `).join('');
}

async function openTaskModal(taskId) {
    try {
        currentTask = await tasks.getById(taskId);
        document.getElementById('editTaskTitle').value = currentTask.title;
        document.getElementById('editTaskDescription').value = currentTask.description || '';
        document.getElementById('editTaskPriority').value = currentTask.priority;
        document.getElementById('editTaskCategory').value = currentTask.category || '';
        document.getElementById('editTaskStatus').value = currentTask.status;
        document.getElementById('editTaskDueDate').value = currentTask.dueDate ? 
            new Date(currentTask.dueDate).toISOString().slice(0, 16) : '';
        taskModal.show();
    } catch (error) {
        alert(error.message);
    }
}

async function updateTask() {
    try {
        await tasks.update(currentTask._id, {
            title: document.getElementById('editTaskTitle').value,
            description: document.getElementById('editTaskDescription').value,
            priority: document.getElementById('editTaskPriority').value,
            category: document.getElementById('editTaskCategory').value,
            status: document.getElementById('editTaskStatus').value,
            dueDate: document.getElementById('editTaskDueDate').value
        });
        taskModal.hide();
        loadTasks();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteTask() {
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            await tasks.delete(currentTask._id);
            taskModal.hide();
            loadTasks();
        } catch (error) {
            alert(error.message);
        }
    }
}

function filterTasks(status) {
    document.querySelectorAll('.btn-group .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    loadTasks(status);
}

// Dashboard Charts
async function refreshDashboard() {
    try {
        const allTasks = await tasks.getAll();
        
        // Update counts
        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter(task => task.status === 'completed').length;
        const dueTodayTasks = allTasks.filter(task => {
            if (!task.dueDate) return false;
            const dueDate = new Date(task.dueDate);
            const today = new Date();
            return dueDate.toDateString() === today.toDateString();
        }).length;
        
        document.getElementById('totalTasksCount').textContent = totalTasks;
        document.getElementById('completedTasksCount').textContent = completedTasks;
        document.getElementById('dueTodayCount').textContent = dueTodayTasks;
        document.getElementById('completionRate').textContent = 
            totalTasks ? Math.round((completedTasks / totalTasks) * 100) + '%' : '0%';

        // Update priority chart
        const priorityCounts = {
            low: allTasks.filter(task => task.priority === 'low').length,
            medium: allTasks.filter(task => task.priority === 'medium').length,
            high: allTasks.filter(task => task.priority === 'high').length
        };

        if (priorityChart) {
            priorityChart.destroy();
        }

        priorityChart = new Chart(document.getElementById('tasksByPriorityChart'), {
            type: 'pie',
            data: {
                labels: ['Low', 'Medium', 'High'],
                datasets: [{
                    data: [priorityCounts.low, priorityCounts.medium, priorityCounts.high],
                    backgroundColor: ['#28a745', '#ffc107', '#dc3545']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Tasks by Priority'
                    }
                }
            }
        });

        // Update status chart
        const statusCounts = {
            pending: allTasks.filter(task => task.status === 'pending').length,
            in_progress: allTasks.filter(task => task.status === 'in_progress').length,
            completed: allTasks.filter(task => task.status === 'completed').length
        };

        if (statusChart) {
            statusChart.destroy();
        }

        statusChart = new Chart(document.getElementById('tasksByStatusChart'), {
            type: 'pie',
            data: {
                labels: ['Pending', 'In Progress', 'Completed'],
                datasets: [{
                    data: [statusCounts.pending, statusCounts.in_progress, statusCounts.completed],
                    backgroundColor: ['#ffc107', '#17a2b8', '#28a745']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Tasks by Status'
                    }
                }
            }
        });
    } catch (error) {
        alert('Error updating dashboard: ' + error.message);
    }
}

// Initialize
checkAuth(); 