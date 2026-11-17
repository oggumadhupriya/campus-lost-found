
# Campus Lost and Found Portal

## Project Overview
Campus Lost and Found Portal is a full-stack web application that helps students report lost and found items within the college campus. Students can search for items, submit ownership claims, and track the recovery status of their belongings.

## Technologies Used
- HTML5
- CSS3
- JavaScript (ES6)
- Node.js
- Express.js
- MongoDB
- Postman

## Features
- Student registration and login
- Secure user authentication
- Report lost and found items
- Upload item images
- View recently reported items
- Search and filter items
- Submit ownership claims
- View submitted claims
- Approve or reject claims
- Track item recovery status

## Project Structure

```text
webtechnology/
│
├── public/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── login.html
│   └── register.html
│
├── uploads/
├── server.js
├── package.json
├── package-lock.json
├── .env
└── README.md
```

## Installation and Setup

1. Clone or download the project.
2. Open the project folder in VS Code.
3. Install dependencies:

```bash
npm install
```

4. Create a `.env` file and configure your MongoDB connection string and session secret.
5. Start the server:

```bash
node server.js
```

6. Open the application:

```text
http://localhost:3000
```

## Database
MongoDB is used to store student accounts, reported items, claims, and recovery information.

## Project Purpose
The main purpose of this application is to make lost and found item management easier, faster, and more organized within a college campus.
