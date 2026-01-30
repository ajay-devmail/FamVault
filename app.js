require("dotenv").config();
const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const multer = require("multer"); //upload

// Import your models
const userModel = require("./models/user");
const postModel = require("./models/post");
const docModel = require("./models/docModel");

// 1. DATABASE CONNECTION
mongoose.connect("mongodb://127.0.0.1:27017/famvoult")
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// 2. MIDDLEWARE
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

// 3. MAIL CONFIG
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 1. LANDING PAGE
app.get("/", (req, res) => {
    res.render("landingpage");
});

// 2. REGISTER PAGE
app.get("/register", (req, res) => {
    if (req.cookies.token) return res.redirect("/overview");
    res.render("index");
});

// 3. LOGIN PAGE
app.get("/login", (req, res) => {
    if (req.cookies.token) return res.redirect("/overview");
    res.render("login", { message: req.query.message || null });
});
//4.LOGOUT
app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});

// --- MAIN FEATURE ROUTES ---

app.get("/documents", isLoggedIn, async (req, res) => {
    try {
        // Fetch documents for the specific logged-in user
        const docs = await docModel.find({ user: req.user.userid });

        res.render("documents", {
            user: req.user,
            documents: docs
        });
    } catch (err) {
        console.error("Error fetching documents:", err);
        res.status(500).send("Server Error");
    }
});

app.get("/api/documents/search", isLoggedIn, async (req, res) => {
    try {
        const query = req.query.query;

        // Return empty list if query is empty
        if (!query) return res.json([]);

        const results = await docModel.find({
            user: req.user.userid,
            fileName: { $regex: query, $options: "i" } // Case-insensitive search
        });
        res.json(results);
    } catch (err) {
        console.error("Search Error:", err);
        res.status(500).json({ error: "Search failed" });
    }
});

app.get("/medical-records", isLoggedIn, async (req, res) => {
    res.render("medical", { user: req.user });
});

app.get("/emergency-contacts", isLoggedIn, async (req, res) => {
    res.render("emergency", { user: req.user });
});

app.get("/upload", isLoggedIn, (req, res) => {
    res.render("upload", { user: req.user });
});

app.get("/emergency-mode", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    res.render("emergency-mode", { user });
});


// --- AUTHENTICATION POST ROUTES ---

// REGISTER with Hashed OTP
app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        let user = await userModel.findOne({ email });

        if (user && user.isVerified) return res.redirect("/login?message=Email already exists");

        const hashPassword = await bcryptjs.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOTP = await bcryptjs.hash(otp, 10);

        if (user) {
            // Update existing unverified user
            user.password = hashPassword;
            user.otp = hashedOTP;
            user.otpExpires = Date.now() + 600000;
            await user.save();
        } else {
            // Create new user
            await userModel.create({
                name,
                email,
                password: hashPassword,
                otp: hashedOTP,
                otpExpires: Date.now() + 600000 // Valid for 10 minutes
            });
        }

        await transporter.sendMail({
            to: email,
            subject: "Verify Your FamVault Account",
            html: `<div style="font-family:sans-serif; text-align:center;">
                    <h2>OTP Verification</h2>
                    <p>Enter the code below to verify your email:</p>
                    <h1 style="color:#2563eb; font-size:40px; letter-spacing:10px;">${otp}</h1>
                    <p>This code expires in <b>10 minutes</b>.</p>
                   </div>`
        });

        res.render("verify-otp", { email: email });

    } catch (err) {
        console.error(err);
        res.status(500).send("Registration Error");
    }
});

// VERIFY OTP
app.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await userModel.findOne({ email });

        if (!user) return res.send("User not found.");

        if (user.otpExpires < Date.now()) {
            await userModel.deleteOne({ email });
            return res.send("❌ OTP expired. Please register again.");
        }

        const validOTP = await bcryptjs.compare(otp, user.otp);

        if (!validOTP) {
            return res.send("❌ Invalid code. Check your email.");
        }

        await userModel.updateOne({ email }, {
            isVerified: true,
            $unset: { otp: 1, otpExpires: 1 }
        });

        console.log(`✅ ${email} is now verified.`);
        res.redirect("/login?message=Verified! You can now login.");
    } catch (err) {
        res.status(500).send("Verification Error");
    }
});

// LOGIN
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) return res.redirect("/login?message=User not found");
    if (!user.isVerified) return res.send("Please verify your account first.");

    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) return res.redirect("/login?message=Wrong password");

    // Create Token with 'userid' to match your other routes
    const token = jwt.sign({ email: user.email, userid: user._id }, process.env.JWT_SECRET);
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/overview");
});

app.get("/overview", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email }).populate("posts");
    res.render("overview", { user });
});

// Those belong in your documents.ejs <script> tag.

function isLoggedIn(req, res, next) {
    if (!req.cookies.token) return res.redirect("/login");
    try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie("token");
        res.redirect("/login");
    }
}

app.listen(3001, () => console.log("🚀 Server: http://localhost:3001"));
