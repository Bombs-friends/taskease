# TaskEase 📋

A modern, beautiful task management app with deadline tracking and smart notifications.

## Features ✨
- ✅ Kanban board layout (Pending & Done)
- 📅 Date and time-based deadlines
- ⏰ Smart notifications every 5 hours before deadline
- 🎨 Beautiful light theme with responsive design
- 🔍 Real-time search functionality
- 📱 Mobile-friendly interface

## Local Development

### Prerequisites
- Node.js 18+ installed on your machine
- npm (comes with Node.js)

### Installation
1. Clone the repository
   ```bash
   git clone https://github.com/YOUR_USERNAME/taskease.git
   cd taskease
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Start the development server
   ```bash
   npm start
   ```

4. Open your browser and visit `http://localhost:3000`

## Deployment to Vercel

### Step 1: Push to GitHub
1. Go to [github.com](https://github.com) and sign up/log in
2. Click **"New"** to create a new repository
3. Name it `taskease`
4. **Don't** initialize with README (we already have one)
5. Click **"Create repository"**

### Step 2: Push Your Code
In your project directory, run these commands:

```bash
git init
git add .
git commit -m "Initial commit: TaskEase app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/taskease.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### Step 3: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **"New Project"**
3. Select your `taskease` repository
4. Vercel will auto-detect it's a Node.js app
5. Click **"Deploy"**

Your app will be live at a URL like: `https://taskease-abc123.vercel.app`

## Making Changes & Auto-Deploy

1. Edit files locally
   ```bash
   # Make your changes in VS Code
   ```

2. Commit and push to GitHub
   ```bash
   git add .
   git commit -m "Description of changes"
   git push
   ```

3. Vercel automatically redeploys (takes ~30-60 seconds)

Your changes will be live automatically! 🚀

## File Structure
```
taskease/
├── server.js           # Express server
├── package.json        # Project configuration
├── vercel.json         # Vercel deployment config
├── public/
│   ├── index.html      # Main HTML file
│   ├── script.js       # Frontend JavaScript
│   └── style.css       # Styling
└── .gitignore          # Git ignore rules
```

## Tech Stack
- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript
- **Styling**: CSS3
- **Deployment**: Vercel

## Notes
- Tasks are stored in memory (reset on server restart)
- For persistent storage, consider adding a database (MongoDB, PostgreSQL, etc.)
- All data is private to your deployment

## Support
For issues or questions, check the code comments or reach out!

---

**Happy task managing! 🎯**
