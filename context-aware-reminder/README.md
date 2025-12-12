# Context-Aware Reminder App

A full-stack application that transforms multi-modal notes (text, image, audio, video) into actionable tasks using simulated AI, Graphs, and Vector Search.

## 🧱 Tech Stack

- **Frontend:** React, Vite, TypeScript, TailwindCSS
- **Backend:** Python FastAPI
- **Database:** Neo4j (Graph), ChromaDB (Vector)
- **Processing:** ffmpeg (Video/Audio)

## 🐳 Deployment (Docker)

The easiest way to run the full application (Frontend + Backend + Database) is using Docker Compose.

### Prerequisites
- Docker and Docker Compose installed on your machine.

### Run Instructions

1. Navigate to the project folder:
   ```bash
   cd context-aware-reminder
   ```

2. Start the services:
   ```bash
   docker-compose up --build
   ```

3. Access the application:
   - **Frontend (App):** [http://localhost](http://localhost)
   - **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Neo4j Browser:** [http://localhost:7474](http://localhost:7474) (Auth: `neo4j`/`password`)

4. To stop the application:
   ```bash
   docker-compose down
   ```

## 🚀 Local Development Setup

If you prefer running services individually for development:

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Install FFmpeg**: Ensure `ffmpeg` is installed on your system and in your PATH.
   - macOS: `brew install ffmpeg`
   - Windows: Download from website and add to PATH.

4. **Neo4j**: Ensure a Neo4j instance is running (e.g., via Neo4j Desktop or Docker).
   ```bash
   docker run -p 7474:7474 -p 7687:7687 --env NEO4J_AUTH=neo4j/password neo4j:latest
   ```

5. Configure Environment:
   - Rename `.env.example` to `.env`.
   - Update `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` if necessary.

6. Run the Server:
   ```bash
   uvicorn app.main:app --reload
   ```
   Server will start at `http://localhost:8000`.

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   App will start at `http://localhost:5173`.

## 🧪 Demo Flow

1. **Dashboard**: Open the app. You'll see system stats.
2. **Create Note**: Go to `/new`.
   - Select **Text** tab.
   - Enter: "I need to return my Amazon package when I go near UPS and pick up medicines from CVS tonight at 8."
   - Click **Process**.
   - Watch the AI (Simulated) extract "Return Amazon Package" and "Pick up medicines" tasks.
3. **Tasks**: Go to `/tasks`.
   - Filter by "Location Based" to see the UPS task.
   - Filter by "High Priority" to see the CVS task.
4. **Search**: Go to `/search`.
   - Type "pharmacy" or "amazon".
   - The system uses Vector Search to find the relevant content even if exact keywords differ slightly (simulated embeddings).
5. **Context Check**:
   - On Dashboard, toggle location to "Driving" then back to "Home".
   - If it's a trash day, you will be reminded. If you have an incomplete grocery task, the app will suggest delivery options.

## ⚠️ Notes

- **AI Simulation**: The `extraction.py` and `db_chroma.py` files contain TODO comments marking where real Gemini API calls should go. Currently, they use keyword heuristics and random vectors for demonstration purposes.
- **Video Processing**: Video uploads utilize `ffmpeg-python` to extract audio before transcription.
