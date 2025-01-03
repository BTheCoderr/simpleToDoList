const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    notificationPreferences: {
        taskReminders: {
            type: Boolean,
            default: true
        },
        emailNotifications: {
            type: Boolean,
            default: true
        },
        pushNotifications: {
            type: Boolean,
            default: false
        }
    },
    pushSubscription: {
        type: Object,
        default: null
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    lastLogin: {
        type: Date,
        default: null
    },
    tokens: [{
        token: {
            type: String,
            required: true
        }
    }],
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, {
    timestamps: true
});

// Virtual for tasks created by user
userSchema.virtual('createdTasks', {
    ref: 'Task',
    localField: '_id',
    foreignField: 'creator'
});

// Virtual for tasks assigned to user
userSchema.virtual('assignedTasks', {
    ref: 'Task',
    localField: '_id',
    foreignField: 'assignedTo'
});

// Virtual for tasks shared with user
userSchema.virtual('sharedTasks', {
    ref: 'Task',
    localField: '_id',
    foreignField: 'sharedWith'
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    const user = this;

    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 8);
    }

    next();
});

// Generate auth token
userSchema.methods.generateAuthToken = async function() {
    const user = this;
    const token = jwt.sign(
        { _id: user._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    user.tokens = user.tokens.concat({ token });
    await user.save();

    return token;
};

// Get public profile
userSchema.methods.toPublicJSON = function() {
    const user = this;
    const userObject = user.toObject();

    delete userObject.password;
    delete userObject.tokens;
    delete userObject.resetPasswordToken;
    delete userObject.resetPasswordExpires;

    return userObject;
};

// Get task statistics
userSchema.methods.getTaskStats = async function() {
    const user = this;
    await user.populate([
        {
            path: 'createdTasks',
            match: { status: 'completed' }
        },
        {
            path: 'assignedTasks',
            match: { status: 'completed' }
        }
    ]);

    return {
        totalCreated: user.createdTasks.length,
        totalAssigned: user.assignedTasks.length,
        completedCreated: user.createdTasks.filter(task => task.status === 'completed').length,
        completedAssigned: user.assignedTasks.filter(task => task.status === 'completed').length
    };
};

const User = mongoose.model('User', userSchema);

module.exports = User; 