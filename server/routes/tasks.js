const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');
const { processTaskText } = require('../utils/nlp');
const { scheduleReminder } = require('../utils/notifications');
const { checkPermission } = require('../middleware/permissions');

// Create task
router.post('/', auth, async (req, res) => {
    try {
        const nlpResult = await processTaskText(req.body.title);
        const task = new Task({
            ...req.body,
            creator: req.user._id,
            priority: nlpResult.priority || req.body.priority,
            category: nlpResult.category || req.body.category,
            dueDate: nlpResult.dueDate || req.body.dueDate
        });

        await task.save();

        if (task.dueDate && req.user.notificationPreferences.taskReminders) {
            await scheduleReminder(task, req.user);
        }

        res.status(201).json(task);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all tasks
router.get('/', auth, async (req, res) => {
    try {
        const match = {
            $or: [
                { creator: req.user._id },
                { assignedTo: req.user._id },
                { sharedWith: req.user._id }
            ]
        };

        // Apply filters
        if (req.query.status) match.status = req.query.status;
        if (req.query.priority) match.priority = req.query.priority;
        if (req.query.category) match.category = req.query.category;
        if (req.query.dueDate) {
            const date = new Date(req.query.dueDate);
            match.dueDate = {
                $gte: date,
                $lt: new Date(date.setDate(date.getDate() + 1))
            };
        }

        const sort = {};
        if (req.query.sortBy) {
            const parts = req.query.sortBy.split(':');
            sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
        }

        const tasks = await Task.find(match)
            .sort(sort)
            .skip(parseInt(req.query.skip))
            .limit(parseInt(req.query.limit))
            .populate('creator', 'username')
            .populate('assignedTo', 'username')
            .populate('sharedWith', 'username');

        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get task by ID
router.get('/:id', auth, checkPermission, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('creator', 'username')
            .populate('assignedTo', 'username')
            .populate('sharedWith', 'username')
            .populate('comments.user', 'username');

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(task);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update task
router.patch('/:id', auth, checkPermission, async (req, res) => {
    try {
        const updates = Object.keys(req.body);
        const allowedUpdates = [
            'title', 'description', 'status', 'priority',
            'category', 'dueDate', 'assignedTo', 'sharedWith'
        ];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({ error: 'Invalid updates' });
        }

        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Process NLP if title is updated
        if (req.body.title) {
            const nlpResult = await processTaskText(req.body.title);
            req.body.priority = nlpResult.priority || req.body.priority;
            req.body.category = nlpResult.category || req.body.category;
            req.body.dueDate = nlpResult.dueDate || req.body.dueDate;
        }

        updates.forEach(update => task[update] = req.body[update]);
        
        // Update completion status
        if (req.body.status === 'completed' && task.status !== 'completed') {
            task.completedAt = new Date();
        } else if (req.body.status !== 'completed') {
            task.completedAt = null;
        }

        await task.save();

        // Reschedule reminder if dueDate changed
        if (req.body.dueDate && task.creator.equals(req.user._id)) {
            await scheduleReminder(task, req.user);
        }

        res.json(task);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete task
router.delete('/:id', auth, checkPermission, async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add comment
router.post('/:id/comments', auth, checkPermission, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        task.comments.push({
            text: req.body.text,
            user: req.user._id
        });

        await task.save();
        res.status(201).json(task.comments[task.comments.length - 1]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add subtask
router.post('/:id/subtasks', auth, checkPermission, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        task.subtasks.push({
            title: req.body.title,
            completed: false
        });

        await task.save();
        res.status(201).json(task.subtasks[task.subtasks.length - 1]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update subtask
router.patch('/:id/subtasks/:subtaskId', auth, checkPermission, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const subtask = task.subtasks.id(req.params.subtaskId);
        if (!subtask) {
            return res.status(404).json({ error: 'Subtask not found' });
        }

        if (req.body.title) subtask.title = req.body.title;
        if (typeof req.body.completed === 'boolean') subtask.completed = req.body.completed;

        await task.save();
        res.json(subtask);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete subtask
router.delete('/:id/subtasks/:subtaskId', auth, checkPermission, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        task.subtasks.pull(req.params.subtaskId);
        await task.save();
        res.json({ message: 'Subtask deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 