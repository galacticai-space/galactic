# Galatic

An interactive 3D universe visualization for transaction data, built with React, Three.js, and Node.js.

## Three.js Setup

1. Install Three.js and required dependencies:
```bash
npm install three @react-three/fiber @react-three/drei
```

2. Optional performance packages:
```bash
npm install r3f-perf @react-three/postprocessing
```

## Quick Start

1. Clone the repository
2. Install dependencies:
```bash
cd server
npm install
cd ../client
npm install
```

3. Start the application:

Server:
```bash
cd server
node server.js
```

Client:
```bash
cd client
npm run dev
```

Database Interface:
```bash
npx prisma studio
```

## Features

- **3D Universe Visualization**: Explore transactions as planets within star systems
- **Real-time Updates**: Live transaction visualization
- **Interactive Navigation**: Pan, zoom, and explore the universe
- **Performance Optimized**: 
  - Frustum culling
  - Chunk-based loading
- **User Interface**:
  - Interactive minimap
  - Transaction analytics dashboard
  - Background music toggle
  - Direct links to Solscan for transaction details

## Tech Stack

- Frontend: React (Vite)
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma
- 3D Graphics: Three.js (WebGL)

## Project Structure

```
galaxy-project/
├── client/         # React frontend
├── server/         # Node.js backend
└── prisma/         # Database schema and migrations
```
