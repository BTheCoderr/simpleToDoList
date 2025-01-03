const webpush = require('web-push');
const moment = require('moment');
const { sendTaskReminder } = require('./email');

// Configure web push if VAPID keys are available
let webpushEnabled = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    try {
        webpush.setVapidDetails(
            `mailto:${process.env.SMTP_USER}`,
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        webpushEnabled = true;
        console.log('Web Push notifications configured successfully');
    } catch (error) {
        console.log('Web Push notifications disabled:', error.message);
    }
} else {
    console.log('Web Push notifications disabled - VAPID keys not configured');
}

// Send push notification
const sendPushNotification = async (subscription, payload) => {
    if (!webpushEnabled) return false;

    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        return true;
    } catch (error) {
        console.error('Error sending push notification:', error);
        if (error.statusCode === 410) {
            // Subscription has expired or is no longer valid
            return false;
        }
        return true; // Keep subscription for other errors
    }
};

// Schedule task reminder
const scheduleReminder = async (task, user) => {
    if (!task.dueDate) return;

    const dueDate = moment(task.dueDate);
    const now = moment();
    const reminderTime = dueDate.clone().subtract(1, 'hour');

    // If due date is less than an hour away or has passed, don't schedule reminder
    if (dueDate.diff(now, 'hours') < 1) return;

    // Schedule email reminder
    setTimeout(async () => {
        await sendTaskReminder(task, user);
    }, reminderTime.diff(now));

    // Schedule push notification if enabled
    if (user.notificationPreferences.pushNotifications && user.pushSubscription) {
        setTimeout(async () => {
            const payload = {
                title: 'Task Due Soon',
                body: `Task "${task.title}" is due in 1 hour`,
                icon: '/icon.png',
                data: {
                    url: `/tasks/${task._id}`
                }
            };

            const isValid = await sendPushNotification(user.pushSubscription, payload);
            if (!isValid) {
                // Remove invalid subscription
                user.pushSubscription = null;
                await user.save();
            }
        }, reminderTime.diff(now));
    }
};

// Send task update notification
const sendTaskUpdateNotification = async (task, message, users) => {
    for (const user of users) {
        if (!user.notificationPreferences.pushNotifications || !user.pushSubscription) {
            continue;
        }

        const payload = {
            title: 'Task Update',
            body: message,
            icon: '/icon.png',
            data: {
                url: `/tasks/${task._id}`
            }
        };

        const isValid = await sendPushNotification(user.pushSubscription, payload);
        if (!isValid) {
            user.pushSubscription = null;
            await user.save();
        }
    }
};

// Send task comment notification
const sendCommentNotification = async (task, comment, users) => {
    const message = `New comment on task "${task.title}" by ${comment.user.firstName}`;
    
    for (const user of users) {
        if (!user.notificationPreferences.pushNotifications || !user.pushSubscription) {
            continue;
        }

        const payload = {
            title: 'New Comment',
            body: message,
            icon: '/icon.png',
            data: {
                url: `/tasks/${task._id}#comments`
            }
        };

        const isValid = await sendPushNotification(user.pushSubscription, payload);
        if (!isValid) {
            user.pushSubscription = null;
            await user.save();
        }
    }
};

// Send task assignment notification
const sendAssignmentNotification = async (task, assignee) => {
    if (!assignee.notificationPreferences.pushNotifications || !assignee.pushSubscription) {
        return;
    }

    const payload = {
        title: 'New Task Assignment',
        body: `You have been assigned the task "${task.title}"`,
        icon: '/icon.png',
        data: {
            url: `/tasks/${task._id}`
        }
    };

    const isValid = await sendPushNotification(assignee.pushSubscription, payload);
    if (!isValid) {
        assignee.pushSubscription = null;
        await assignee.save();
    }
};

module.exports = {
    scheduleReminder,
    sendTaskUpdateNotification,
    sendCommentNotification,
    sendAssignmentNotification
}; 