/**
 * passwordCryptoService.js
 *
 * Reversible AES-256-GCM encryption used ONLY so an admin can retrieve a
 * member's portal login password from the Admin User Details page.
 *
 * The live authentication password on the User model remains a one-way
 * bcrypt hash. `passwordEncrypted` stores an encrypted copy of the plaintext
 * so it can be decrypted by an admin-only endpoint when needed.
 *
 * The encryption key is derived from JWT_SECRET. If that secret ever changes,
 * previously stored ciphertext can no longer be decrypted (acceptable and
 * expected behavior for this feature).
 */
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // GCM auth tag

const getKey = () => {
    const secret = process.env.JWT_SECRET || "default-jwt-secret";
    return crypto.createHash("sha256").update(String(secret)).digest();
};

/**
 * Encrypt a plaintext string. Returns a base64 payload
 * (iv || authTag || ciphertext). Empty values return "".
 */
const encrypt = (plaintext) => {
    if (plaintext === undefined || plaintext === null || String(plaintext) === "") {
        return "";
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(String(plaintext), "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
};

/**
 * Decrypt a payload produced by encrypt(). Returns the plaintext string,
 * or "" for empty / invalid input.
 */
const decrypt = (payload) => {
    if (!payload) return "";
    try {
        const buf = Buffer.from(payload, "base64");
        if (buf.length < IV_LENGTH + TAG_LENGTH) return "";
        const iv = buf.subarray(0, IV_LENGTH);
        const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString("utf8");
    } catch (error) {
        console.error("Failed to decrypt portal password:", error.message);
        return "";
    }
};

module.exports = { encrypt, decrypt };
