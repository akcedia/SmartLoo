# Project Charter: SmartLoo

## 1. Project Purpose and Objectives
This project aims to develop a centralized web and mobile platform that aggregates and presents information regarding the locations, hygiene status, and accessibility features (e.g., disabled access, baby care rooms) of public toilets in Istanbul. The system will utilize external data sources and generative AI to provide smart routing for users and detailed data analytics via a dashboard for administrators.

## 2. Stakeholders & Roles
* **Product Owner:** Özgür Kılıç[cite: 6]
* **Software Engineering Team:** 
  * Özgür Kılıç : Project Manager & Team Contact (Backend API Developer)
  * Yusuf Selim Aksu : QA, Cloud & DevOps Engineer (Test and CI/CD Manager)
  * Emir Miraç İslamoğlu : AI Pipeline & Integration Engineer (AI and API Specialist)
  * Fırat Karadoğan : Database Architect & Security Engineer (SQL/NoSQL and Auth Specialist)
  * Onur Arda Buldağ: Web Frontend & Analytics Developer (Dashboard Designer)
  * Ahmet Furkan Yardımcı : Map UX & Interactive Web Developer (End-User Web App & Map Integration)
* **GH Repo/Project URL:** https://github.com/akcedia/SmartLoo

## 3. Project Scope
### Project domain
Smart City Management, Public Health, and Geographic Information Systems (GIS). The possible customers are local municipalities and facility management companies who need actionable data on sanitation. The key users of the system include city residents, tourists, and commuters who seek nearby, accessible, and clean public toilets, as well as municipal administrators and cleaning managers who monitor hygiene statistics and user feedback via the analytics dashboard.

### In-Scope
* Gathering toilet location and metadata from external APIs.
* User rating/review system and password/JWT-based authentication.
* Web-based analytics dashboard offering statistics, tables, and charts with date-based filtering for managers.
* Batch data input in CSV/JSON format and export of analysis reports.
* Summarizing reviews and providing smart recommendations to users based on preferences using AI agents/pipelines.
* Allowing users to add new toilet locations that are not currently on the map.

### Out-of-Scope
* Complex shift or salary optimization (scheduling) for cleaning staff.
* Real-time occupancy or supply detection via IoT hardware sensors.
* In-app integrated payment or wallet systems.

## 4. Technology Stack
### Backend Stack
* **FastAPI** (Service layer to manage core business logic and AI integrations).
* **PostgreSQL** (Relational database for storing toilet properties and user accounts).
* **PostGIS** (Extension for processing spatial queries and distance calculations for the map).
* **MongoDB** (NoSQL database for flexible storage of long user reviews).
* **Redis** (Cache pool to retrieve frequently queried statistics and analyses rapidly).
* **JWT** (Encrypted token system for secure user authentication and role-based authorization).

### Frontend Stack
* **React.js** (Visual library to build the analytical dashboard for managers and the web UI for users).
* **Leaflet.js** (Tool to render the interactive map displaying toilet locations).

### Infrastructure & Quality
* **Cloud Hosting** (To host the provided services and databases in a live environment).
* **GitHub (Issue tracking, version control)** (Utilized for code repository management, collaborative development, and task tracking via GitHub Projects).
* **CI/CD Pipelines** (For automated code integration, testing, and deployment workflows).
* **Test-Driven Development (TDD) methodology** (Development approach ensuring code reliability by requiring functional and non-functional tests to be written alongside the requirements)

### AI Stack
- Antigravity (Serves as our primary code generation and debugging assistant. It will be heavily utilized throughout the development lifecycle to write boilerplate code, troubleshoot logic errors, and accelerate the implementation of both the FastAPI backend and React.js frontend).
- Gemini (Acts as our research and project management consultant. We will frequently use Gemini to brainstorm architectural decisions, formulate BDD-style requirements, research optimal integration strategies for external APIs, and manage our task workflows effectively).
- Integrated AI Pipeline / OpenAI API (Embedded directly into our backend service as our core AI pipeline. These custom agents will process and summarize unstructured user reviews and power the smart recommendation engine, fulfilling the requirement to present a working AI pipeline at the end of the term).

## 5. Project Milestones
| Deliverable                      | Deadline           |
|----------------------------------|--------------------|
| Project Charter                  | 02.10.2026 23:59   |
| Requirements Definition Report   | 11.10.2026 23:59   |
| Requirement Analysis Report      | 18.10.2026 23:59   |
| Software Design Report           | 15.11.2026 23:59   |
| Software Testing Report          | 22.11.2026 23:59   |
| Codebase                         | 30.11.2026 23:59   |
| Presentation                     | TBA (see sched.)   |