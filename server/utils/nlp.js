const { NlpManager } = require('node-nlp');
const moment = require('moment');

// Initialize NLP manager
const manager = new NlpManager({ languages: ['en'] });

// Add priority patterns
manager.addRegexEntity('priority', 'en', /\b(high|medium|low)\b priority/i);
manager.addRegexEntity('priority', 'en', /\b(urgent|critical|important)\b/i);

// Add category patterns
manager.addRegexEntity('category', 'en', /\b(work|personal|shopping|health|finance|study)\b/i);

// Add date patterns
manager.addRegexEntity('date', 'en', /\b(today|tomorrow|next week|next month)\b/i);
manager.addRegexEntity('date', 'en', /\b(\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(\s+\d{4})?)\b/i);
manager.addRegexEntity('date', 'en', /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);

// Add time patterns
manager.addRegexEntity('time', 'en', /\b(\d{1,2}:\d{2})\s*(am|pm)?\b/i);
manager.addRegexEntity('time', 'en', /\b(noon|midnight|morning|afternoon|evening)\b/i);

// Train the manager
(async () => {
    await manager.train();
    console.log('NLP manager trained');
})();

// Process task text
const processTaskText = async (text) => {
    try {
        const result = await manager.process('en', text);
        const metadata = {
            priority: null,
            category: null,
            dueDate: null
        };

        // Process priority
        const priorityEntity = result.entities.find(e => e.entity === 'priority');
        if (priorityEntity) {
            const value = priorityEntity.sourceText.toLowerCase();
            if (value.includes('urgent') || value.includes('critical')) {
                metadata.priority = 'high';
            } else if (value.includes('important')) {
                metadata.priority = 'medium';
            } else if (value.includes('high') || value.includes('medium') || value.includes('low')) {
                metadata.priority = value.split(' ')[0];
            }
        }

        // Process category
        const categoryEntity = result.entities.find(e => e.entity === 'category');
        if (categoryEntity) {
            metadata.category = categoryEntity.sourceText.toLowerCase();
        }

        // Process date and time
        const dateEntity = result.entities.find(e => e.entity === 'date');
        const timeEntity = result.entities.find(e => e.entity === 'time');

        if (dateEntity) {
            const dateText = dateEntity.sourceText.toLowerCase();
            let date;

            if (dateText === 'today') {
                date = moment();
            } else if (dateText === 'tomorrow') {
                date = moment().add(1, 'day');
            } else if (dateText === 'next week') {
                date = moment().add(1, 'week');
            } else if (dateText === 'next month') {
                date = moment().add(1, 'month');
            } else if (/^(mon|tues|wednes|thurs|fri|satur|sun)day$/.test(dateText)) {
                date = moment().day(dateText);
                if (date.isBefore(moment())) {
                    date.add(1, 'week');
                }
            } else {
                // Try to parse specific date
                date = moment(dateText, [
                    'DD MMM YYYY',
                    'DD MMM',
                    'D MMM YYYY',
                    'D MMM'
                ]);
            }

            if (date.isValid()) {
                if (timeEntity) {
                    const timeText = timeEntity.sourceText.toLowerCase();
                    if (timeText === 'noon') {
                        date.hour(12).minute(0);
                    } else if (timeText === 'midnight') {
                        date.hour(0).minute(0);
                    } else if (timeText === 'morning') {
                        date.hour(9).minute(0);
                    } else if (timeText === 'afternoon') {
                        date.hour(14).minute(0);
                    } else if (timeText === 'evening') {
                        date.hour(18).minute(0);
                    } else {
                        // Try to parse specific time
                        const timeParts = timeText.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
                        if (timeParts) {
                            let hour = parseInt(timeParts[1]);
                            const minute = parseInt(timeParts[2]);
                            const meridiem = timeParts[3]?.toLowerCase();

                            if (meridiem === 'pm' && hour < 12) {
                                hour += 12;
                            } else if (meridiem === 'am' && hour === 12) {
                                hour = 0;
                            }

                            date.hour(hour).minute(minute);
                        }
                    }
                } else {
                    // Default to 9 AM if no time specified
                    date.hour(9).minute(0);
                }

                metadata.dueDate = date.toDate();
            }
        }

        return metadata;
    } catch (error) {
        console.error('Error processing task text:', error);
        return {
            priority: null,
            category: null,
            dueDate: null
        };
    }
};

module.exports = {
    processTaskText
}; 