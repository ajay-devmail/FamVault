const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
    // Changed "User" to "user" to match your user model export
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    },
    title: String,
    content: String,
    image: String,
    // Changed "User" to "user" here as well
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user"
    }],
    // Ensure you have a 'comment' model if you use this
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "comment"
    }],
    date: {
        type: Date,
        default: Date.now
    }
});

// Export as "post" (lowercase) to stay consistent
module.exports = mongoose.model("post", PostSchema);
