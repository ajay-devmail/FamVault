require("dotenv").config();
const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

// Import your models
const userModel = require("./models/user");
const postModel = require("./models/post");

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

/* ====================== ROUTES ====================== */

// 1. LANDING PAGE (Root Route)
// STRICTLY: Always shows Landing Page first, even if logged in.
app.get("/", (req, res) => {
    res.render("landingpage"); 
});

// 2. REGISTER PAGE (New Route)
// Moved here because "/" is now the landing page.
// This renders your existing "index.ejs" which contains the signup form.
app.get("/register", (req, res) => {
    if (req.cookies.token) return res.redirect("/profile");
    res.render("index");
});

// 3. LOGIN PAGE
// Accessed when clicking "Get Started" on Landing Page
app.get("/login", (req, res) => {
    // If they are already logged in, send them to profile immediately
    if (req.cookies.token) return res.redirect("/profile");
    
    // Otherwise, show the login form
    res.render("login", { message: req.query.message || null });
});

app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});

// ... The rest of your POST routes (register, verify-otp, login) remain exactly the same ...

// --- Placeholder Routes for New Buttons ---

app.get("/documents", isLoggedIn, async (req, res) => {
    // Later: const docs = await docModel.find({ user: req.user.userid });
    res.render("documents", { user: req.user }); // You need to create documents.ejs later
});

app.get("/medical-records", isLoggedIn, async (req, res) => {
    res.render("medical", { user: req.user }); // You need to create medical.ejs later
});

app.get("/emergency-contacts", isLoggedIn, async (req, res) => {
    res.render("emergency", { user: req.user }); // You need to create emergency.ejs later
});

app.get("/upload", isLoggedIn, (req, res) => {
    res.render("upload", { user: req.user }); // You need to create upload.ejs later
});

// In app.js, inside the list of routes
app.get("/emergency-mode", isLoggedIn, async (req, res) => {
    // Fetch the user data to display their name
    const user = await userModel.findOne({ email: req.user.email });
    res.render("emergency-mode", { user });
});


// REGISTER with Hashed OTP
app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        let user = await userModel.findOne({ email });

        if (user && user.isVerified) return res.redirect("/login?message=Email already exists");

        const hashPassword = await bcryptjs.hash(password, 10);

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Hash the OTP for security
        const hashedOTP = await bcryptjs.hash(otp, 10);

        if (user) {
            // Update existing unverified user
            user.password = hashPassword;
            user.otp = hashedOTP;
            user.otpExpires = Date.now() + 3600000; // 1 hour
            await user.save();
        } else {
            // Create new user
            await userModel.create({
                name,
                email,
                password: hashPassword,
                otp: hashedOTP,
                otpExpires: Date.now() + 3600000 // Valid for 1 hour
            });
        }

        await transporter.sendMail({
            to: email,
            subject: "Verify Your FamVault Account",
            html: `<div style="font-family:sans-serif; text-align:center;">
                    <h2>OTP Verification</h2>
                    <p>Enter the code below to verify your email:</p>
                    <h1 style="color:#2563eb; font-size:40px; letter-spacing:10px;">${otp}</h1>
                    <p>This code expires in <b>1 hour</b>.</p>
                   </div>`
        });

        res.render("verify-otp", { email: email });

    } catch (err) {
        console.error(err);
        res.status(500).send("Registration Error");
    }
});

// VERIFY OTP with Bcryptjs Compare
app.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await userModel.findOne({ email });

        if (!user) return res.send("User not found.");

        // 1. Check if expired
        if (user.otpExpires < Date.now()) {
            await userModel.deleteOne({ email }); // Optional: cleanup
            return res.send("❌ OTP expired. Please register again.");
        }

        // 2. Compare hashed OTP
        const validOTP = await bcryptjs.compare(otp, user.otp);

        if (!validOTP) {
            return res.send("❌ Invalid code. Check your email.");
        }

        // 3. Success: Update user status
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

    const token = jwt.sign({ email: user.email, userid: user._id }, process.env.JWT_SECRET);
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/profile");
});

app.get("/profile", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email }).populate("posts");
    res.render("profile", { user });
});

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