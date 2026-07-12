/**
 * OTP Service
 * Handles generation, storage, and verification of One-Time Passwords.
 */

const otpGenerator = require('otp-generator');
// Redis would be used for temporary storage of OTPs
// const Redis = require('ioredis');
// const redis = new Redis(process.env.REDIS_URL);

class OtpService {
    /**
     * Generate a 6-digit numeric OTP
     */
    generateOtp() {
        return otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false,
            digits: true
        });
    }

    /**
     * Save OTP to Redis with an expiration (e.g., 5 minutes)
     */
    async saveOtp(userId, otp) {
        const key = `otp:${userId}`;
        // await redis.set(key, otp, 'EX', 300);
        console.log(`[Mock] OTP for ${userId} saved: ${otp}`);
        return true;
    }

    /**
     * Verify the provided OTP against the stored one
     */
    async verifyOtp(userId, providedOtp) {
        const key = `otp:${userId}`;
        // const storedOtp = await redis.get(key);
        const storedOtp = "123456"; // Mock for now

        if (!storedOtp) return { valid: false, reason: 'EXPIRED' };
        if (storedOtp !== providedOtp) return { valid: false, reason: 'INVALID' };

        // await redis.del(key); // Clear OTP after successful verification
        return { valid: true };
    }
}

module.exports = new OtpService();
