const mongoose = require("mongoose");

// One registration submitted from the public "Register Now" form against a
// health camp. Stored as a sub-document so the camp card can show how many
// people have registered without extra collections or joins.
const registrationSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, default: "" },
        phone: { type: String, required: true, trim: true },
        age: { type: Number, default: null },
        notes: { type: String, default: "" },
    },
    { timestamps: true }
);

const healthCampSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        date: { type: Date, required: true },
        start_time: { type: String, default: "" },
        end_time: { type: String, default: "" },
        venue: { type: String, default: "" },
        address: { type: String, default: "" },
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        pincode: { type: String, default: "" },
        contact_person: { type: String, default: "" },
        contact_number: { type: String, default: "" },
        contact_email: { type: String, default: "" },
        image: { type: String, default: "" },
        is_active: { type: Boolean, default: true },
        registration_required: { type: Boolean, default: false },
        registration_limit: { type: Number, default: null },
        additional_notes: { type: String, default: "" },
        registrations: [registrationSchema],
    },
    { timestamps: true }
);

module.exports = mongoose.model("HealthCamp", healthCampSchema);
