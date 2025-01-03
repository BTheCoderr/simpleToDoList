const { NlpManager } = require('node-nlp');

async function trainNLP() {
    const manager = new NlpManager({
        languages: ['en'],
        nlu: { useNoneFeature: false }
    });

    // Add entities
    manager.addRegexEntity('priority', 'en', /high|urgent|asap|important|critical|crucial/i);
    manager.addRegexEntity('priority', 'en', /medium|normal|moderate|standard/i);
    manager.addRegexEntity('priority', 'en', /low|minor|trivial|whenever/i);

    manager.addRegexEntity('category', 'en', /meeting|project|deadline|presentation/i);
    manager.addRegexEntity('category', 'en', /shopping|exercise|health|family/i);
    manager.addRegexEntity('category', 'en', /homework|exam|study|research/i);
    manager.addRegexEntity('category', 'en', /payment|bill|budget|expense/i);

    // Add date/time entities
    manager.addRegexEntity('date', 'en', /today|tomorrow|next week|next month/i);
    manager.addRegexEntity('time', 'en', /morning|afternoon|evening|night/i);

    // Train for task creation
    manager.addDocument('en', 'Create a new task for %category%', 'task.create');
    manager.addDocument('en', 'Add a %priority% priority task', 'task.create');
    manager.addDocument('en', 'Schedule a meeting for tomorrow', 'task.create');
    manager.addDocument('en', 'Remind me to %activity% next week', 'task.create');

    // Train for task queries
    manager.addDocument('en', 'Show my tasks for today', 'task.list');
    manager.addDocument('en', 'What are my pending tasks', 'task.list');
    manager.addDocument('en', 'List all %priority% priority tasks', 'task.list');
    manager.addDocument('en', 'Show %category% tasks', 'task.list');

    // Train for task updates
    manager.addDocument('en', 'Mark task as complete', 'task.update');
    manager.addDocument('en', 'Change priority to %priority%', 'task.update');
    manager.addDocument('en', 'Reschedule task to next week', 'task.update');
    manager.addDocument('en', 'Move task to %category%', 'task.update');

    // Add responses
    manager.addAnswer('en', 'task.create', "I'll help you create a new task.");
    manager.addAnswer('en', 'task.list', 'Here are your tasks:');
    manager.addAnswer('en', 'task.update', "I'll update the task for you.");

    console.log('Training NLP model...');
    await manager.train();
    console.log('NLP model trained!');

    return manager;
}

module.exports = {
    trainNLP
}; 