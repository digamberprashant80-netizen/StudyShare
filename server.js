const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();
const PORT = 3000;


// ===============================
// FILE PATHS
// ===============================

const uploadFolder = path.join(__dirname, "uploads");
const notesFile = path.join(__dirname, "notes.json");
const usersFile = path.join(__dirname, "users.json");


// ===============================
// CREATE REQUIRED FILES/FOLDERS
// ===============================

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder);
}

if (!fs.existsSync(notesFile)) {
    fs.writeFileSync(notesFile, "[]");
}

if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, "[]");
}


// ===============================
// MIDDLEWARE
// ===============================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// ===============================
// SESSION
// ===============================

app.use(
    session({
        secret: "studyshare-secret-key",
        resave: false,
        saveUninitialized: false
    })
);


// ===============================
// STATIC FILES
// ===============================

app.use(express.static(__dirname));

app.use(
    "/uploads",
    express.static(uploadFolder)
);


// ===============================
// MULTER STORAGE
// ===============================

const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        cb(null, uploadFolder);

    },

    filename: function (req, file, cb) {

        cb(
            null,
            Date.now() + "-" + file.originalname
        );

    }

});


// ===============================
// FILE VALIDATION
// ===============================

const allowedExtensions = [
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx"
];


const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
];


const upload = multer({

    storage: storage,

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: function (req, file, cb) {

        const extension =
            path.extname(file.originalname).toLowerCase();

        const extensionAllowed =
            allowedExtensions.includes(extension);

        const mimeAllowed =
            allowedMimeTypes.includes(file.mimetype);


        if (extensionAllowed && mimeAllowed) {

            cb(null, true);

        } else {

            cb(
                new Error(
                    "Only PDF, DOC, DOCX, PPT and PPTX files are allowed."
                )
            );

        }

    }

});


// ===============================
// HOME PAGE
// ===============================

app.get("/", function (req, res) {

    res.sendFile(
        path.join(__dirname, "index.html")
    );

});


// ===============================
// UPLOAD NOTE
// ONLY LOGGED-IN USERS
// ===============================

app.post(
    "/upload",

    function (req, res, next) {

        if (!req.session.user) {

            return res.redirect("/login.html");

        }

        next();

    },

    function (req, res, next) {

        upload.single("noteFile")(req, res, function (error) {

            if (error) {

                if (error instanceof multer.MulterError) {

                    if (error.code === "LIMIT_FILE_SIZE") {

                        return res.send(`
                            <h2>❌ File is too large.</h2>

                            <p>
                                Maximum allowed file size is 10 MB.
                            </p>

                            <br>

                            <a href="/upload.html">
                                Go Back
                            </a>
                        `);

                    }

                    return res.send(`
                        <h2>❌ File upload error.</h2>

                        <p>
                            ${error.message}
                        </p>

                        <br>

                        <a href="/upload.html">
                            Go Back
                        </a>
                    `);

                }


                return res.send(`
                    <h2>❌ Invalid file.</h2>

                    <p>
                        ${error.message}
                    </p>

                    <br>

                    <a href="/upload.html">
                        Go Back
                    </a>
                `);

            }

            next();

        });

    },

    function (req, res) {

        if (!req.file) {

            return res.send(`
                <h2>❌ Please select a file.</h2>

                <br>

                <a href="/upload.html">
                    Go Back
                </a>
            `);

        }


        let notes = [];

        try {

            const data =
                fs.readFileSync(
                    notesFile,
                    "utf8"
                );

            notes =
                data.trim()
                    ? JSON.parse(data)
                    : [];

        } catch (error) {

            notes = [];

        }


        const uploadedBy =
            req.session.user.email;


        const newNote = {

            title:
                req.body.title || "",

            course:
                req.body.course || "",

            subject:
                req.body.subject || "",

            semester:
                req.body.semester || "",

            description:
                req.body.description || "",

            uploadedBy:
                uploadedBy,

            fileName:
                req.file.filename,

            originalFileName:
                req.file.originalname,

            uploadDate:
                new Date().toISOString()

        };


        notes.push(newNote);


        fs.writeFileSync(
            notesFile,
            JSON.stringify(
                notes,
                null,
                2
            )
        );


        res.send(`

            <h2>✅ Note uploaded successfully!</h2>

            <p>
                Your note has been added to StudyShare.
            </p>

            <br>

            <a href="/notes.html">
                📚 View Notes
            </a>

            <br><br>

            <a href="/my-notes.html">
                📚 My Uploaded Notes
            </a>

            <br><br>

            <a href="/">
                🏠 Go Home
            </a>

        `);

    }
);


// ===============================
// GET ALL NOTES
// ===============================

app.get(
    "/api/notes",
    function (req, res) {

        try {

            const data =
                fs.readFileSync(
                    notesFile,
                    "utf8"
                );

            const notes =
                data.trim()
                    ? JSON.parse(data)
                    : [];

            res.json(notes);

        } catch (error) {

            res.json([]);

        }

    }
);


// ===============================
// SIGN UP
// ===============================

app.post(
    "/signup",
    async function (req, res) {

        const name =
            String(
                req.body.name || ""
            ).trim();

        const email =
            String(
                req.body.email || ""
            )
            .trim()
            .toLowerCase();

        const password =
            String(
                req.body.password || ""
            );

        const confirmPassword =
            String(
                req.body.confirmPassword || ""
            );


        if (
            !name ||
            !email ||
            !password ||
            !confirmPassword
        ) {

            return res.send(`
                <h2>❌ Please fill all fields.</h2>

                <a href="/signup.html">
                    Go Back
                </a>
            `);

        }


        if (
            password !== confirmPassword
        ) {

            return res.send(`
                <h2>❌ Passwords do not match.</h2>

                <a href="/signup.html">
                    Try Again
                </a>
            `);

        }


        let users = [];

        try {

            const data =
                fs.readFileSync(
                    usersFile,
                    "utf8"
                );

            users =
                data.trim()
                    ? JSON.parse(data)
                    : [];

        } catch (error) {

            users = [];

        }


        const existingUser =
            users.find(
                function (user) {

                    return user.email === email;

                }
            );


        if (existingUser) {

            return res.send(`
                <h2>❌ Email already registered.</h2>

                <a href="/login.html">
                    Go to Login
                </a>
            `);

        }


        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        const newUser = {

            name: name,

            email: email,

            password: hashedPassword

        };


        users.push(newUser);


        fs.writeFileSync(
            usersFile,
            JSON.stringify(
                users,
                null,
                2
            )
        );


        res.send(`

            <h2>✅ Account created successfully!</h2>

            <p>
                Welcome to StudyShare,
                ${name}!
            </p>

            <a href="/login.html">
                Go to Login
            </a>

        `);

    }
);


// ===============================
// LOGIN
// ===============================

app.post(
    "/login",
    async function (req, res) {

        const email =
            String(
                req.body.email || ""
            )
            .trim()
            .toLowerCase();

        const password =
            String(
                req.body.password || ""
            );


        if (
            !email ||
            !password
        ) {

            return res.send(`
                <h2>❌ Please fill all fields.</h2>

                <a href="/login.html">
                    Go Back
                </a>
            `);

        }


        let users = [];

        try {

            const data =
                fs.readFileSync(
                    usersFile,
                    "utf8"
                );

            users =
                data.trim()
                    ? JSON.parse(data)
                    : [];

        } catch (error) {

            users = [];

        }


        const user =
            users.find(
                function (user) {

                    return user.email === email;

                }
            );


        if (!user) {

            return res.send(`
                <h2>❌ Account not found.</h2>

                <a href="/signup.html">
                    Create Account
                </a>
            `);

        }


        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordMatch) {

            return res.send(`
                <h2>❌ Incorrect password.</h2>

                <a href="/login.html">
                    Try Again
                </a>
            `);

        }


        req.session.user = {

            name:
                user.name,

            email:
                user.email

        };


        res.send(`

            <h2>✅ Login successful!</h2>

            <p>
                Welcome back,
                ${user.name}!
            </p>

            <a href="/">
                Go to StudyShare
            </a>

        `);

    }
);


// ===============================
// CURRENT USER
// ===============================

app.get(
    "/api/user",
    function (req, res) {

        if (req.session.user) {

            res.json({

                loggedIn: true,

                user:
                    req.session.user

            });

        } else {

            res.json({

                loggedIn: false

            });

        }

    }
);


// ===============================
// MY NOTES
// ===============================

app.get(
    "/api/my-notes",
    function (req, res) {

        if (!req.session.user) {

            return res.status(401).json({

                error:
                    "Please login first."

            });

        }


        try {

            const data =
                fs.readFileSync(
                    notesFile,
                    "utf8"
                );


            const notes =
                data.trim()
                    ? JSON.parse(data)
                    : [];


            const email =
                req.session.user.email;


            const myNotes =
                notes.filter(
                    function (note) {

                        return (
                            note.uploadedBy === email
                        );

                    }
                );


            res.json(myNotes);

        } catch (error) {

            res.json([]);

        }

    }
);


// ===============================
// DELETE NOTE
// ===============================

app.post(
    "/api/delete-note",
    function (req, res) {

        if (!req.session.user) {

            return res.status(401).json({

                error:
                    "Please login first."

            });

        }


        const fileName =
            String(
                req.body.fileName || ""
            ).trim();


        if (!fileName) {

            return res.status(400).json({

                error:
                    "File name is required."

            });

        }


        try {

            const data =
                fs.readFileSync(
                    notesFile,
                    "utf8"
                );


            const notes =
                data.trim()
                    ? JSON.parse(data)
                    : [];


            const email =
                req.session.user.email;


            const noteIndex =
                notes.findIndex(
                    function (note) {

                        return (
                            note.fileName === fileName &&
                            note.uploadedBy === email
                        );

                    }
                );


            if (noteIndex === -1) {

                return res.status(404).json({

                    error:
                        "Note not found or you do not have permission to delete it."

                });

            }


            const note =
                notes[noteIndex];


            notes.splice(
                noteIndex,
                1
            );


            fs.writeFileSync(
                notesFile,
                JSON.stringify(
                    notes,
                    null,
                    2
                )
            );


            const filePath =
                path.join(
                    uploadFolder,
                    note.fileName
                );


            if (
                fs.existsSync(filePath)
            ) {

                fs.unlinkSync(filePath);

            }


            res.json({

                success: true,

                message:
                    "Note deleted successfully."

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                error:
                    "Something went wrong while deleting the note."

            });

        }

    }
);


// ===============================
// EDIT NOTE
// ===============================

app.post(
    "/api/edit-note",
    function (req, res) {

        if (!req.session.user) {

            return res.status(401).json({

                error:
                    "Please login first."

            });

        }


        const fileName =
            String(
                req.body.fileName || ""
            ).trim();


        const title =
            String(
                req.body.title || ""
            ).trim();


        const course =
            String(
                req.body.course || ""
            ).trim();


        const subject =
            String(
                req.body.subject || ""
            ).trim();


        const semester =
            String(
                req.body.semester || ""
            ).trim();


        const description =
            String(
                req.body.description || ""
            ).trim();


        if (!fileName) {

            return res.status(400).json({

                error:
                    "File name is required."

            });

        }


        if (!title) {

            return res.status(400).json({

                error:
                    "Title is required."

            });

        }


        try {

            const data =
                fs.readFileSync(
                    notesFile,
                    "utf8"
                );


            const notes =
                data.trim()
                    ? JSON.parse(data)
                    : [];


            const email =
                req.session.user.email;


            const note =
                notes.find(
                    function (note) {

                        return (
                            note.fileName === fileName &&
                            note.uploadedBy === email
                        );

                    }
                );


            if (!note) {

                return res.status(404).json({

                    error:
                        "Note not found or you do not have permission to edit it."

                });

            }


            note.title =
                title;

            note.course =
                course;

            note.subject =
                subject;

            note.semester =
                semester;

            note.description =
                description;


            fs.writeFileSync(
                notesFile,
                JSON.stringify(
                    notes,
                    null,
                    2
                )
            );


            res.json({

                success: true,

                message:
                    "Note updated successfully."

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                error:
                    "Something went wrong while editing the note."

            });

        }

    }
);


// ===============================
// LOGOUT
// ===============================

app.get(
    "/logout",
    function (req, res) {

        req.session.destroy(
            function (error) {

                if (error) {

                    return res.send(`
                        <h2>❌ Logout failed.</h2>
                    `);

                }


                res.redirect("/");

            }
        );

    }
);


// ===============================
// START SERVER
// ===============================

app.listen(
    PORT,
    function () {

        console.log(
            "StudyShare server is running at http://localhost:" +
            PORT
        );

    }
);