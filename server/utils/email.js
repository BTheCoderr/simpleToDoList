const nodemailer = require('nodemailer');
const moment = require('moment');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Send welcome email
const sendWelcomeEmail = async (user) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: user.email,
            subject: 'Welcome to Task Manager!',
            html: `
                <h1>Welcome to Task Manager, ${user.firstName}!</h1>
                <p>We're excited to have you on board. Here are some things you can do to get started:</p>
                <ul>
                    <li>Create your first task</li>
                    <li>Set up your notification preferences</li>
                    <li>Explore the task categories</li>
                    <li>Try our natural language processing features</li>
                </ul>
                <p>If you have any questions, feel free to reach out to our support team.</p>
            `
        });
    } catch (error) {
        console.error('Error sending welcome email:', error);
    }
};

// Send password reset email
const sendPasswordResetEmail = async (user, token) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: user.email,
            subject: 'Password Reset Request',
            html: `
                <h1>Password Reset Request</h1>
                <p>Hi ${user.firstName},</p>
                <p>You requested to reset your password. Click the link below to proceed:</p>
                <p><a href="${resetUrl}">Reset Password</a></p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        });
    } catch (error) {
        console.error('Error sending password reset email:', error);
    }
};

// Send task reminder
const sendTaskReminder = async (task, user) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: user.email,
            subject: 'Task Reminder',
            html: `
                <h1>Task Reminder</h1>
                <p>Hi ${user.firstName},</p>
                <p>This is a reminder for your task:</p>
                <div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
                    <h2>${task.title}</h2>
                    <p>${task.description || 'No description'}</p>
                    <p><strong>Due:</strong> ${moment(task.dueDate).format('MMMM Do YYYY, h:mm a')}</p>
                    <p><strong>Priority:</strong> ${task.priority}</p>
                    <p><strong>Category:</strong> ${task.category || 'Uncategorized'}</p>
                </div>
                <p><a href="${process.env.FRONTEND_URL}/tasks/${task._id}">View Task</a></p>
            `
        });
    } catch (error) {
        console.error('Error sending task reminder:', error);
    }
};

// Send weekly summary
const sendWeeklySummary = async (user, tasks) => {
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const pendingTasks = tasks.filter(task => task.status !== 'completed');
    const overdueTasks = tasks.filter(task => 
        task.status !== 'completed' && 
        task.dueDate && 
        new Date(task.dueDate) < new Date()
    );

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: user.email,
            subject: 'Your Weekly Task Summary',
            html: `
                <h1>Weekly Task Summary</h1>
                <p>Hi ${user.firstName},</p>
                <p>Here's your task summary for the week:</p>
                
                <h2>Overview</h2>
                <ul>
                    <li>Completed Tasks: ${completedTasks.length}</li>
                    <li>Pending Tasks: ${pendingTasks.length}</li>
                    <li>Overdue Tasks: ${overdueTasks.length}</li>
                </ul>

                ${overdueTasks.length > 0 ? `
                    <h2>Overdue Tasks</h2>
                    <ul>
                        ${overdueTasks.map(task => `
                            <li>
                                <strong>${task.title}</strong>
                                <br>Due: ${moment(task.dueDate).format('MMMM Do YYYY')}
                            </li>
                        `).join('')}
                    </ul>
                ` : ''}

                ${pendingTasks.length > 0 ? `
                    <h2>Upcoming Tasks</h2>
                    <ul>
                        ${pendingTasks.slice(0, 5).map(task => `
                            <li>
                                <strong>${task.title}</strong>
                                ${task.dueDate ? `<br>Due: ${moment(task.dueDate).format('MMMM Do YYYY')}` : ''}
                            </li>
                        `).join('')}
                    </ul>
                ` : ''}

                <p><a href="${process.env.FRONTEND_URL}/tasks">View All Tasks</a></p>
            `
        });
    } catch (error) {
        console.error('Error sending weekly summary:', error);
    }
};

// Send task assignment notification
const sendTaskAssignmentEmail = async (task, assignee) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: assignee.email,
            subject: 'New Task Assignment',
            html: `
                <h1>New Task Assignment</h1>
                <p>Hi ${assignee.firstName},</p>
                <p>You have been assigned a new task:</p>
                <div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
                    <h2>${task.title}</h2>
                    <p>${task.description || 'No description'}</p>
                    ${task.dueDate ? `
                        <p><strong>Due:</strong> ${moment(task.dueDate).format('MMMM Do YYYY, h:mm a')}</p>
                    ` : ''}
                    <p><strong>Priority:</strong> ${task.priority}</p>
                    <p><strong>Category:</strong> ${task.category || 'Uncategorized'}</p>
                    <p><strong>Assigned by:</strong> ${task.creator.firstName} ${task.creator.lastName}</p>
                </div>
                <p><a href="${process.env.FRONTEND_URL}/tasks/${task._id}">View Task</a></p>
            `
        });
    } catch (error) {
        console.error('Error sending task assignment email:', error);
    }
};

module.exports = {
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendTaskReminder,
    sendWeeklySummary,
    sendTaskAssignmentEmail
}; 