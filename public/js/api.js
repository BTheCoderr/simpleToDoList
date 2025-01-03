const API_URL = 'http://localhost:4000/api';

// Store the auth token
let authToken = localStorage.getItem('authToken');

// API request helper
async function apiRequest(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Something went wrong');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Auth API
const auth = {
    async register(userData) {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        authToken = data.token;
        localStorage.setItem('authToken', authToken);
        return data;
    },

    async login(credentials) {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        authToken = data.token;
        localStorage.setItem('authToken', authToken);
        return data;
    },

    async getCurrentUser() {
        return await apiRequest('/auth/me');
    },

    async logout() {
        await apiRequest('/auth/logout', { method: 'POST' });
        authToken = null;
        localStorage.removeItem('authToken');
    }
};

// Tasks API
const tasks = {
    async create(taskData) {
        return await apiRequest('/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    },

    async getAll(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString();
        return await apiRequest(`/tasks${queryParams ? '?' + queryParams : ''}`);
    },

    async getById(taskId) {
        return await apiRequest(`/tasks/${taskId}`);
    },

    async update(taskId, taskData) {
        return await apiRequest(`/tasks/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify(taskData)
        });
    },

    async delete(taskId) {
        return await apiRequest(`/tasks/${taskId}`, {
            method: 'DELETE'
        });
    },

    async addComment(taskId, text) {
        return await apiRequest(`/tasks/${taskId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ text })
        });
    },

    async addSubtask(taskId, title) {
        return await apiRequest(`/tasks/${taskId}/subtasks`, {
            method: 'POST',
            body: JSON.stringify({ title })
        });
    }
};

// User API
const users = {
    async getProfile() {
        return await apiRequest('/users/profile');
    },

    async updateNotifications(preferences) {
        return await apiRequest('/users/notifications', {
            method: 'PATCH',
            body: JSON.stringify(preferences)
        });
    },

    async getStats() {
        return await apiRequest('/users/stats');
    },

    async requestWeeklySummary() {
        return await apiRequest('/users/weekly-summary', {
            method: 'POST'
        });
    }
}; 