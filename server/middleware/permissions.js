const Task = require('../models/Task');

const checkPermission = async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if user has access to the task
        const hasAccess = 
            task.creator.equals(req.user._id) || // Creator
            task.assignedTo?.equals(req.user._id) || // Assignee
            task.sharedWith?.some(userId => userId.equals(req.user._id)); // Shared with

        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Add task to request for route handlers
        req.task = task;
        next();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { checkPermission }; 