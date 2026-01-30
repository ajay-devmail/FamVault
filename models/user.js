const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,

    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpires: Date,

    posts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "post"
    }]
});

module.exports = mongoose.model("user", userSchema);
