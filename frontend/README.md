# RygtusBuild Frontend

A modern, developer-focused dashboard for building CI/CD pipelines visually. Built with Next.js 14+, Tailwind CSS, and Shadcn/UI.

## Features

- **GitHub Authentication**: Connect seamlessly via OAuth.
- **Repository Selection**: Browse and search your GitHub repositories.
- **Visual Pipeline Builder**: Drag-and-drop interface to configure CI/CD steps.
- **Smart Analysis**: Automatically suggests pipeline steps based on repo tech stack (Node.js, Python, Docker, etc.).
- **Automatic Commits**: Generates and pushes `.github/workflows/ci.yml` directly to your repo.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn/UI (Radix Primitives)
- **State/Interactions**: React Hooks, `@dnd-kit` for drag-and-drop.
- **Icons**: Lucide React.

## Getting Started

1. **Prerequisites**
   - Ensure the Backend is running on `http://localhost:8000`.
   - Node.js 18+ installed.

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

4. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx             # Landing Page
│   ├── connect/             # Auth Page
│   ├── repos/               # Repo Selection
│   ├── pipeline/            # Builder Page
│   ├── commit/              # Success Page
│   └── globals.css          # Global Styles (Tailwind v4)
├── components/
│   └── ui/                  # Reusable Shadcn Components
├── lib/
│   ├── api.ts               # API Client (Axios)
│   └── utils.ts             # CN Utility
└── public/                  # Static Assets
```
