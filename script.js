document.addEventListener('DOMContentLoaded', function() {
    const taskInput = document.getElementById('taskInput')
    const addTaskButton = document.getElementById('addTaskButton')
    const taskList = document.getElementById('taskList')

    // Load tasks from local storage on page load
    loadTasks()

    addTaskButton.addEventListener('click', function() {
        const taskText = taskInput.value.trim()
        if (taskText !== '') {
            // Create task object
            const task = {
                id: Date.now(), // Unique ID for the task
                text: taskText
            }

            // Add task to task list
            addTaskToList(task)

            // Save tasks to local storage
            saveTasks()

            // Clear input field
            taskInput.value = ''
        }
    })

    // Function to add task to task list
    function addTaskToList(task) {
        const listItem = document.createElement('li')
        listItem.textContent = task.text

        // Create buttons for moving tasks up and down
        const upButton = createButton('Up', 'up-button')
        const downButton = createButton('Down', 'down-button')

        // Add event listeners for moving tasks up and down
        upButton.addEventListener('click', function() {
            moveTaskUp(listItem)
        })

        downButton.addEventListener('click', function() {
            moveTaskDown(listItem)
        })

        // Create delete button
        const deleteButton = document.createElement('button')
        deleteButton.textContent = 'Delete'
        deleteButton.classList.add('delete-button')

        // Add event listener for delete button
        deleteButton.addEventListener('click', function() {
            taskList.removeChild(listItem)
            saveTasks()
        })

        listItem.appendChild(upButton)
        listItem.appendChild(downButton)
        listItem.appendChild(deleteButton)

        taskList.appendChild(listItem)
    }

    // Function to create button element
    function createButton(text, className) {
        const button = document.createElement('button')
        button.textContent = text
        button.classList.add(className)
        return button
    }

    // Function to move task up in the list
    function moveTaskUp(taskItem) {
        if (taskItem.previousElementSibling) {
            taskItem.parentNode.insertBefore(taskItem, taskItem.previousElementSibling)
            saveTasks()
        }
    }

    // Function to move task down in the list
    function moveTaskDown(taskItem) {
        if (taskItem.nextElementSibling) {
            taskItem.parentNode.insertBefore(taskItem.nextElementSibling, taskItem)
            saveTasks()
        }
    }

    // Function to load tasks from local storage
    function loadTasks() {
        const tasks = JSON.parse(localStorage.getItem('tasks')) || []
        tasks.forEach(task => {
            addTaskToList(task)
        })
    }

    // Function to save tasks to local storage
    function saveTasks() {
        const tasks = Array.from(taskList.children).map(li => {
            return {
                id: li.dataset.id,
                text: li.textContent
            }
        })
        localStorage.setItem('tasks', JSON.stringify(tasks))
    }
})
