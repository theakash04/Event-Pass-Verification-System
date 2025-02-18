const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    rollNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        // Validate that the email ends with bitmesra.ac.in
        match: [
            /^[^\s@]+@bitmesra\.ac\.in$/,
            "Email must end with bitmesra.ac.in",
        ],
    },
    purpose: {
        type: String,
        required: true,
        trim: true,
    },
    entryCount: {
        type: Number,
        default: 0,
        // Ensure the entry count never exceeds 3
        max: [3, "Entry count cannot exceed 3"],
    },
    serial: { type: String, unique: true },
    file_id: { type: String }
});

const User = mongoose.model("User", userSchema);
module.exports = User;
