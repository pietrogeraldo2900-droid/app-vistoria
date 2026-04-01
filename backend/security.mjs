import crypto from "node:crypto";

export const createId = (prefix) => `${prefix}_${crypto.randomUUID()}`;

export const randomHex = (bytesLength = 16) =>
  crypto.randomBytes(bytesLength).toString("hex");

export const hashPassword = (password, salt) =>
  crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");

export const verifyPassword = (password, salt, expectedHash) =>
  hashPassword(password, salt) === expectedHash;

export const createAccessToken = () => `atk_${crypto.randomUUID()}`;

export const createRefreshToken = () => `rtk_${crypto.randomUUID()}`;
