const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    completedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

const commentSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        trim: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'archived'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    category: {
        type: String,
        trim: true
    },
    dueDate: {
        type: Date
    },
    completedAt: {
        type: Date,
        default: null
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    sharedWith: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    subtasks: [subtaskSchema],
    comments: [commentSchema],
    attachments: [{
        name: String,
        url: String,
        type: String,
        size: Number,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    tags: [{
        type: String,
        trim: true
    }],
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    recurring: {
        enabled: {
            type: Boolean,
            default: false
        },
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
            default: 'weekly'
        },
        endDate: Date
    }
}, {
    timestamps: true
});

// Update progress when subtasks change
taskSchema.methods.updateProgress = function() {
    if (!this.subtasks || this.subtasks.length === 0) {
        this.progress = this.status === 'completed' ? 100 : 0;
        return;
    }

    const completedSubtasks = this.subtasks.filter(subtask => subtask.completed).length;
    this.progress = Math.round((completedSubtasks / this.subtasks.length) * 100);
};

// Update status based on progress
taskSchema.pre('save', function(next) {
    if (this.isModified('progress')) {
        if (this.progress === 100) {
            this.status = 'completed';
            this.completedAt = new Date();
        } else if (this.progress > 0) {
            this.status = 'in_progress';
            this.completedAt = null;
        } else {
            this.status = 'pending';
            this.completedAt = null;
        }
    }

    if (this.isModified('status')) {
        if (this.status === 'completed' && !this.completedAt) {
            this.completedAt = new Date();
            this.progress = 100;
        } else if (this.status !== 'completed') {
            this.completedAt = null;
        }
    }

    next();
});

// Create recurring task
taskSchema.methods.createRecurringTask = async function() {
    if (!this.recurring.enabled || !this.recurring.frequency) {
        return null;
    }

    const newDueDate = new Date(this.dueDate);
    switch (this.recurring.frequency) {
        case 'daily':
            newDueDate.setDate(newDueDate.getDate() + 1);
            break;
        case 'weekly':
            newDueDate.setDate(newDueDate.getDate() + 7);
            break;
        case 'monthly':
            newDueDate.setMonth(newDueDate.getMonth() + 1);
            break;
    }

    // Don't create if past end date
    if (this.recurring.endDate && newDueDate > this.recurring.endDate) {
        return null;
    }

    const newTask = new this.constructor({
        title: this.title,
        description: this.description,
        priority: this.priority,
        category: this.category,
        dueDate: newDueDate,
        creator: this.creator,
        assignedTo: this.assignedTo,
        sharedWith: this.sharedWith,
        tags: this.tags,
        recurring: this.recurring
    });

    await newTask.save();
    return newTask;
};

// Get task statistics
taskSchema.statics.getStatistics = async function(userId) {
    const stats = await this.aggregate([
        {
            $match: {
                $or: [
                    { creator: userId },
                    { assignedTo: userId },
                    { sharedWith: userId }
                ]
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                completed: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
                    }
                },
                overdue: {
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

    return stats[0] || {
        total: 0,
        completed: 0,
        overdue: 0,
        avgCompletionTime: 0
    };
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task; 