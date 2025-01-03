const { NlpManager } = require('node-nlp');
const moment = require('moment');

// Initialize NLP manager
const nlpManager = new NlpManager({ languages: ['en'] });

// Keywords that indicate priority
const priorityKeywords = {
    high: ['urgent', 'asap', 'important', 'critical', 'crucial', 'emergency', 'priority'],
    medium: ['moderate', 'normal', 'standard', 'regular'],
    low: ['low', 'minor', 'trivial', 'whenever', 'eventually']
};

// Keywords that indicate task categories
const categoryKeywords = {
    work: ['meeting', 'project', 'deadline', 'client', 'presentation', 'report'],
    personal: ['shopping', 'exercise', 'health', 'family', 'hobby', 'home'],
    study: ['homework', 'exam', 'study', 'research', 'assignment', 'class'],
    finance: ['payment', 'bill', 'budget', 'expense', 'invoice', 'tax']
};

/**
 * Process task with AI to generate suggestions
 */
async function processTaskWithAI(task) {
    try {
        const text = `${task.title} ${task.description || ''}`;
        const result = await nlpManager.process('en', text);

        return {
            suggestedPriority: await suggestPriority(text),
            suggestedDueDate: suggestDueDate(text, result.entities),
            suggestedTags: suggestTags(text, result.entities),
            confidence: calculateConfidence(result)
        };
    } catch (error) {
        console.error('Error processing task with AI:', error);
        return null;
    }
}

/**
 * Suggest priority based on text analysis
 */
async function suggestPriority(text) {
    const lowerText = text.toLowerCase();
    
    // Check for explicit priority keywords
    for (const [priority, keywords] of Object.entries(priorityKeywords)) {
        if (keywords.some(keyword => lowerText.includes(keyword))) {
            return priority;
        }
    }

    // Use NLP for sentiment analysis
    try {
        const result = await nlpManager.process('en', text);
        const sentiment = result.sentiment;
        
        // Consider urgency based on sentiment and other factors
        if (
            sentiment.score < -0.5 || // Very negative sentiment often indicates urgency
            /!+|asap|urgent|immediately/i.test(text) || // Exclamation marks or urgent words
            /(today|tomorrow|morning|afternoon)/i.test(text) // Time-sensitive words
        ) {
            return 'high';
        }
        
        if (sentiment.score > 0.2) {
            return 'low';
        }
    } catch (error) {
        console.error('Error in sentiment analysis:', error);
    }

    return 'medium'; // Default priority
}

/**
 * Suggest due date based on text analysis
 */
function suggestDueDate(text, entities) {
    // Extract date entities
    const dateEntities = entities.filter(entity => 
        entity.entity === 'date' || entity.entity === 'duration'
    );

    if (dateEntities.length > 0) {
        return moment(dateEntities[0].resolution.date).toDate();
    }

    // Look for common time expressions
    const timeExpressions = {
        'today': 0,
        'tomorrow': 1,
        'next week': 7,
        'next month': 30
    };

    const lowerText = text.toLowerCase();
    for (const [expr, days] of Object.entries(timeExpressions)) {
        if (lowerText.includes(expr)) {
            return moment().add(days, 'days').toDate();
        }
    }

    return null;
}

/**
 * Suggest tags based on text analysis
 */
function suggestTags(text, entities) {
    const tags = new Set();
    const lowerText = text.toLowerCase();

    // Add category-based tags
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => lowerText.includes(keyword))) {
            tags.add(category);
        }
    }

    // Add entity-based tags
    entities.forEach(entity => {
        if (['organization', 'person', 'location'].includes(entity.entity)) {
            tags.add(entity.utterance.toLowerCase());
        }
    });

    // Extract hashtags
    const hashtagRegex = /#(\w+)/g;
    let match;
    while ((match = hashtagRegex.exec(text)) !== null) {
        tags.add(match[1].toLowerCase());
    }

    return Array.from(tags);
}

/**
 * Calculate confidence score for AI suggestions
 */
function calculateConfidence(nlpResult) {
    let confidence = 0;

    // Base confidence on number and quality of recognized entities
    if (nlpResult.entities.length > 0) {
        confidence += 0.3;
        
        // Bonus for high-quality entities
        const highQualityEntities = nlpResult.entities.filter(e => 
            e.accuracy > 0.8 || ['date', 'duration', 'organization'].includes(e.entity)
        );
        confidence += (highQualityEntities.length / nlpResult.entities.length) * 0.3;
    }

    // Confidence based on text length and quality
    const textQuality = Math.min(
        nlpResult.utterance.split(' ').length / 10, // Longer text = better context
        1
    ) * 0.2;
    confidence += textQuality;

    // Add sentiment confidence
    if (nlpResult.sentiment) {
        confidence += Math.abs(nlpResult.sentiment.score) * 0.2;
    }

    return Math.min(confidence, 1);
}

/**
 * Process natural language date input
 */
async function processDateInput(text) {
    try {
        const result = await nlpManager.process('en', text);
        const dateEntities = result.entities.filter(entity => 
            entity.entity === 'date' || entity.entity === 'duration'
        );

        if (dateEntities.length > 0) {
            return moment(dateEntities[0].resolution.date).toDate();
        }

        // Handle relative dates
        const relativeDates = {
            'today': 0,
            'tomorrow': 1,
            'next week': 7,
            'next month': 30,
            'next year': 365
        };

        const lowerText = text.toLowerCase();
        for (const [expr, days] of Object.entries(relativeDates)) {
            if (lowerText.includes(expr)) {
                return moment().add(days, 'days').toDate();
            }
        }

        return null;
    } catch (error) {
        console.error('Error processing date input:', error);
        return null;
    }
}

module.exports = {
    processTaskWithAI,
    suggestPriority,
    suggestDueDate,
    suggestTags,
    processDateInput
}; 