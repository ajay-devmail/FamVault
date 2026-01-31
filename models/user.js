const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    // Auth Fields
    name: String,
    email: { type: String, unique: true },
    password: String,
    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpires: Date,

    // Profile Fields
    profilePic: { type: String, default: "" },
    phone: String,
    dob: String, // Format: YYYY-MM-DD
    gender: { type: String, enum: ['Male', 'Female', 'Other', 'Prefer not to say'], default: 'Prefer not to say' },
    bloodGroup: { type: String, default: "Unknown" },
    address: String,
    
    // Medical Info (Connected to Emergency Mode)
    allergies: { type: String, default: "None" },
    conditions: { type: String, default: "None" },

    posts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "post"
    }]
});

module.exports = mongoose.model("user", userSchema);
