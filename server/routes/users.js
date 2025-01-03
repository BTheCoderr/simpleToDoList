const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Task = require('../models/Task');
const { auth } = require('../middleware/auth');
const { sendWeeklySummary } = require('../utils/email');

// Get user profile
router.get('/profile', auth, async (req, res) => {
    res.json(req.user.toPublicJSON());
});

// Update notification preferences
router.patch('/notifications', auth, async (req, res) => {
    try {
        req.user.notificationPreferences = {
            ...req.user.notificationPreferences,
            ...req.body
        };
        await req.user.save();
        res.json(req.user.notificationPreferences);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update push subscription
router.post('/push-subscription', auth, async (req, res) => {
    try {
        req.user.pushSubscription = req.body;
        await req.user.save();
        res.json({ message: 'Push subscription updated' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const stats = await Task.aggregate([
            {
                $match: {
                    $or: [
                        { creator: req.user._id },
                        { assignedTo: req.user._id }
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    totalTasks: { $sum: 1 },
                    completedTasks: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
                        }
                    },
                    overdueTasks: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $lt: ['$dueDate', new Date()] },
                                        { $ne: ['$status', 'completed'] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    avgCompletionTime: {
                        $avg: {
                            $cond: [
                                { $eq: ['$status', 'completed'] },
                                {
                                    $divide: [
                                        { $subtract: ['$completedAt', '$createdAt'] },
                                        1000 * 60 * 60 * 24 // Convert to days
                                    ]
                                },
                                null
                            ]
                        }
                    }
                }
            }
        ]);

        // Get completion trend
        const now = new Date();
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
        
        const completionTrend = await Task.aggregate([
            {
                $match: {
                    $or: [
                        { creator: req.user._id },
                        { assignedTo: req.user._id }
                    ],
                    status: 'completed',
                    completedAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$completedAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        // Get category distribution
        const categoryDistribution = await Task.aggregate([
            {
                $match: {
                    $or: [
                        { creator: req.user._id },
                        { assignedTo: req.user._id }
                    ],
                    category: { $exists: true, $ne: '' }
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            overview: stats[0] || {
                totalTasks: 0,
                completedTasks: 0,
                overdueTasks: 0,
                avgCompletionTime: 0
            },
            completionTrend,
            categoryDistribution
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Request weekly summary
router.post('/weekly-summary', auth, async (req, res) => {
    try {
        const tasks = await Task.find({
            $or: [
                { creator: req.user._id },
                { assignedTo: req.user._id }
            ]
        });

        await sendWeeklySummary(req.user, tasks);
        res.json({ message: 'Weekly summary email sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search users (for task sharing)
router.get('/search', auth, async (req, res) => {
    try {
        const searchTerm = req.query.q;
        if (!searchTerm) {
            return res.status(400).json({ error: 'Search term required' });
        }

        const users = await User.find({
            $and: [
                {
                    $or: [
                        { username: { $regex: searchTerm, $options: 'i' } },
                        { email: { $regex: searchTerm, $options: 'i' } },
                        { firstName: { $regex: searchTerm, $options: 'i' } },
                        { lastName: { $regex: searchTerm, $options: 'i' } }
                    ]
                },
                { _id: { $ne: req.user._id } }
            ]
        })
        .select('username email firstName lastName')
        .limit(10);

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 