const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    fileName: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ["Insurance", "Medical", "Property", "Identity", "General"],
        default: "General"
    },
    fileSize: {
        type: String, // Stored as "2.4 MB" or "815 KB" for easy display
        required: true
    },
    fileUrl: {
        type: String, // Path to the file on your server or cloud storage
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    expiryDate: {
        type: String, // Optional: for documents like Insurance or Passports
        default: null
    }
});

module.exports = mongoose.model("document", documentSchema);