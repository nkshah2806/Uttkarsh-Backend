const mongoose = require("mongoose");
const { Types } = mongoose;
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
      trim: true,
    },
    lastname: {
      type: String,
      required: false,
      trim: true,
    },
    gender: {
      type: String,
      required: false,
    },
    birthDate: {
      type: Date,
      required: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phoneNumber: {
      type: String,
      required: true,
      match: [/^\d{10}$/, "Phone number must be exactly 10 digits"],
    },
    image: {
      type: String,
      required: false,
    },
    deviceId: {
      type: String,
      default: "",
    },
    deviceName: {
      type: String,
      default: "",
    },
    fcmToken: {
      type: String,
      default: "",
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    jwtToken: {
      type: String,
      default: "",
      required: false,
    },
    otp: {
      type: String,
      default: "",
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Types.ObjectId,
    },
    updatedBy: {
      type: Types.ObjectId,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    age: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate();

  if (!update || !update.password) return;

  update.password = await bcrypt.hash(update.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
