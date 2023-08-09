const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: process.env.NODE_ENV === "development" ? 1000 : 5000,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`.bgGreen);
    } catch (error) {
        throw new Error(error);
    }
};

module.exports = connectDB;
