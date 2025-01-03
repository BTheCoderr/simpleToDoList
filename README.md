# Enhanced Task Manager

A modern, feature-rich task management application built with Node.js, Express, and vanilla JavaScript.

## Features

- **User Authentication**
  - Register and login functionality
  - JWT-based authentication
  - Secure password handling

- **Task Management**
  - Create, read, update, and delete tasks
  - Set task priorities (Low, Medium, High)
  - Add categories and due dates
  - Task status tracking (Pending, In Progress, Completed)

- **Analytics Dashboard**
  - Real-time task statistics
  - Visual charts for task distribution
  - Completion rate tracking
  - Due tasks monitoring

- **Modern UI**
  - Clean and responsive design
  - Interactive task cards
  - Priority-based color coding
  - Bootstrap 5 components

## Tech Stack

- **Frontend:**
  - HTML5
  - CSS3
  - JavaScript (Vanilla)
  - Bootstrap 5
  - Chart.js

- **Backend:**
  - Node.js
  - Express.js
  - MongoDB
  - JWT Authentication

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/simpleToDoList.git
   cd simpleToDoList
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   PORT=4000
   MONGODB_URI=mongodb://localhost:27017/task-manager
   JWT_SECRET=your-secret-key-here
   FRONTEND_URL=http://localhost:8000
   APP_URL=http://localhost:4000
   ```

4. **Start the servers**
   ```bash
   # Start backend server (Terminal 1)
   npm run dev

   # Start frontend server (Terminal 2)
   python3 -m http.server 8000
   ```

5. **Access the application**
   Open your browser and navigate to `http://localhost:8000`

## Project Structure

```
simpleToDoList/
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── api.js
│   │   └── app.js
│   └── index.html
├── server/
│   ├── routes/
│   │   ├── auth.js
│   │   └── tasks.js
│   └── utils/
│       ├── email.js
│       └── notifications.js
├── .env
├── package.json
├── README.md
└── server.js
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create new task
- `GET /api/tasks/:id` - Get task by ID
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Bootstrap for the UI components
- Chart.js for analytics visualization
- Express.js team for the excellent framework
