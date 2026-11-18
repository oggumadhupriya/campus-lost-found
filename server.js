const multer = require("multer");
const fs = require("fs");

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

require("dotenv").config();
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const bcrypt = require("bcryptjs");

const app = express();

console.log("LOGGER CHECK - THIS SERVER FILE IS RUNNING");

app.use((req, res, next) => {
    console.log("INCOMING REQUEST:", req.method, req.url);
    next();
});

console.log("SERVER FILE:", __filename);

app.get("/test", (req, res) => {
    res.send("Express test route is working!");
});

app.get("/api/test-simple", (req, res) => {
    res.json({
        success: true,
        message: "Simple API route works!"
    });
});

// =====================================
// Cloudinary Image Upload Configuration
// =====================================

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "campus-lost-found",
        allowed_formats: ["jpg", "jpeg", "png", "webp"]
    }
});

const upload = multer({

    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },
    
    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, PNG, and WEBP images are allowed."));
        }
    }
});

const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
console.log("PUBLIC FOLDER:", path.join(__dirname, "public"));
console.log("ADMIN JS EXISTS:", fs.existsSync(path.join(__dirname, "public", "admin.js")));
console.log("CSS EXISTS:", fs.existsSync(path.join(__dirname, "public", "style.css")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const client = new MongoClient(process.env.MONGODB_URI);

async function startServer() {
    try {
        await client.connect();

        console.log("MongoDB connected successfully!");

        const db = client.db("campus_lost_found");

        const usersCollection = db.collection("users");
        const itemsCollection = db.collection("items");
        const claimsCollection = db.collection("claims");

        await usersCollection.createIndex(
            { email: 1 },
            { unique: true }
        );

        // SESSION CONFIGURATION
        app.use(
            session({
                secret: process.env.SESSION_SECRET,
                resave: false,
                saveUninitialized: false,
                store: MongoStore.create({
                    client: client,
                    dbName: "campus_lost_found",
                    collectionName: "sessions"
                }),
                cookie: {
                    httpOnly: true,
                    secure: false,
                    sameSite: "lax",
                    maxAge: 24 * 60 * 60 * 1000
                }
            })
        );

        // CHECK LOGIN
        function requireLogin(req, res, next) {
            if (!req.session.user) {
                return res.status(401).json({
                    success: false,
                    message: "Please log in first."
                });
            }

            next();
        }

        // CHECK ADMIN ACCESS
        async function requireAdmin(req, res, next) {
            try {
                if (!req.session.user) {
                    return res.status(401).json({
                        success: false,
                        message: "Please log in first."
                    });
                }

                const user = await usersCollection.findOne({
                    _id: new ObjectId(req.session.user.id)
                });

                if (!user || user.role !== "admin") {
                    return res.status(403).json({
                        success: false,
                        message: "Admin access denied."
                    });
                }

                next();

            } catch (error) {
                console.error("Admin authentication error:", error);

                res.status(500).json({
                    success: false,
                    message: "Could not verify admin access."
                });
            }
        }

        // =====================================
        // ADMIN DASHBOARD STATISTICS
        // =====================================

        app.get("/api/admin/stats", requireAdmin, async (req, res) => {
            try {
                const totalUsers = await usersCollection.countDocuments();

                const totalItems = await itemsCollection.countDocuments();

                const totalClaims = await claimsCollection.countDocuments();

                const recoveredItems = await itemsCollection.countDocuments({
                    recoveryStatus: "Recovered"
                });

                res.json({
                    success: true,
                    stats: {
                        totalUsers,
                        totalItems,
                        totalClaims,
                        recoveredItems
                    }
                });

            } catch (error) {
                console.error("Admin statistics error:", error);

                res.status(500).json({
                    success: false,
                    message: "Could not retrieve admin statistics."
                });
            }
        });
        console.log("ADMIN TEST ROUTE IS REGISTERED");

        // ADMIN TEST ROUTE
        app.get("/api/admin/test", (req, res) => {
            res.json({
                success: true,
                message: "Admin test route is working!"
            });
        });

        // DATABASE HEALTH CHECK
        app.get("/api/health", async (req, res) => {
            try {
                await db.command({ ping: 1 });

                res.json({
                    success: true,
                    message: "Database connected successfully!"
                });
            } catch (error) {
                console.error("Health check error:", error);

                res.status(500).json({
                    success: false,
                    message: "Database connection failed."
                });
            }
        });

        // STUDENT REGISTRATION
        app.post("/api/register", async (req, res) => {
            try {
                const { name, email, password } = req.body;

                if (!name || !email || !password) {
                    return res.status(400).json({
                        success: false,
                        message: "Please fill in all fields."
                    });
                }

                if (password.length < 8) {
                    return res.status(400).json({
                        success: false,
                        message: "Password must contain at least 8 characters."
                    });
                }

                const normalizedEmail = email.trim().toLowerCase();

                const existingUser = await usersCollection.findOne({
                    email: normalizedEmail
                });

                if (existingUser) {
                    return res.status(409).json({
                        success: false,
                        message: "This email is already registered. Please login."
                    });
                }

                const hashedPassword = await bcrypt.hash(password, 10);

                const newUser = {
                    name: name.trim(),
                    email: normalizedEmail,
                    passwordHash: hashedPassword,
                    role: "student",
                    createdAt: new Date()
                };

                const result = await usersCollection.insertOne(newUser);

                req.session.user = {
                    id: result.insertedId.toString(),
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role
                };

                req.session.save((error) => {
                    if (error) {
                        console.error("Session error:", error);

                        return res.status(500).json({
                            success: false,
                            message: "Account created, but session could not be saved."
                        });
                    }

                    res.status(201).json({
                        success: true,
                        message: "Registration successful!",
                        user: req.session.user
                    });
                });

            } catch (error) {
                console.error("Registration error:", error);

                res.status(500).json({
                    success: false,
                    message: "Registration failed."
                });
            }
        
        });
    
        // =====================================
        // STUDENT LOGIN
        // =====================================

        app.post("/api/login", async (req, res) => {
            try {
                const { email, password } = req.body;

                if (!email || !password) {
                    return res.status(400).json({
                        success: false,
                        message: "Please enter your email and password."
                    });
                }

                const normalizedEmail = email.trim().toLowerCase();

                const user = await usersCollection.findOne({
                    email: normalizedEmail
                });

                if (!user) {
                    return res.status(401).json({
                        success: false,
                        message: "Email or password is incorrect."
                    });
                }

                const storedHash = user.passwordHash || user.password;

                if (!storedHash) {
                    return res.status(401).json({
                        success: false,
                        message: "Password record is invalid."
                    });
                }

                const passwordMatch = await bcrypt.compare(
                    password,
                    storedHash
                );

                if (!passwordMatch) {
                    return res.status(401).json({
                        success: false,
                        message: "Email or password is incorrect."
                    });
                }

                req.session.regenerate((error) => {
                    if (error) {
                        console.error("Session error:", error);

                        return res.status(500).json({
                            success: false,
                            message: "Could not create login session."
                        });
                    }

                    req.session.user = {
                        id: user._id.toString(),
                        name: user.name,
                        email: user.email,
                        role: user.role || "student"
                    };

                    req.session.save((saveError) => {
                        if (saveError) {
                            console.error("Session save error:", saveError);

                            return res.status(500).json({
                                success: false,
                                message: "Could not save login session."
                            });
                        }

                        res.json({
                            success: true,
                            message: "Login successful!",
                            user: req.session.user
                        });
                    });
                });

            } catch (error) {
                console.error("Login error:", error);

                res.status(500).json({
                    success: false,
                    message: "Login failed."
                });
            }
        });

        // =====================================
        // CHECK CURRENT LOGIN
        // =====================================

        app.get("/api/me", (req, res) => {
            if (!req.session.user) {
                return res.status(401).json({
                    success: false,
                    message: "Not logged in."
                });
            }

            res.json({
                success: true,
                user: req.session.user
            });
        });

        // =====================================
        // STUDENT LOGOUT
        // =====================================

        app.post("/api/logout", (req, res) => {
            req.session.destroy((error) => {
                if (error) {
                    return res.status(500).json({
                        success: false,
                        message: "Logout failed."
                    });
                }

                res.clearCookie("connect.sid");

                res.json({
                    success: true,
                    message: "Logged out successfully."
                });
            });
        });

        // =====================================
        // GET ALL REPORTED ITEMS
        // =====================================

        app.get("/api/items", async (req, res) => {
            try {
                const items = await itemsCollection
                    .find({})
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json({
                    success: true,
                    items: items
                });

            } catch (error) {
                console.error("Get items error:", error);

                res.status(500).json({
                    success: false,
                    message: "Could not retrieve items."
                });
            }
        });

        // =====================================
        // REPORT A LOST OR FOUND ITEM WITH IMAGE
        // =====================================

        app.post(
            "/api/items",
            requireLogin,
            upload.single("itemImage"),
            async (req, res) => {
                try {
                    console.log("UPLOADED FILE:", req.file);
                    const {
                        name,
                        category,
                        location,
                        type,
                        description,
                        date
                    } = req.body;

                    if (
                        !name ||
                        !category ||
                        !location ||
                        !type ||
                        !description ||
                        !date
                    ) {
                        return res.status(400).json({
                            success: false,
                            message: "Please fill in all required fields."
                        });
                    }

                    if (!["Lost", "Found"].includes(type)) {
                        return res.status(400).json({
                            success: false,
                            message: "Item type must be Lost or Found."
                        });
                    }

                    const item = {
                        name: name.trim(),
                        category,
                        location: location.trim(),
                        type,
                        description: description.trim(),
                        date,

                        image: req.file ? req.file.path : null,

                        reportedBy: req.session.user.id,
                        reportedByName: req.session.user.name,
                        recoveryStatus: "Not recovered",
                        createdAt: new Date()
                    };

                    const result = await itemsCollection.insertOne(item);

                    res.status(201).json({
                        success: true,
                        message: "Item reported successfully!",
                        item: {
                            ...item,
                            _id: result.insertedId
                        }
                    });

                } catch (error) {
                    console.error("Report item error:", error);

                    res.status(500).json({
                        success: false,
                        message: "Could not report item."
                    });
                }
            }
        );


        // =====================================
        // SUBMIT A CLAIM FOR A FOUND ITEM
        // =====================================

        app.post("/api/items/:id/claims", requireLogin, async (req, res) => {
            try {
                const itemId = req.params.id;

                if (!ObjectId.isValid(itemId)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid item ID."
                    });
                }

                const item = await itemsCollection.findOne({
                    _id: new ObjectId(itemId)
                });

                if (!item) {
                    return res.status(404).json({
                        success: false,
                        message: "Item not found."
                    });
                }

                if (item.type !== "Found") {
                    return res.status(400).json({
                        success: false,
                        message: "You can only claim found items."
                    });
                }

                if (item.recoveryStatus === "Recovered") {
                    return res.status(400).json({
                        success: false,
                        message: "This item has already been recovered."
                    });
                }

                const claimantId = req.session.user.id;

                if (item.reportedBy === claimantId) {
                    return res.status(403).json({
                        success: false,
                        message: "You cannot claim an item you reported."
                    });
                }

                const existingClaim = await claimsCollection.findOne({
                    itemId: new ObjectId(itemId),
                    claimantId: claimantId,
                    status: "pending"
                });

                if (existingClaim) {
                    return res.status(409).json({
                        success: false,
                        message: "You already submitted a pending claim."
                    });
                }

                const claim = {
                    itemId: new ObjectId(itemId),
                    claimantId: claimantId,
                    claimantName: req.session.user.name,
                    message: req.body.message || "",
                    status: "pending",
                    createdAt: new Date()
                };

                await claimsCollection.insertOne(claim);

                res.status(201).json({
                    success: true,
                    message: "Claim submitted successfully!"
                });

            } catch (error) {
                console.error("Claim submission error:", error);

                res.status(500).json({
                    success: false,
                    message: "Could not submit claim."
                });
            }
        });

        // =====================================
        // VIEW MY SUBMITTED CLAIMS
        // =====================================

        app.get("/api/my-claims", requireLogin, async (req, res) => {
            try {
                const claims = await claimsCollection.find({
                    claimantId: req.session.user.id
                })
                .sort({ createdAt: -1 })
                .toArray();

                const claimsWithItems = await Promise.all(
                    claims.map(async (claim) => {
                        const item = await itemsCollection.findOne({
                            _id: claim.itemId
                        });

                        return {
                            ...claim,
                            item: item ? {
                                name: item.name,
                                location: item.location,
                                type: item.type,
                                recoveryStatus: item.recoveryStatus || "Not recovered"
                            } : null
                        };
                    })
                );

                res.json({
                    success: true,
                    claims: claimsWithItems
                });

            } catch (error) {
                console.error("My claims error:", error);

                res.status(500).json({
                    success: false,
                    message: "Could not retrieve your claims."
                });
            }
        });

        // =====================================
        // VIEW CLAIMS FOR MY REPORTED ITEM
        // =====================================

        console.log("ITEM CLAIMS ROUTE REGISTERED");
        app.get("/api/test-claims-route", (req, res) => {
            console.log("TEST CLAIMS ROUTE REACHED");
            
            res.json({
                success: true,
                message: "Claims route test is working!"
            });
        });
        
        app.get("/api/items/:id/claims", requireLogin, async (req, res) => {
            console.log("CLAIMS ROUTE USER:", req.session.user);
            try {
                const itemId = req.params.id;

                if (!ObjectId.isValid(itemId)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid item ID."
                    });
                }

                const item = await itemsCollection.findOne({
                    _id: new ObjectId(itemId)
                });

                if (!item) {
                    return res.status(404).json({
                        success: false,
                        message: "Item not found."
                    });
                }

                const isAdmin = req.session.user.role === "admin";
                
                if (!isAdmin && item.reportedBy !== req.session.user.id) {
                    return res.status(403).json({
                        success: false,
                        message: "You can only view claims for items you reported."
                    });
                }

                const claims = await claimsCollection.find({
                    itemId: new ObjectId(itemId)
                })
                .sort({ createdAt: -1 })
                .toArray();

                res.json({
                    success: true,
                    item: {
                        id: item._id,
                        name: item.name,
                        recoveryStatus: item.recoveryStatus || "Not recovered"
                    },
                    claims: claims
                });

            } catch (error) {
                console.error("Get item claims error:", error);

                res.status(500).json({
                    success: false,
                    message: "Could not retrieve item claims."
                });
            }
        });

        // APPROVE OR REJECT A CLAIM
        app.patch("/api/claims/:claimId/review", requireLogin, async (req, res) => {
            try {
                const claimId = req.params.claimId;
                const { status } = req.body;
                
                if (!ObjectId.isValid(claimId)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid claim ID."
                    });
                }
                
                if (!["approved", "rejected"].includes(status)) {
                    return res.status(400).json({
                        success: false,
                        message: "Status must be approved or rejected."
                    });
                }
                
                const claim = await claimsCollection.findOne({
                    _id: new ObjectId(claimId)
                });
                
                if (!claim) {
                    return res.status(404).json({
                        success: false,
                        message: "Claim not found."
                    });
                }
                
                const item = await itemsCollection.findOne({
                    
                    _id: claim.itemId
                
                });
                
                if (!item) {
                    
                    return res.status(404).json({
                        
                        success: false,
                        message: "Item not found."
                    });
                }
                
                const isAdmin = req.session.user.role === "admin";
                
                if (!isAdmin && item.reportedBy !== req.session.user.id) {
                    return res.status(403).json({
                        success: false,
                        message: "Only the admin or person who reported this item can review its claims."
                    });
                }

                if (claim.status !== "pending") {
                    return res.status(409).json({
                        success: false,
                        message: "This claim has already been reviewed."
                    });
                }
                
                const updateResult = await claimsCollection.updateOne(
                    {
                        _id: new ObjectId(claimId),
                        status: "pending"
                    },
                    
                    {
                        $set: {
                            status,
                            reviewedAt: new Date(),
                            reviewedBy: req.session.user.id
                        } 
                    }
                );

                if (updateResult.modifiedCount === 0) {
                    return res.status(409).json({
                        success: false,
                        message: "This claim has already been reviewed."
                    });
                }

                if (status === "approved") {
                    await itemsCollection.updateOne(
                        { _id: claim.itemId },
                        {
                            $set: {
                                recoveryStatus: "Recovered",
                                recoveredAt: new Date(),
                                recoveredBy: claim.claimantId
                            }
                        }
                    );
                    
                    await claimsCollection.updateMany(
                        {
                            itemId: claim.itemId,
                            status: "pending"
                        },
                        {
                            $set: {
                                status: "rejected",
                                reviewedAt: new Date(),
                                reviewedBy: req.session.user.id
                            }
                        }
                    );
                }

                res.json({
                    success: true,
                    message: status === "approved"
                    ? "Claim approved successfully."
                    : "Claim rejected successfully."
                });
            
            } catch (error) {
                
                console.error("Review claim error:", error);
                
                res.status(500).json({
                    
                    success: false,
                    message: "Server error while reviewing claim."
                });
            }
        });

        
        // START SERVER
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    
    } catch (error) {
        console.error("Server error:", error.message);
        process.exit(1);
    }
}

startServer();
