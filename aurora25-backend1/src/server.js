const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const { Readable } = require("stream");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const User = require("./mongodb.js");
require("dotenv").config();
const { google } = require("googleapis");
const multer = require("multer");

const app = express();

// --- Security Middlewares ---
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// Set secure HTTP headers
app.use(helmet());

const MAX_RETRIES = 5;
const RETRY_DELAY = 1000; // 1 second delay between retries

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Enable Cross-Origin Resource Sharing
const corsOptions = {
    origin: ["https://aurora25-passgen.vercel.app", "http://localhost:3000", "https://aurora25-qrscan.vercel.app"],
};

app.use(cors(corsOptions));
// Parse incoming JSON requests
app.use(express.json());

// Apply rate limiting to all requests (e.g., 100 requests per 15 minutes per IP)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many requests from this IP, please try again later.",
});

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        // --- Start the Server ---
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
        console.log("Connected to MongoDB");
    })
    .catch((err) => console.error("Could not connect to MongoDB", err));

// Google drive
const key = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "base64").toString("utf-8"));
const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });


async function uploadToDriveWithRetry(drive, fileMetadata, mediaData, maxRetries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await drive.files.create({
                resource: fileMetadata,
                media: mediaData,
                fields: "id, name, parents",
            });
            return response;
        } catch (error) {
            if (attempt === maxRetries) {
                throw new Error(`Failed to upload after ${maxRetries} attempts: ${error.message}`);
            }
            console.log(`Upload attempt ${attempt} failed. Retrying in ${RETRY_DELAY / 1000} seconds...`);
            await delay(RETRY_DELAY);
        }
    }
}

// --- Endpoints ---
app.post("/api/uploadPdf", upload.single("pdf"), async (req, res) => {
    try {
        // Check the uploaded file
        if (!req.file) {
            return res.status(400).json({ error: "No PDF file uploaded." });
        }

        // We can also read the extra fields: email, rollNumber
        const { email, rollNumber } = req.body;
        console.log("Received from client:", { email, rollNumber });

        const user = await User.findOne({ email: email });

        // Convert the PDF buffer to a stream
        const pdfBuffer = req.file.buffer;
        const stream = Readable.from(pdfBuffer);

        // Set the file metadata
        const fileMetadata = {
            name: `aurora25-${rollNumber}-pass.pdf`,
            parents: [process.env.FOLDER_ID]
        };

        // Upload to Google Drive with retry logic
        try {
            const response = await uploadToDriveWithRetry(drive, fileMetadata, {
                mimeType: "application/pdf",
                body: stream,
            });

            const fileId = response.data.id;
            user.file_id = fileId;
            await user.save();
            console.log("File uploaded to Drive, ID:", fileId);
            res.status(200).json({ message: "pass generated!" });
        } catch (uploadError) {
            console.error("Upload failed after all retries:", uploadError);
            res.status(500).json({ error: "Network error: Failed to upload PDF after multiple attempts." });
        }
    } catch (error) {
        console.error("Error in request processing:", error);
        res.status(500).json({ error: "Failed to process request." });
    }
});
/**
 * Registration Endpoint
 * - Validates input using express-validator.
 * - Checks for duplicate emails.
 * - Generates a unique serial number.
 * - Saves the new user entry in MongoDB.
 */
app.post("/api/register", limiter, [
    body("name").notEmpty().withMessage("Name is required."),
    body("rollNumber").notEmpty().withMessage("Roll number is required."),
    body("email")
        .isEmail().withMessage("A valid email is required.")
        .matches(/@bitmesra\.ac\.in$/).withMessage(
            "Email must end with bitmesra.ac.in",
        ),
    body("purpose").notEmpty().withMessage("Purpose is required."),
], async (req, res, next) => {
    try {
        // Validate request data
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, rollNumber, email, purpose } = req.body;

        // Check for duplicate email
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: "This email is already registered!",
            });
        }

        // Generate a unique serial number for QR code verification
        const serialNumber = `AUR-${Math.floor(1000 + Math.random() * 9000)}`;
        // Hash the serial number
        const hashedSerial = await bcrypt.hash(serialNumber, 10);

        // Create and save new user entry
        const newUser = new User({
            name,
            rollNumber,
            email,
            purpose,
            serial: hashedSerial,
        });

        await newUser.save();
        // Generate JWT token
        const token = jwt.sign({ hashedSerial }, process.env.JWT_SECRET);

        return res.status(201).send({
            serial: token,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * QR Code Verification Endpoint
 * - Validates that a serial number is provided.
 * - Looks up the user by serial number.
 * - Checks that the entry limit has not been reached.
 * - Increments the entry count if verification passes.
 */
app.post("/api/verify-entry", [
    body("serial").notEmpty().withMessage("QR code serial number is required."),
], async (req, res, next) => {
    try {
        // Validate request data
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { serial } = req.body;

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(serial, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                message: "Invalid token!",
            });
        }

        const { hashedSerial } = decoded;

        // Find the user by comparing hashedSerial
        const users = await User.find();

        let matchedUser = null;
        for (const user of users) {
            const isMatch = user.serial === hashedSerial;
            if (isMatch) {
                matchedUser = user;
                break;
            }
        }

        if (!matchedUser) {
            return res.status(404).json({ message: "Invalid QR code!" });
        }



        // Check if the user has already reached the entry limit
        if (matchedUser.entryCount >= 3) {
            return res.status(403).json({ message: "Entry limit reached!" });
        }

        // Increment the entry count
        matchedUser.entryCount += 1;
        await matchedUser.save();
        const user = {
            name: matchedUser?.name,
            purpose: matchedUser?.purpose,
            rollNumber: matchedUser?.rollNumber,
            entryCount: matchedUser?.entryCount
        }

        return res.status(200).json({
            ...user
        });
    } catch (error) {
        next(error);
    }
});
// --- Global Error Handling Middleware ---
app.use((_err, _req, res, _next) => {
    // Avoid exposing sensitive error details in production
    res.status(500).json({
        message: "Something went wrong. Please try again later.",
    });
});
