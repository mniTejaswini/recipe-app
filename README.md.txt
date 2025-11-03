Recipe Finder App

A full-stack web application built using React (frontend)and Flask (backend) that helps users find recipes by ingredients using TheMealDB API.

---

Project Overview

->Features
- Search recipes by ingredient  
- View recipe details (image, ingredients, instructions)  
- Add or remove recipes from favorites  
- Responsive and clean UI built with React  
- Flask backend serves REST APIs  

Tech Stack
- Frontend: React, JavaScript, CSS  
- Backend: Flask (Python)  
- API: TheMealDB  
- Database: MySQL  

---

How to Run This Project Locally

1. Backend Setup (Flask)

# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
.venv\Scripts\activate           (On Windows)
# OR
source venv/bin/activate         (On Mac/Linux)

# Install dependencies
pip install -r requirements.txt

# Run Flask server
python app.py



2.Frontend Setup (React)

# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Run React app
npm start


--> Important:
In your frontend/src/App.js, make sure the base URL points to your backend


-> Usage

> Start the Flask backend (python app.py)

> Start the React frontend (npm start)

> Open your browser and go to http://localhost:3000

> Search for any ingredient like chicken, egg, or rice

> View recipes fetched from TheMealDB API


--> Folder Structure

recipe-finder/
│
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── .env
│   ├── config.py
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── package-lock.json
│
└── README.md

-> Run both backend and frontend simultaneously for the full experience!