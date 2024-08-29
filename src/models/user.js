const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Set the _id field to the value of the phone field
    _id: {
      type: String,
      unique: true,
      required: true,
      default: function () {
        return this.phone; // Set _id to the value of the phone field
      },
    },
    name: String,
    email: String,
    birthdate: String,
    password: String,
    data: [
      {
        StartDateTime: String,
        duration: Number,
        mode: String,
        beer: String,
        ingredients: String,
        ArrayHistory: [
          {
            DATE_TIME: String,
            T: Number,
            WP: String,
            BP: String,
            BTemp: Number,
          },
        ],
      },
    ],
  },
  { collection: 'Users' } // Specify the collection name here
);

module.exports = mongoose.model('User', userSchema);
