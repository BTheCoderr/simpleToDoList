const { google } = require('googleapis');
const moment = require('moment');

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

/**
 * Add task to user's calendar
 */
async function addToCalendar(task, user) {
    if (!user.notificationPreferences.calendar.enabled || !task.dueDate) {
        return null;
    }

    try {
        // Set credentials
        oauth2Client.setCredentials({
            access_token: user.notificationPreferences.calendar.accessToken,
            refresh_token: user.notificationPreferences.calendar.refreshToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Calculate event duration (default to 1 hour if not specified)
        const startTime = moment(task.dueDate);
        const endTime = moment(task.dueDate).add(1, 'hour');

        // Create calendar event
        const event = {
            summary: task.title,
            description: `${task.description || ''}\n\nPriority: ${task.priority}\nCategory: ${task.category || 'Uncategorized'}\n\nView task: ${process.env.APP_URL}/tasks/${task._id}`,
            start: {
                dateTime: startTime.toISOString(),
                timeZone: user.timezone
            },
            end: {
                dateTime: endTime.toISOString(),
                timeZone: user.timezone
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 }, // 1 day before
                    { method: 'popup', minutes: 30 } // 30 minutes before
                ]
            },
            colorId: getColorIdForPriority(task.priority)
        };

        // If updating existing event
        if (task.calendarEventId) {
            const updatedEvent = await calendar.events.update({
                calendarId: 'primary',
                eventId: task.calendarEventId,
                resource: event
            });
            return updatedEvent.data.id;
        }

        // Create new event
        const createdEvent = await calendar.events.insert({
            calendarId: 'primary',
            resource: event
        });

        return createdEvent.data.id;
    } catch (error) {
        console.error('Error adding to calendar:', error);
        
        // Handle token expiration
        if (error.code === 401) {
            try {
                const { tokens } = await oauth2Client.refreshToken(
                    user.notificationPreferences.calendar.refreshToken
                );
                
                // Update user's tokens
                user.notificationPreferences.calendar.accessToken = tokens.access_token;
                if (tokens.refresh_token) {
                    user.notificationPreferences.calendar.refreshToken = tokens.refresh_token;
                }
                await user.save();

                // Retry adding to calendar
                return addToCalendar(task, user);
            } catch (refreshError) {
                console.error('Error refreshing token:', refreshError);
                // Disable calendar integration if refresh fails
                user.notificationPreferences.calendar.enabled = false;
                await user.save();
            }
        }
        return null;
    }
}

/**
 * Remove task from user's calendar
 */
async function removeFromCalendar(task, user) {
    if (!task.calendarEventId || !user.notificationPreferences.calendar.enabled) {
        return;
    }

    try {
        oauth2Client.setCredentials({
            access_token: user.notificationPreferences.calendar.accessToken,
            refresh_token: user.notificationPreferences.calendar.refreshToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        await calendar.events.delete({
            calendarId: 'primary',
            eventId: task.calendarEventId
        });
    } catch (error) {
        console.error('Error removing from calendar:', error);
    }
}

/**
 * Update task in user's calendar
 */
async function updateCalendarEvent(task, user) {
    if (!user.notificationPreferences.calendar.enabled) {
        return null;
    }

    // Remove existing event if due date is removed
    if (!task.dueDate && task.calendarEventId) {
        await removeFromCalendar(task, user);
        return null;
    }

    // Add or update event
    return addToCalendar(task, user);
}

/**
 * Get Google Calendar color ID based on task priority
 */
function getColorIdForPriority(priority) {
    // Google Calendar color IDs:
    // 1: Blue (default)
    // 2: Green
    // 3: Purple
    // 4: Red
    // 5: Yellow
    // 6: Orange
    // 7: Turquoise
    // 8: Gray
    // 9: Bold Blue
    // 10: Bold Green
    // 11: Bold Red
    switch (priority) {
        case 'high':
            return '4'; // Red
        case 'medium':
            return '6'; // Orange
        case 'low':
            return '2'; // Green
        default:
            return '1'; // Blue
    }
}

/**
 * Initialize calendar integration for user
 */
async function initializeCalendarIntegration(code, user) {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        
        user.notificationPreferences.calendar = {
            enabled: true,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token
        };
        
        await user.save();
        return true;
    } catch (error) {
        console.error('Error initializing calendar integration:', error);
        return false;
    }
}

/**
 * Get calendar authorization URL
 */
function getAuthUrl() {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar.events']
    });
}

/**
 * Sync all tasks to calendar
 */
async function syncTasksToCalendar(tasks, user) {
    if (!user.notificationPreferences.calendar.enabled) {
        return;
    }

    try {
        for (const task of tasks) {
            if (task.dueDate && !task.calendarEventId) {
                const eventId = await addToCalendar(task, user);
                if (eventId) {
                    task.calendarEventId = eventId;
                    await task.save();
                }
            }
        }
    } catch (error) {
        console.error('Error syncing tasks to calendar:', error);
    }
}

module.exports = {
    addToCalendar,
    removeFromCalendar,
    updateCalendarEvent,
    initializeCalendarIntegration,
    getAuthUrl,
    syncTasksToCalendar
}; 