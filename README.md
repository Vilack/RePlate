# RePlate — Smart Surplus Food Recovery and Redistribution Management System

RePlate is a web-based food recovery platform designed to reduce food waste by connecting food donors with NGOs and organizations that can redistribute surplus food to people in need. The platform provides food listing management, donation requests, expiry-based waste-risk indicators, and impact tracking through a centralized application.

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Objectives](#objectives)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Application Workflow](#application-workflow)
- [Waste-Risk Assessment](#waste-risk-assessment)
- [Database Design](#database-design)
- [Prerequisites](#prerequisites)
- [Local Installation](#local-installation)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Security Considerations](#security-considerations)
- [Cloud Deployment](#cloud-deployment)
- [Future Enhancements](#future-enhancements)
- [Academic Project Information](#academic-project-information)
- [License](#license)

## Overview

Food waste is a significant challenge for restaurants, food retailers, event organizers, and other establishments that frequently have surplus food. At the same time, NGOs and community organizations need efficient ways to identify and collect available food donations.

RePlate addresses this challenge through a centralized web application where donors can publish surplus food listings and NGOs can discover available donations and submit requests.

The system uses cloud-hosted backend services for authentication and data management, while its expiry-based rules help users identify food listings that require timely attention.

## Problem Statement

Traditional food donation processes often depend on phone calls, messaging applications, or manual coordination. These approaches can make it difficult to track available food, coordinate collection, monitor expiry times, and measure the impact of redistribution.

RePlate aims to streamline this process by providing a centralized platform for managing surplus food donations and coordinating their recovery.

## Objectives

- Reduce avoidable food waste by improving donation visibility.
- Connect food donors with NGOs through a centralized platform.
- Enable users to create and manage surplus food listings.
- Allow NGOs to discover eligible listings and submit donation requests.
- Highlight listings according to their remaining time before expiry.
- Provide a structured view of requests, deliveries, and redistribution impact.
- Use cloud services to support authentication, persistent data storage, and access control.

## Key Features

### 1. User Authentication

Users can access the application through its authentication interface. Authentication and user-session management are handled through Supabase Auth.

### 2. Food Listing Management

Donors can publish surplus food details, including relevant information such as the food name, quantity, location, and expiry time, according to the implemented form fields.

### 3. Food Discovery

Users can browse available food listings and identify potential donation opportunities.

### 4. Donation Requests

NGOs can submit requests for available food listings. Request status can be managed through the application's request workflow.

### 5. Expiry-Based Waste-Risk Indicators

The application evaluates the remaining time before a listing expires and displays a corresponding risk indicator. This rule-based mechanism helps users prioritize time-sensitive donations.

### 6. Dashboard

The dashboard provides a central interface for accessing the application's major functions and viewing relevant listing or request information.

### 7. Delivery and Impact Tracking

The application includes delivery and impact-related interfaces to support the tracking of food recovery activities and the presentation of project impact information.

*Note: Actual functionality depends on the configured database, authorization policies, and implemented workflows.*

## Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React | Component-based user interface |
| Build tool | Vite | Development server and production builds |
| Styling | CSS | Layout, visual design, and responsive styling |
| Authentication | Supabase Auth | User authentication and session management |
| Database | Supabase PostgreSQL | Persistent relational data storage |
| Access control | PostgreSQL Row Level Security (RLS) | Restrict data access according to configured policies |
| Version control | Git and GitHub | Source code management |
| Deployment | Vercel (planned or optional) | Hosting the frontend application |

## System Architecture

```text
                  ┌──────────────────────┐
                  │       End Users      │
                  │   Donors and NGOs    │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │   React + Vite UI    │
                  │  Frontend Application│
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │    Supabase Client   │
                  └──────────┬───────────┘
                             │
                   ┌─────────┴─────────┐
                   ▼                   ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  Supabase Auth   │  │ Supabase Database│
        │ Authentication   │  │   PostgreSQL     │
        └──────────────────┘  └──────────────────┘
                                      │
                                      ▼
                             ┌──────────────────┐
                             │   RLS Policies   │
                             │  Access Control  │
                             └──────────────────┘
```

The React frontend communicates with Supabase through the configured Supabase client. Supabase provides authentication and database services. PostgreSQL Row Level Security policies can restrict which records authenticated users are permitted to access or modify.

## Application Workflow

1. A user opens the RePlate web application.
2. The user authenticates through the configured authentication system.
3. A donor creates a listing for surplus food and specifies its expiry time.
4. The listing is stored in the backend database.
5. An NGO views eligible listings and identifies suitable donations.
6. The NGO submits a request for a listing.
7. Users manage requests and associated recovery activities through the application's available interfaces.
8. Expiry-based indicators help prioritize food that requires timely collection.

## Waste-Risk Assessment

RePlate uses a **rule-based expiry assessment**, rather than a trained machine-learning model.

The system calculates the time remaining before a food listing expires and categorizes it according to configured thresholds.

An example rule set is:

| Remaining time | Example risk level | Interpretation |
|---|---|---|
| 48 hours or less | High | Requires urgent attention |
| More than 48 and up to 96 hours | Medium | Should be prioritized |
| More than 96 hours | Low | Less urgent based on expiry time |
| Expired | Expired | No longer eligible under the applicable expiry rules |

The exact behavior depends on the thresholds and eligibility rules implemented in the application.

**Important:** Expiry-based indicators are prioritization aids, not food-safety certification. Actual food safety depends on factors such as storage temperature, handling, packaging, and the type of food.

## Database Design

The database uses Supabase PostgreSQL. The repository includes SQL files intended for database setup and migration.

- `database/schema.sql` — base database schema.
- `database/ft3_migration.sql` — project migration script.

Review these scripts before execution to identify the tables, constraints, relationships, indexes, and Row Level Security policies they define.

The application uses the configured Supabase schema to support authentication-linked user data, food listings, donation requests, and related project workflows.



## Prerequisites

Install the following before running the project:

- [Node.js](https://nodejs.org/) — preferably an LTS version compatible with the project dependencies.
- npm — included with Node.js.
- [Git](https://git-scm.com/).
- A [Supabase](https://supabase.com/) project with the required database schema and authentication configuration.

## Local Installation

### 1. Clone the repository

```bash
git clone https://github.com/Vilack/RePlate.git
cd RePlate
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Configure environment variables

Create a file named `.env` inside the `frontend` directory. Add the Supabase URL and the publishable key, or legacy anon key, required by the application.

See [Environment Configuration](#environment-configuration) below.

### 4. Configure the database

Create or select a Supabase project. Review the SQL files in the `database/` directory and apply the appropriate schema and migration scripts in the correct order.

### 5. Start the development server

```bash
npm run dev
```

Vite will display a local development URL, typically:

`http://localhost:5173/`

Open the URL in your browser.

## Environment Configuration

The Supabase client configuration is located in:

`frontend/src/lib/supabaseClient.js`

Use environment variable names that match the names referenced in that file. For example, if the client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, create `frontend/.env` with:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Replace the placeholders with your actual project values. If your code uses different variable names, use those names instead.

Vite exposes variables prefixed with `VITE_` to frontend code. Therefore, **never place a Supabase service-role key, database password, or other privileged secret in a `VITE_` variable**.

Do not commit `.env` files to GitHub. Keep the actual values in your local environment and in the hosting provider's environment-variable settings.

## Database Setup

1. Create a project in Supabase.
2. Open the SQL Editor in the Supabase dashboard.
3. Review `database/schema.sql` and apply it if it matches your intended initial schema.
4. Review `database/ft3_migration.sql` and apply it only if the migration is appropriate for that schema and has not already been applied.
5. Confirm that required tables, relationships, and Row Level Security policies exist.
6. Configure the authentication settings and any required user roles.
7. Test listing creation, listing discovery, donation requests, and authorization behavior with suitable test accounts.

Do not run both SQL files blindly: a migration may duplicate existing tables or modify existing data.

## Running the Application

From the `frontend/` directory:

### Development

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Preview the production build locally

```bash
npm run preview
```

A successful production build verifies that Vite can compile the frontend. It does not, by itself, verify database connectivity, authentication, or every application workflow.

## Security Considerations

- Use Supabase Auth for authentication where configured.
- Enable and verify appropriate Row Level Security policies for tables accessible from the frontend.
- Validate user permissions on the database side rather than relying only on hidden UI elements.
- Never expose the Supabase service-role key or database credentials in frontend code.
- Keep `.env` files and other secrets out of version control.
- Use test accounts to verify that users cannot access or modify records outside their permissions.
- Review file uploads, input validation, and authorization rules before deploying publicly.

## Cloud Deployment

The frontend can be deployed using a hosting service such as Vercel, while Supabase provides the backend services.

A typical deployment process is:

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Set the Vercel project root directory to `frontend`.
4. Configure the production build command as `npm run build`.
5. Configure the output directory as `dist`.
6. Add the required Supabase environment variables in Vercel.
7. Deploy the application.
8. Configure the Supabase authentication site URL and allowed redirect URLs for the deployed domain.
9. Test authentication, listing operations, requests, and RLS behavior on the public deployment.

A public website is not fully operational until its Supabase configuration, schema, authorization policies, and environment variables are set up correctly.

## Future Enhancements

Potential future improvements include:

- Notifications for food listings approaching expiry.
- Advanced search and filtering by location, food type, and quantity.
- Improved pickup and delivery coordination.
- Maps and location-based discovery.
- Analytics for food recovered, donations completed, and organizations served.
- Audit logs and administrative reporting.
- Optional predictive models, if supported by an appropriate dataset and validated implementation.

## Academic Project Information

**Project Name:** RePlate — Smart Surplus Food Recovery and Redistribution Management System

**Project Type:** Cloud Computing project

**Primary Objective:** Apply cloud-based application architecture to improve surplus food donation coordination and redistribution.

The project demonstrates a React-based frontend integrated with cloud backend services, relational data management, authentication, access-control concepts, and rule-based expiry assessment.

Project reports, migration scripts, and viva preparation material are available in the `docs/` and `database/` directories.

## License

This project is distributed under the license specified in the repository's `LICENSE` file. Review that file for the applicable permissions and conditions.
