# Event Pass & Verification System

## Overview

This project was developed in just 2 days to support a large-scale college event, efficiently managing over 2,000 simultaneous registrations. It comprises two web applications and a unified backend, all designed to streamline the event entry process and ensure seamless verification.

The system features a dynamic Pass Generator that produces student passes complete with QR codes, personal details, photos, and signatures. Complementing this is a Scanner App that allows college officials to perform real-time QR code verifications. To manage data effectively, the system uses MongoDB for registrations and integrates the Google Drive API for storing PDF copies of the passes.

## Key Features

- **Pass Generator:** Creates student passes with QR codes, user details, photo, and signature.
- **Scanner App:** Enables real-time verification of QR codes for efficient event entry.
- **Unified Data Management:** Utilizes MongoDB for handling registration data.
- **Cloud Integration:** Uses the Google Drive API to store PDF copies of generated passes.

## Technologies Used

- **Frontend:** JavaScript, React
- **Backend:** Node.js, Express
- **Database:** MongoDB
- **API Integration:** Google Drive API
