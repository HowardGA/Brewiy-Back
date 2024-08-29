const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const userRoute = require("./routes/user");
const cors = require("cors"); // Import the cors module

// settings
const app = express();
const port = process.env.PORT || 9000;

// middlewares
app.use(cors({ 
  origin: ["http://localhost:3000", "http://192.168.1.187:3000", "http://127.0.0.1:3000","172.18.4.164:3000"], 
}));//app.use(cors({ origin: "http://192.168.226.154", credentials: true }));
app.use(express.json());
app.use("/api", userRoute);

// routes
app.get("/", (req, res) => {
  res.send("Welcome to my API");
});

// mongodb connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => console.error(error));

// server listening
app.listen(port, () => console.log("Server listening to", port));

