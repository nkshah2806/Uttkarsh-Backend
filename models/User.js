const mongoose = require("mongoose");
const { Types } = mongoose;
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
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
      default: "",
      trim: true,
    },
    mobileNumber: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    pinCode: {
      type: String,
      default: "",
      trim: true,
    },
    gender: {
      type: String,
      default: "",
    },
    birthDate: {
      type: Date,
      default: null,
    },
    image: {
      type: String,
      default: "",
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
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtuals for backward compatibility with frontend expecting firstname / lastname / name
userSchema.virtual("firstname").get(function () {
  if (!this.fullName) return "";
  return this.fullName.split(" ")[0] || "";
});

userSchema.virtual("lastname").get(function () {
  if (!this.fullName) return "";
  return this.fullName.split(" ").slice(1).join(" ") || "";
});

userSchema.virtual("name").get(function () {
  return this.fullName || "";
});

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
