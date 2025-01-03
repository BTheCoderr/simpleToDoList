document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const taskInput = document.getElementById('taskInput')
    const taskDescription = document.getElementById('taskDescription')
    const taskDueDate = document.getElementById('taskDueDate')
    const taskPriority = document.getElementById('taskPriority')
    const taskCategory = document.getElementById('taskCategory')
    const taskTags = document.getElementById('taskTags')
    const addTaskButton = document.getElementById('addTaskButton')
    const taskList = document.getElementById('taskList')
    const clearCompletedButton = document.getElementById('clearCompletedButton')
    const filterPriority = document.getElementById('filterPriority')
    const filterCategory = document.getElementById('filterCategory')
    const searchInput = document.getElementById('searchInput')
    const darkModeToggle = document.getElementById('darkModeToggle')
    const sortTasks = document.getElementById('sortTasks')
    const undoButton = document.getElementById('undoButton')
    const redoButton = document.getElementById('redoButton')
    const exportButton = document.getElementById('exportButton')
    const importButton = document.getElementById('importButton')
    const importInput = document.getElementById('importInput')
    const modal = document.getElementById('taskDetailModal')
    const closeModal = document.querySelector('.close-modal')
    const showStatsButton = document.getElementById('showStatsButton')
    const statsDashboardModal = document.getElementById('statsDashboardModal')
    const statsCloseButton = statsDashboardModal.querySelector('.close-modal')
    const saveTemplateButton = document.getElementById('saveTemplateButton')
    const templateSelect = document.getElementById('templateSelect')
    const templateModal = document.getElementById('templateModal')
    const templateModalClose = templateModal.querySelector('.close-modal')
    const templateName = document.getElementById('templateName')
    const templatePreview = document.getElementById('templatePreview')
    const confirmSaveTemplate = document.getElementById('confirmSaveTemplate')
    const recurringType = document.getElementById('recurringType')
    const customRecurring = document.getElementById('customRecurring')
    const recurringInterval = document.getElementById('recurringInterval')
    const recurringUnit = document.getElementById('recurringUnit')
    const recurringEnd = document.getElementById('recurringEnd')
    const recurringCount = document.getElementById('recurringCount')
    const recurringEndDate = document.getElementById('recurringEndDate')

    // Statistics elements
    const totalTasksElement = document.getElementById('totalTasks')
    const completedTasksElement = document.getElementById('completedTasks')
    const pendingTasksElement = document.getElementById('pendingTasks')
    const dueTodayTasksElement = document.getElementById('dueTodayTasks')

    // Undo/Redo state
    const undoStack = []
    const redoStack = []
    let isUndoingRedoing = false

    // Add chart variables
    let completionTrendChart = null
    let priorityChart = null
    let categoryChart = null

    // Initialize dark mode
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode')
        darkModeToggle.textContent = '☀️'
    }

    // Event Listeners
    darkModeToggle.addEventListener('click', toggleDarkMode)
    addTaskButton.addEventListener('click', addTask)
    taskInput.addEventListener('keypress', e => { if (e.key === 'Enter') addTask() })
    clearCompletedButton.addEventListener('click', clearCompletedTasks)
    filterPriority.addEventListener('change', filterTasks)
    filterCategory.addEventListener('change', filterTasks)
    searchInput.addEventListener('input', filterTasks)
    sortTasks.addEventListener('change', sortTaskList)
    undoButton.addEventListener('click', undo)
    redoButton.addEventListener('click', redo)
    exportButton.addEventListener('click', exportTasks)
    importButton.addEventListener('click', () => importInput.click())
    importInput.addEventListener('change', importTasks)
    closeModal.addEventListener('click', () => modal.style.display = 'none')
    window.addEventListener('click', e => {
        if (e.target === modal) modal.style.display = 'none'
    })
    showStatsButton.addEventListener('click', () => {
        updateDashboard()
        statsDashboardModal.style.display = 'block'
    })
    statsCloseButton.addEventListener('click', () => {
        statsDashboardModal.style.display = 'none'
    })
    window.addEventListener('click', e => {
        if (e.target === statsDashboardModal) {
            statsDashboardModal.style.display = 'none'
        }
    })
    saveTemplateButton.addEventListener('click', showTemplateModal)
    templateModalClose.addEventListener('click', () => templateModal.style.display = 'none')
    confirmSaveTemplate.addEventListener('click', saveTemplate)
    templateSelect.addEventListener('change', loadTemplate)
    recurringType.addEventListener('change', updateRecurringOptions)
    recurringEnd.addEventListener('change', updateRecurringEndOptions)

    function createButton(text, className) {
        const button = document.createElement('button')
        button.textContent = text
        button.classList.add(className)
        return button
    }

    function moveTaskUp(taskItem) {
        if (taskItem.previousElementSibling) {
            taskItem.parentNode.insertBefore(taskItem, taskItem.previousElementSibling)
            saveTasks()
        }
    }

    function moveTaskDown(taskItem) {
        if (taskItem.nextElementSibling) {
            taskItem.parentNode.insertBefore(taskItem.nextElementSibling, taskItem)
            saveTasks()
        }
    }

    function clearCompletedTasks() {
        const completedTasks = taskList.querySelectorAll('.completed')
        completedTasks.forEach(task => task.remove())
        saveTasks()
        updateStatistics()
        updateCategoryFilter()
    }

    function filterTasks() {
        const priority = filterPriority.value
        const category = filterCategory.value
        const searchTerm = searchInput.value.toLowerCase()
        
        const tasks = taskList.querySelectorAll('.task-item')
        
        tasks.forEach(task => {
            const taskPriority = task.querySelector('.priority-badge').textContent.toLowerCase()
            const categoryTag = task.querySelector('.category-tag')
            const taskCategory = categoryTag ? categoryTag.textContent.toLowerCase() : ''
            const taskText = task.querySelector('.task-text').textContent.toLowerCase()
            
            const matchesPriority = priority === 'all' || taskPriority === priority
            const matchesCategory = category === 'all' || taskCategory === category
            const matchesSearch = taskText.includes(searchTerm)
            
            task.style.display = matchesPriority && matchesCategory && matchesSearch ? '' : 'none'
        })
    }

    function updateStatistics() {
        const tasks = taskList.querySelectorAll('.task-item')
        const completed = taskList.querySelectorAll('.task-item.completed')
        const today = new Date().toLocaleDateString()
        const dueToday = Array.from(tasks).filter(task => {
            const dueDateSpan = task.querySelector('.task-meta span:first-child')
            return dueDateSpan && dueDateSpan.textContent === today && !task.classList.contains('completed')
        })

        totalTasksElement.textContent = tasks.length
        completedTasksElement.textContent = completed.length
        pendingTasksElement.textContent = tasks.length - completed.length
        dueTodayTasksElement.textContent = dueToday.length
    }

    function updateCategoryFilter() {
        const categories = new Set()
        taskList.querySelectorAll('.category-tag').forEach(tag => {
            categories.add(tag.textContent)
        })

        // Save current selection
        const currentSelection = filterCategory.value

        // Clear all options except 'All Categories'
        filterCategory.innerHTML = '<option value="all">All Categories</option>'

        // Add categories
        categories.forEach(category => {
            const option = document.createElement('option')
            option.value = category.toLowerCase()
            option.textContent = category
            filterCategory.appendChild(option)
        })

        // Restore selection if it still exists
        if (Array.from(filterCategory.options).some(option => option.value === currentSelection)) {
            filterCategory.value = currentSelection
        }
    }

    function checkDueTasks() {
        const now = new Date()
        const today = now.toLocaleDateString()
        const tasks = Array.from(taskList.children)
        
        tasks.forEach(task => {
            if (!task.classList.contains('completed')) {
                const dueDateSpan = task.querySelector('.task-meta span:first-child')
                if (dueDateSpan && dueDateSpan.textContent === today) {
                    // Check if we haven't already notified for this task today
                    const taskId = task.dataset.id
                    const lastNotified = localStorage.getItem(`notified_${taskId}`)
                    
                    if (lastNotified !== today) {
                        const taskText = task.querySelector('.task-text').textContent
                        
                        // Show notification
                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification("Task Due Today", {
                                body: taskText,
                                icon: "/favicon.ico"
                            })
                        } else if ("Notification" in window && Notification.permission !== "denied") {
                            Notification.requestPermission().then(permission => {
                                if (permission === "granted") {
                                    new Notification("Task Due Today", {
                                        body: taskText,
                                        icon: "/favicon.ico"
                                    })
                                }
                            })
                        }
                        
                        // Mark as notified
                        localStorage.setItem(`notified_${taskId}`, today)
                    }
                }
            }
        })
    }

    // Load tasks and update UI
    loadTasks()
    updateStatistics()
    updateCategoryFilter()
    updateUndoRedoButtons()

    // Check for due tasks every minute
    setInterval(checkDueTasks, 60000)
    checkDueTasks()

    function addTask() {
        const taskText = taskInput.value.trim()
        if (taskText !== '') {
            const task = {
                id: Date.now(),
                text: taskText,
                description: taskDescription.value.trim(),
                completed: false,
                dueDate: taskDueDate.value,
                priority: taskPriority.value,
                category: taskCategory.value.trim(),
                tags: taskTags.value.split(',').map(tag => tag.trim()).filter(tag => tag),
                subtasks: [],
                progress: 0,
                createdAt: new Date().toISOString(),
                recurring: {
                    type: recurringType.value,
                    interval: recurringInterval.value,
                    unit: recurringUnit.value,
                    end: recurringEnd.value,
                    count: recurringCount.value,
                    endDate: recurringEndDate.value
                }
            }

            saveState()
            addTaskToList(task)
            saveTasks()
            updateStatistics()
            updateCategoryFilter()

            // If task is recurring, schedule next occurrence
            if (task.recurring.type !== 'none') {
                scheduleNextTask(task)
            }

            // Clear input fields
            clearInputFields()
        }
    }

    function addTaskToList(task) {
        const listItem = document.createElement('li')
        listItem.classList.add('task-item')
        listItem.dataset.id = task.id
        
        // Create checkbox
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.checked = task.completed
        checkbox.addEventListener('change', function() {
            task.completed = checkbox.checked
            if (task.completed) {
                task.completedAt = new Date().toISOString()
            } else {
                delete task.completedAt
            }
            listItem.classList.toggle('completed', task.completed)
            updateSubtaskProgress(task)
            saveTasks()
            updateStatistics()
        })

        // Create task content container
        const taskContent = document.createElement('div')
        taskContent.classList.add('task-content')
        taskContent.addEventListener('click', () => showTaskDetails(task))

        // Add task text and description
        const taskText = document.createElement('span')
        taskText.classList.add('task-text')
        taskText.textContent = task.text

        if (task.description) {
            const description = document.createElement('div')
            description.classList.add('task-description')
            description.textContent = task.description
            taskContent.appendChild(description)
        }

        // Add task metadata
        const taskMeta = document.createElement('div')
        taskMeta.classList.add('task-meta')

        // Add due date
        if (task.dueDate) {
            const dueDate = document.createElement('span')
            dueDate.textContent = new Date(task.dueDate).toLocaleDateString()
            taskMeta.appendChild(dueDate)
        }

        // Add priority badge
        const priorityBadge = document.createElement('span')
        priorityBadge.classList.add('priority-badge', `priority-${task.priority}`)
        priorityBadge.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
        taskMeta.appendChild(priorityBadge)

        // Add category tag if present
        if (task.category) {
            const categoryTag = document.createElement('span')
            categoryTag.classList.add('category-tag')
            categoryTag.textContent = task.category
            taskMeta.appendChild(categoryTag)
        }

        // Add tags
        if (task.tags && task.tags.length > 0) {
            const tagsContainer = document.createElement('div')
            tagsContainer.classList.add('tags-list')
            task.tags.forEach(tag => {
                const tagElement = document.createElement('span')
                tagElement.classList.add('tag')
                tagElement.textContent = tag
                tagsContainer.appendChild(tagElement)
            })
            taskContent.appendChild(tagsContainer)
        }

        // Add progress bar if has subtasks
        if (task.subtasks && task.subtasks.length > 0) {
            const progressBar = document.createElement('div')
            progressBar.classList.add('progress-mini')
            const progressFill = document.createElement('div')
            progressFill.classList.add('progress-mini-fill')
            progressFill.style.width = `${task.progress}%`
            progressBar.appendChild(progressFill)
            taskContent.appendChild(progressBar)
        }

        // Create button group
        const buttonGroup = document.createElement('div')
        buttonGroup.classList.add('button-group')

        // Create edit button
        const editButton = createButton('✎', 'edit-button')
        editButton.addEventListener('click', (e) => {
            e.stopPropagation()
            showTaskDetails(task)
        })

        // Create move buttons
        const upButton = createButton('↑', 'up-button')
        const downButton = createButton('↓', 'down-button')

        upButton.addEventListener('click', (e) => {
            e.stopPropagation()
            moveTaskUp(listItem)
        })
        downButton.addEventListener('click', (e) => {
            e.stopPropagation()
            moveTaskDown(listItem)
        })

        // Create delete button
        const deleteButton = createButton('×', 'delete-button')
        deleteButton.addEventListener('click', function(e) {
            e.stopPropagation()
            saveState()
            taskList.removeChild(listItem)
            saveTasks()
            updateStatistics()
            updateCategoryFilter()
        })

        // Assemble all elements
        taskContent.appendChild(taskText)
        taskContent.appendChild(taskMeta)
        
        buttonGroup.appendChild(editButton)
        buttonGroup.appendChild(upButton)
        buttonGroup.appendChild(downButton)
        buttonGroup.appendChild(deleteButton)

        listItem.appendChild(checkbox)
        listItem.appendChild(taskContent)
        listItem.appendChild(buttonGroup)

        if (task.completed) {
            listItem.classList.add('completed')
        }

        taskList.appendChild(listItem)
        updateSubtaskProgress(task)
    }

    function showTaskDetails(task) {
        const modalTaskTitle = document.getElementById('modalTaskTitle')
        const modalTaskDescription = document.getElementById('modalTaskDescription')
        const modalDueDate = document.getElementById('modalDueDate')
        const modalPriority = document.getElementById('modalPriority')
        const modalCategory = document.getElementById('modalCategory')
        const modalTags = document.getElementById('modalTags')
        const subtasksList = document.getElementById('subtasksList')
        const newSubtask = document.getElementById('newSubtask')
        const addSubtask = document.getElementById('addSubtask')

        modalTaskTitle.value = task.text
        modalTaskDescription.value = task.description || ''
        modalDueDate.value = task.dueDate || ''
        modalPriority.value = task.priority
        modalCategory.value = task.category || ''
        modalTags.value = (task.tags || []).join(', ')

        // Clear and populate subtasks
        subtasksList.innerHTML = ''
        ;(task.subtasks || []).forEach((subtask, index) => {
            const li = document.createElement('li')
            li.classList.add('subtask-item')
            
            const checkbox = document.createElement('input')
            checkbox.type = 'checkbox'
            checkbox.checked = subtask.completed
            checkbox.addEventListener('change', () => {
                subtask.completed = checkbox.checked
                updateSubtaskProgress(task)
                saveTasks()
            })

            const text = document.createElement('span')
            text.textContent = subtask.text

            const deleteBtn = document.createElement('button')
            deleteBtn.textContent = '×'
            deleteBtn.addEventListener('click', () => {
                task.subtasks.splice(index, 1)
                updateSubtaskProgress(task)
                saveTasks()
                showTaskDetails(task) // Refresh modal
            })

            li.appendChild(checkbox)
            li.appendChild(text)
            li.appendChild(deleteBtn)
            subtasksList.appendChild(li)
        })

        // Add subtask handler
        addSubtask.onclick = () => {
            const subtaskText = newSubtask.value.trim()
            if (subtaskText) {
                task.subtasks = task.subtasks || []
                task.subtasks.push({
                    text: subtaskText,
                    completed: false
                })
                newSubtask.value = ''
                updateSubtaskProgress(task)
                saveTasks()
                showTaskDetails(task) // Refresh modal
            }
        }

        // Save changes handler
        modalTaskTitle.onchange = () => {
            if (modalTaskTitle.value.trim()) {
                saveState()
                task.text = modalTaskTitle.value
                task.description = modalTaskDescription.value
                task.dueDate = modalDueDate.value
                task.priority = modalPriority.value
                task.category = modalCategory.value
                task.tags = modalTags.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                saveTasks()
                updateTaskDisplay(task)
            }
        }

        modal.style.display = 'block'
    }

    function updateTaskDisplay(task) {
        const taskItem = document.querySelector(`[data-id="${task.id}"]`)
        if (taskItem) {
            taskList.removeChild(taskItem)
            addTaskToList(task)
            updateCategoryFilter()
            sortTaskList()
        }
    }

    function updateSubtaskProgress(task) {
        if (!task.subtasks || task.subtasks.length === 0) {
            task.progress = task.completed ? 100 : 0
            return
        }

        const completed = task.subtasks.filter(subtask => subtask.completed).length
        task.progress = Math.round((completed / task.subtasks.length) * 100)

        const taskItem = document.querySelector(`[data-id="${task.id}"]`)
        if (taskItem) {
            const progressFill = taskItem.querySelector('.progress-mini-fill')
            if (progressFill) {
                progressFill.style.width = `${task.progress}%`
            }
        }
    }

    function sortTaskList() {
        const tasks = Array.from(taskList.children)
        const sortType = sortTasks.value

        tasks.sort((a, b) => {
            const aTask = getTaskData(a)
            const bTask = getTaskData(b)

            switch (sortType) {
                case 'dueDate':
                    return compareDates(aTask.dueDate, bTask.dueDate)
                case 'priority':
                    return comparePriority(aTask.priority, bTask.priority)
                case 'alphabetical':
                    return aTask.text.localeCompare(bTask.text)
                default: // 'created'
                    return aTask.id - bTask.id
            }
        })

        // Reorder DOM
        tasks.forEach(task => taskList.appendChild(task))
    }

    function getTaskData(taskElement) {
        return {
            id: parseInt(taskElement.dataset.id),
            text: taskElement.querySelector('.task-text').textContent,
            dueDate: taskElement.querySelector('.task-meta span:first-child')?.textContent || '',
            priority: taskElement.querySelector('.priority-badge').textContent.toLowerCase()
        }
    }

    function compareDates(a, b) {
        if (!a && !b) return 0
        if (!a) return 1
        if (!b) return -1
        return new Date(a) - new Date(b)
    }

    function comparePriority(a, b) {
        const priority = { high: 3, medium: 2, low: 1 }
        return priority[b] - priority[a]
    }

    function saveState() {
        if (isUndoingRedoing) return
        const currentState = localStorage.getItem('tasks')
        undoStack.push(currentState)
        redoStack.length = 0 // Clear redo stack
        updateUndoRedoButtons()
    }

    function undo() {
        if (undoStack.length === 0) return
        isUndoingRedoing = true
        const currentState = localStorage.getItem('tasks')
        redoStack.push(currentState)
        const previousState = undoStack.pop()
        localStorage.setItem('tasks', previousState)
        refreshTasks()
        isUndoingRedoing = false
        updateUndoRedoButtons()
    }

    function redo() {
        if (redoStack.length === 0) return
        isUndoingRedoing = true
        const currentState = localStorage.getItem('tasks')
        undoStack.push(currentState)
        const nextState = redoStack.pop()
        localStorage.setItem('tasks', nextState)
        refreshTasks()
        isUndoingRedoing = false
        updateUndoRedoButtons()
    }

    function updateUndoRedoButtons() {
        undoButton.disabled = undoStack.length === 0
        redoButton.disabled = redoStack.length === 0
    }

    function refreshTasks() {
        taskList.innerHTML = ''
        loadTasks()
        updateStatistics()
        updateCategoryFilter()
    }

    function exportTasks() {
        const tasks = JSON.parse(localStorage.getItem('tasks') || '[]')
        const dataStr = JSON.stringify(tasks, null, 2)
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
        
        const exportFileDefaultName = 'tasks.json'
        const linkElement = document.createElement('a')
        linkElement.setAttribute('href', dataUri)
        linkElement.setAttribute('download', exportFileDefaultName)
        linkElement.click()
    }

    function importTasks(event) {
        const file = event.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = function(e) {
            try {
                const tasks = JSON.parse(e.target.result)
                saveState()
                localStorage.setItem('tasks', JSON.stringify(tasks))
                refreshTasks()
                event.target.value = '' // Reset file input
            } catch (error) {
                alert('Invalid file format')
            }
        }
        reader.readAsText(file)
    }

    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode')
        const isDarkMode = document.body.classList.contains('dark-mode')
        localStorage.setItem('darkMode', isDarkMode)
        darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙'
    }

    // ... (keep existing helper functions like createButton, moveTaskUp, moveTaskDown, etc.)
    
    function loadTasks() {
        const tasks = JSON.parse(localStorage.getItem('tasks')) || []
        tasks.forEach(task => {
            addTaskToList(task)
        })
        sortTaskList()
    }

    function saveTasks() {
        const tasks = Array.from(taskList.children).map(li => {
            const taskText = li.querySelector('.task-text').textContent
            const description = li.querySelector('.task-description')?.textContent || ''
            const completed = li.classList.contains('completed')
            const priority = li.querySelector('.priority-badge').textContent.toLowerCase()
            const categoryTag = li.querySelector('.category-tag')
            const dueDateSpan = li.querySelector('.task-meta span:first-child')
            const tags = Array.from(li.querySelectorAll('.tag')).map(tag => tag.textContent)
            
            // Get task from existing data to preserve subtasks
            const existingTask = JSON.parse(localStorage.getItem('tasks') || '[]')
                .find(t => t.id === parseInt(li.dataset.id))
            
            return {
                id: parseInt(li.dataset.id),
                text: taskText,
                description: description,
                completed: completed,
                priority: priority,
                category: categoryTag ? categoryTag.textContent : '',
                dueDate: dueDateSpan ? dueDateSpan.textContent : '',
                tags: tags,
                subtasks: existingTask ? existingTask.subtasks : [],
                progress: existingTask ? existingTask.progress : 0,
                createdAt: existingTask ? existingTask.createdAt : new Date().toISOString()
            }
        })
        localStorage.setItem('tasks', JSON.stringify(tasks))
    }

    function updateDashboard() {
        const tasks = JSON.parse(localStorage.getItem('tasks') || '[]')
        updateCharts(tasks)
        updateProductivityScore(tasks)
        updateCompletionStats(tasks)
    }

    function updateCharts(tasks) {
        // Completion Trend Chart
        const dates = getLast7Days()
        const completionData = dates.map(date => {
            return tasks.filter(task => 
                task.completed && 
                new Date(task.completedAt).toLocaleDateString() === date.toLocaleDateString()
            ).length
        })

        if (completionTrendChart) {
            completionTrendChart.destroy()
        }

        completionTrendChart = new Chart(
            document.getElementById('completionTrendChart'),
            {
                type: 'line',
                data: {
                    labels: dates.map(date => date.toLocaleDateString()),
                    datasets: [{
                        label: 'Completed Tasks',
                        data: completionData,
                        borderColor: '#4CAF50',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            }
        )

        // Priority Distribution Chart
        const priorityCounts = {
            high: tasks.filter(t => t.priority === 'high').length,
            medium: tasks.filter(t => t.priority === 'medium').length,
            low: tasks.filter(t => t.priority === 'low').length
        }

        if (priorityChart) {
            priorityChart.destroy()
        }

        priorityChart = new Chart(
            document.getElementById('priorityChart'),
            {
                type: 'doughnut',
                data: {
                    labels: ['High', 'Medium', 'Low'],
                    datasets: [{
                        data: [priorityCounts.high, priorityCounts.medium, priorityCounts.low],
                        backgroundColor: ['#ff4444', '#ffbb33', '#00C851']
                    }]
                },
                options: {
                    responsive: true
                }
            }
        )

        // Category Distribution Chart
        const categories = {}
        tasks.forEach(task => {
            if (task.category) {
                categories[task.category] = (categories[task.category] || 0) + 1
            }
        })

        if (categoryChart) {
            categoryChart.destroy()
        }

        categoryChart = new Chart(
            document.getElementById('categoryChart'),
            {
                type: 'pie',
                data: {
                    labels: Object.keys(categories),
                    datasets: [{
                        data: Object.values(categories),
                        backgroundColor: generateColors(Object.keys(categories).length)
                    }]
                },
                options: {
                    responsive: true
                }
            }
        )
    }

    function updateProductivityScore(tasks) {
        const completedTasks = tasks.filter(t => t.completed)
        const totalTasks = tasks.length

        // Calculate on-time completion rate
        const onTimeCompletions = completedTasks.filter(task => {
            if (!task.dueDate) return true
            const completedDate = new Date(task.completedAt)
            const dueDate = new Date(task.dueDate)
            return completedDate <= dueDate
        }).length

        const onTimeRate = completedTasks.length ? 
            Math.round((onTimeCompletions / completedTasks.length) * 100) : 0

        // Calculate task efficiency (completed tasks vs total tasks)
        const taskEfficiency = totalTasks ? 
            Math.round((completedTasks.length / totalTasks) * 100) : 0

        // Calculate overall productivity score
        const productivityScore = Math.round((onTimeRate + taskEfficiency) / 2)

        // Update UI
        document.getElementById('productivityScore').textContent = productivityScore
        document.getElementById('onTimeRate').textContent = onTimeRate + '%'
        document.getElementById('taskEfficiency').textContent = taskEfficiency + '%'

        // Update score circle gradient
        const scoreCircle = document.querySelector('.score-circle')
        scoreCircle.style.background = `conic-gradient(
            var(--progress-fill) ${productivityScore}%, 
            var(--progress-bg) ${productivityScore}%
        )`
    }

    function updateCompletionStats(tasks) {
        const completedTasks = tasks.filter(t => t.completed && t.completedAt)
        
        if (completedTasks.length === 0) {
            document.getElementById('avgCompletionTime').textContent = 'No data'
            document.getElementById('fastestCompletion').textContent = 'No data'
            return
        }

        // Calculate completion times
        const completionTimes = completedTasks.map(task => {
            const created = new Date(task.createdAt)
            const completed = new Date(task.completedAt)
            return Math.ceil((completed - created) / (1000 * 60 * 60 * 24)) // days
        })

        const avgTime = Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
        const fastestTime = Math.min(...completionTimes)

        document.getElementById('avgCompletionTime').textContent = `${avgTime} days`
        document.getElementById('fastestCompletion').textContent = `${fastestTime} days`
    }

    function getLast7Days() {
        const dates = []
        for (let i = 6; i >= 0; i--) {
            const date = new Date()
            date.setDate(date.getDate() - i)
            dates.push(date)
        }
        return dates
    }

    function generateColors(count) {
        const colors = []
        for (let i = 0; i < count; i++) {
            colors.push(`hsl(${(i * 360) / count}, 70%, 50%)`)
        }
        return colors
    }

    function showTemplateModal() {
        const currentTask = {
            text: taskInput.value,
            description: taskDescription.value,
            dueDate: taskDueDate.value,
            priority: taskPriority.value,
            category: taskCategory.value,
            tags: taskTags.value,
            recurring: {
                type: recurringType.value,
                interval: recurringInterval.value,
                unit: recurringUnit.value,
                end: recurringEnd.value,
                count: recurringCount.value,
                endDate: recurringEndDate.value
            }
        }

        templateName.value = ''
        templatePreview.innerHTML = generateTaskPreview(currentTask)
        templateModal.style.display = 'block'
    }

    function generateTaskPreview(task) {
        return `
            <div class="task-preview">
                <div class="task-title">${task.text || '(No title)'}</div>
                ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                <div class="task-meta">
                    ${task.dueDate ? `<span class="due-date">Due: ${task.dueDate}</span>` : ''}
                    ${task.priority ? `<span class="priority-badge priority-${task.priority}">${task.priority}</span>` : ''}
                    ${task.category ? `<span class="category-tag">${task.category}</span>` : ''}
                </div>
                ${task.tags ? `<div class="tags-list">${task.tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}</div>` : ''}
                ${task.recurring.type !== 'none' ? `<div class="recurring-badge">🔄 ${getRecurringText(task.recurring)}</div>` : ''}
            </div>
        `
    }

    function getRecurringText(recurring) {
        if (recurring.type === 'none') return ''
        if (recurring.type === 'custom') {
            return `Every ${recurring.interval} ${recurring.unit}`
        }
        return recurring.type.charAt(0).toUpperCase() + recurring.type.slice(1)
    }

    function saveTemplate() {
        const name = templateName.value.trim()
        if (!name) {
            alert('Please enter a template name')
            return
        }

        const template = {
            name,
            text: taskInput.value,
            description: taskDescription.value,
            priority: taskPriority.value,
            category: taskCategory.value,
            tags: taskTags.value,
            recurring: {
                type: recurringType.value,
                interval: recurringInterval.value,
                unit: recurringUnit.value,
                end: recurringEnd.value,
                count: recurringCount.value,
                endDate: recurringEndDate.value
            }
        }

        const templates = JSON.parse(localStorage.getItem('taskTemplates') || '[]')
        templates.push(template)
        localStorage.setItem('taskTemplates', JSON.stringify(templates))

        loadTemplates()
        templateModal.style.display = 'none'
    }

    function loadTemplates() {
        const templates = JSON.parse(localStorage.getItem('taskTemplates') || '[]')
        
        // Clear existing options except the first one
        while (templateSelect.options.length > 1) {
            templateSelect.remove(1)
        }

        // Add templates
        templates.forEach(template => {
            const option = document.createElement('option')
            option.value = template.name
            option.textContent = template.name
            templateSelect.appendChild(option)
        })
    }

    function loadTemplate() {
        const selectedTemplate = templateSelect.value
        if (!selectedTemplate) return

        const templates = JSON.parse(localStorage.getItem('taskTemplates') || '[]')
        const template = templates.find(t => t.name === selectedTemplate)
        
        if (template) {
            taskInput.value = template.text || ''
            taskDescription.value = template.description || ''
            taskPriority.value = template.priority || 'low'
            taskCategory.value = template.category || ''
            taskTags.value = template.tags || ''
            
            // Set recurring options
            recurringType.value = template.recurring.type || 'none'
            recurringInterval.value = template.recurring.interval || '1'
            recurringUnit.value = template.recurring.unit || 'days'
            recurringEnd.value = template.recurring.end || 'never'
            recurringCount.value = template.recurring.count || '1'
            recurringEndDate.value = template.recurring.endDate || ''
            
            updateRecurringOptions()
            updateRecurringEndOptions()
        }

        // Reset select
        templateSelect.value = ''
    }

    function updateRecurringOptions() {
        const isCustom = recurringType.value === 'custom'
        customRecurring.style.display = isCustom ? 'flex' : 'none'
    }

    function updateRecurringEndOptions() {
        const endType = recurringEnd.value
        recurringCount.style.display = endType === 'after' ? 'block' : 'none'
        recurringEndDate.style.display = endType === 'on' ? 'block' : 'none'
    }

    function clearInputFields() {
        taskInput.value = ''
        taskDescription.value = ''
        taskDueDate.value = ''
        taskCategory.value = ''
        taskTags.value = ''
        taskPriority.value = 'low'
        recurringType.value = 'none'
        recurringInterval.value = '1'
        recurringUnit.value = 'days'
        recurringEnd.value = 'never'
        recurringCount.value = '1'
        recurringEndDate.value = ''
        updateRecurringOptions()
        updateRecurringEndOptions()
    }

    function scheduleNextTask(task) {
        if (task.recurring.type === 'none') return

        const nextTask = {...task}
        nextTask.id = Date.now()
        nextTask.completed = false
        delete nextTask.completedAt

        // Calculate next due date
        if (task.dueDate) {
            const currentDue = new Date(task.dueDate)
            let nextDue

            switch (task.recurring.type) {
                case 'daily':
                    nextDue = new Date(currentDue.setDate(currentDue.getDate() + 1))
                    break
                case 'weekly':
                    nextDue = new Date(currentDue.setDate(currentDue.getDate() + 7))
                    break
                case 'monthly':
                    nextDue = new Date(currentDue.setMonth(currentDue.getMonth() + 1))
                    break
                case 'custom':
                    const interval = parseInt(task.recurring.interval)
                    switch (task.recurring.unit) {
                        case 'days':
                            nextDue = new Date(currentDue.setDate(currentDue.getDate() + interval))
                            break
                        case 'weeks':
                            nextDue = new Date(currentDue.setDate(currentDue.getDate() + (interval * 7)))
                            break
                        case 'months':
                            nextDue = new Date(currentDue.setMonth(currentDue.getMonth() + interval))
                            break
                    }
                    break
            }

            // Check if we should create the next occurrence
            let shouldCreate = true
            if (task.recurring.end === 'on' && task.recurring.endDate) {
                shouldCreate = nextDue <= new Date(task.recurring.endDate)
            } else if (task.recurring.end === 'after') {
                const tasksWithSameRecurring = Array.from(taskList.children)
                    .filter(li => {
                        const taskData = JSON.parse(localStorage.getItem('tasks') || '[]')
                            .find(t => t.id === parseInt(li.dataset.id))
                        return taskData && taskData.recurring && 
                               taskData.recurring.type === task.recurring.type &&
                               taskData.text === task.text
                    }).length
                shouldCreate = tasksWithSameRecurring < parseInt(task.recurring.count)
            }

            if (shouldCreate) {
                nextTask.dueDate = nextDue.toISOString().split('T')[0]
                nextTask.createdAt = new Date().toISOString()
                
                // Add the task after a delay to ensure proper ordering
                setTimeout(() => {
                    addTaskToList(nextTask)
                    saveTasks()
                    updateStatistics()
                    sortTaskList()
                }, 100)
            }
        }
    }
})
