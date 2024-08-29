const express = require("express");
const userSchema = require("../models/user");
const bcrypt = require("bcrypt");
const mqtt = require('mqtt');

const router = express.Router();

router.post("/login", async (req, res) => {
  const { name, password } = req.body;

  try {
    // Check if user exists
    const user = await userSchema.findOne({ name });
    console.log(name);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Validate password
    const isMatch =  bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({ userId: user._id, username: user.name  });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "An error occurred during login" });
  }
});

// Create a new user
router.post("/users", async (req, res) => {
  // Extract user data from the request body sent by the client-side registration form
  const { phone, name, email, birthdate, password } = req.body;
  const data = [];

  try {
    // Check if a user with the same name already exists
    const existingUser = await userSchema.findOne({ name });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Hash the password before saving it to the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user document using the userSchema model and the extracted data
    const newUser = new userSchema({
      _id: phone, // Set the _id field to the phone value
      phone,
      name,
      email,
      birthdate,
      password: hashedPassword, // Save the hashed password
      data,
    });

    // Save the new user document to the database
    const savedUser = await newUser.save();

    res.json(savedUser); // Respond with the saved user data in JSON format
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "An error occurred while creating the user" });
  }
});


// Get all users
router.get("/users", (req, res) => {
  userSchema
    .find()
    .then((users) => {
      // Map each user to the desired format
      const formattedUsers = users.map((user) => {
        const formattedData = user.data.map((dataObj) => ({
          StartDateTime: dataObj.StartDateTime,
          duration: dataObj.duration,
          mode: dataObj.mode,
          beer: dataObj.beer,
          ingredients: dataObj.ingredients,
          ArrayHistory: dataObj.ArrayHistory.map((item) => ({
            DATE_TIME: item.DATE_TIME,
            T: item.T,
            WP: item.WP,
            BP: item.BP,
            BTemp: item.BTemp,
          })),
        }));

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          birthdate: user.birthdate,
          password:user.password,
          data: formattedData,
        };
      });

      res.json(formattedUsers);
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
      res.status(500).json({ message: "An error occurred while fetching data" });
    });
});

// Get a single user by ID
router.get("/users/:id", (req, res) => {
  const { id } = req.params;

  userSchema
    .findById(id)
    .then((user) => {
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Map the data array to the desired format
      const formattedData = user.data.map((dataObj) => ({
        StartDateTime: dataObj.StartDateTime,
        duration: dataObj.duration,
        mode: dataObj.mode,
        beer: dataObj.beer,
        ingredients: dataObj.ingredients,
        ArrayHistory: dataObj.ArrayHistory.map((item) => ({
          DATE_TIME: item.DATE_TIME,
          T: item.T,
          WP: item.WP,
          BP: item.BP,
          BTemp: item.BTemp,
        })),
      }));

      // Create the userData object with the mapped data
      const userData = {
        _id: user._id,
        name: user.name,
        email: user.email,
        birthdate: user.birthdate,
        data: formattedData,
      };

      res.json(userData);
    })
    .catch((error) => {
      console.error("Error fetching user data:", error);
      res.status(500).json({ message: "An error occurred while fetching user data" });
    });
});


// Delete a user
router.delete("/users/:id", (req, res) => {
  const { id } = req.params;
  userSchema
    .remove({ _id: id })
    .then((data) => res.json(data))
    .catch((error) => res.json({ message: error }));
});

// Update a user
router.put("/users/:id", (req, res) => {
  // Extract the user ID from the URL parameter
  const { id } = req.params;
  // Extract updated user data from the request body sent by the client-side
  const { name, email, birthdate, data, password } = req.body;
  // Find the user document with the provided ID in the database
  userSchema
    .findById(id)
    .then((foundUser) => {
      if (!foundUser) {
        return res.status(404).json({ message: "User not found" });
      }
      // Update the user's properties with the new data
      foundUser.name = name;
      foundUser.email = email;
      foundUser.birthdate = birthdate;
      foundUser.data = data;
      if (password) {
        // If password is provided, update the hashed password
        foundUser.password = password; // Remember to hash the new password on the server-side for security
      }
      // Save the updated user document to the database
      foundUser
        .save()
        .then((updatedUser) => res.json(updatedUser)) // Respond with the updated user data in JSON format
        .catch((error) => res.status(500).json({ message: error.message }));
    })
    .catch((error) => res.status(500).json({ message: error.message }));
});

//get the phone number
router.get("/phone/:name", async (req, res) => {
  try {
    const { name } = req.params;

    // Find the user by their name in the userSchema
    const user = await userSchema.findOne({ name });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Assuming the phone number is stored in the 'phoneNumber' field of the userSchema
    const _id = user._id;

    // Return the phone number in the response
    return res.status(200).json({ _id });
  } catch (err) {
    // Handle errors appropriately
    return res.status(500).json({ error: 'Server error' });
  }
});

// MQTT to delete history charts
router.post("/publish-message", (req, res) => {
  try {
    const { phone, StartDateTime } = req.body;
    const message = { phone, StartDateTime };

    // Convert the message object to a JSON string
    const messageString = JSON.stringify(message);

    // Connect to the MQTT broker
    const client = mqtt.connect("mqtt://broker.hivemq.com"); // Replace with your MQTT broker URL

    client.on("connect", () => {
      console.log("Connected to MQTT broker");

      // Publish the message to the topic '/BrewIt/User/DelHC'
      client.publish("/BrewIt/User/DelHC", messageString, () => {
        console.log("Message published successfully");

        // Disconnect from the MQTT broker after publishing the message
        client.end();

        // Respond with a success message
        res.status(200).json({ message: "Message published successfully" });
      });
    });

    // Handle MQTT connection errors
    client.on("error", (error) => {
      console.error("Error connecting to MQTT broker:", error);
      res.status(500).json({ error: "Failed to publish the message" });
    });
  } catch (error) {
    console.error("Error publishing message:", error);
    res.status(500).json({ error: "Failed to publish the message" });
  }
});

// MQTT to delete ALL history charts
router.post("/deleteAllCharts", (req, res) => {
  try {
    const { phone } = req.body;
    const message = { phone };

    // Convert the message object to a JSON string
    const messageString = JSON.stringify(message);

    // Connect to the MQTT broker
    const client = mqtt.connect("mqtt://broker.hivemq.com"); // Replace with your MQTT broker URL

    client.on("connect", () => {
      console.log("Connected to MQTT broker");

      // Publish the message to the topic '/BrewIt/User/DelHC'
      client.publish("/BrewIt/User/DelHC/all", messageString, () => {
        console.log("Message published successfully all");

        // Disconnect from the MQTT broker after publishing the message
        client.end();

        // Respond with a success message
        res.status(200).json({ message: "Message published successfully" });
      });
    });

    // Handle MQTT connection errors
    client.on("error", (error) => {
      console.error("Error connecting to MQTT broker:", error);
      res.status(500).json({ error: "Failed to publish the message" });
    });
  } catch (error) {
    console.error("Error publishing message:", error);
    res.status(500).json({ error: "Failed to publish the message" });
  }
});

//filtered data from the arrayhistory
router.get("/users/:id/filtered", (req, res) => {
  const { id } = req.params;

  userSchema
    .findById(id)
    .then((user) => {
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const formattedData = user.data.map((dataObj) => {
        const totalReadings = dataObj.ArrayHistory.length;
        const filteredReadingsCount = Math.ceil(0.3 * totalReadings); 

        const stepSize = Math.floor(totalReadings / filteredReadingsCount);

        const filteredArrayHistory = dataObj.ArrayHistory.filter(
          (_, index) => index % stepSize === 0
        );

        return {
          StartDateTime: dataObj.StartDateTime,
          duration: dataObj.Duration,
          ArrayHistory: filteredArrayHistory.map((item) => ({
            DATE_TIME: item.DATE_TIME,
            T: item.T,
            WP: item.WP,
            BP: item.BP,
            BTemp: item.BTemp,
          })),
        };
      });

      const userData = {
        _id: user._id,
        name: user.name,
        email: user.email,
        birthdate: user.birthdate,
        data: formattedData,
      };

      res.json(userData);
    })
    .catch((error) => {
      console.error("Error fetching user data:", error);
      res.status(500).json({ message: "An error occurred while fetching user data" });
    });
});

module.exports = router;
