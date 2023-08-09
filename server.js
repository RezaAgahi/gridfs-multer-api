const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "configs", ".env") });
const express = require("express");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const mongoose = require("mongoose");
const crypto = require("crypto");
require("colors");
const connectDB = require("./configs/connectDB");

const PORT = process.env.PORT || 3000;
const mongoURI = process.env.mongoURI;

connectDB();

process.on("unhandledRejection", (reason, promise) => {
    console.log("Unhandled Rejection at:\n", "\nPROMISE\n\n".red, promise, "\nreason:\n\n".red, reason);
});

let bucket;
mongoose.connection.on("connected", () => {
    const db = mongoose.connections[0].db;
    bucket = new mongoose.mongo.GridFSBucket(db, {
        bucketName: "uploads",
    });

    console.log(`bucket created`.bgCyan);
});

const app = express();

var storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }

                const filename = buf.toString("hex") + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    metadata: { orginaleName: file.originalname },
                    bucketName: "uploads",
                };
                resolve(fileInfo);
            });
        });
    },
});
const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
    try {
        res.status(200).json({
            success: true,
            file: {
                id: req.file.id,
                name: req.file.filename,
            },
        });
    } catch (error) {
        throw new Error(error);
    }
});

app.get("/files", async (req, res) => {
    try {
        const files = await bucket.find({}).project({ _id: 1, filename: 1 }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({
                success: false,
                msg: "No Files",
            });
        } else {
            return res.json({
                success: true,
                total: files.length,
                files,
            });
        }
    } catch (error) {
        throw new Error(error);
    }
});

app.get("/files/:filename", async (req, res) => {
    try {
        const file = await bucket
            .find({
                filename: req.params.filename,
            })
            .project({ _id: 1, filename: 1 })
            .toArray();

        if (!file || file.length === 0) {
            return res.status(400).json({
                success: false,
                msg: "No Such File",
            });
        } else {
            return res.json({
                success: true,
                file,
            });
        }
    } catch (error) {
        throw new Error(error);
    }
});

app.get("/files/stream/:filename", async (req, res) => {
    try {
        const file = await bucket
            .find({
                filename: req.params.filename,
            })
            .toArray();

        if (!file || file.length === 0) {
            return res.status(400).json({
                success: false,
                msg: "No Such File",
            });
        } else {
            const stream = bucket.openDownloadStreamByName(req.params.filename);

            stream.on("data", (chunk) => {
                res.write(chunk);
            });
            stream.on("error", () => {
                res.sendStatus(404);
            });
            stream.on("end", () => {
                res.end();
            });
        }
    } catch (error) {
        throw new Error(error);
    }
});

app.delete("/files/del/:id", async (req, res) => {
    try {
        const ObjectId = require("mongoose").Types.ObjectId;

        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                msg: "Invalid Id",
            });
        }

        const file = await bucket
            .find({
                _id: new mongoose.Types.ObjectId(req.params.id),
            })
            .toArray();

        if (!file || file.length === 0) {
            return res.status(400).json({
                success: false,
                msg: "No Such File",
            });
        } else {
            await bucket.delete(new mongoose.Types.ObjectId(req.params.id));

            return res.json({
                success: true,
            });
        }
    } catch (error) {
        console.log(error);
        throw new Error(error);
    }
});

app.use((err, req, res, next) => {
    console.log(err);

    if (err.message == "Unexpected field") {
        return res.status(400).json({
            success: false,
            msg: "Only one file allowed with fieldname 'file'",
        });
    }

    res.status(500).json({
        success: false,
        msg: "Internal server error",
        reason: err.message,
    });
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`.bgYellow);
});
