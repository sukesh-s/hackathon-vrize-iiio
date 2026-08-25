const crypto = require("node:crypto");
const fs = require("node:fs");

function calculateSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const input = fs.createReadStream(filePath);

    input.on("data", (chunk) => {
      hash.update(chunk);
    });

    input.on("error", reject);

    input.on("end", () => {
      resolve(hash.digest("hex"));
    });
  });
}

async function getFileType(filePath) {
  const { fileTypeFromFile } = await import("file-type");
  return (await fileTypeFromFile(filePath)) || null;
}

async function getMimeType(filePath) {
  const fileType = await getFileType(filePath);
  return fileType?.mime || null;
}

async function isWavFile(filePath) {
  const fileType = await getFileType(filePath);
  return fileType?.ext === "wav" && fileType?.mime === "audio/wav";
}

module.exports = {
  calculateSha256,
  getFileType,
  getMimeType,
  isWavFile,
};
