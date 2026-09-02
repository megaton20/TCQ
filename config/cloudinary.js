const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Minimal custom Multer storage engine that streams the incoming file
 * straight to Cloudinary. Written by hand instead of using
 * multer-storage-cloudinary, which only supports the Cloudinary v1 SDK
 * (v2 causes an ERESOLVE peer-dependency conflict on install).
 *
 * Sets file.path (secure_url) and file.filename (public_id) on the
 * resulting req.file/req.files, matching what the rest of the app expects.
 */
function makeCloudinaryStorage(folder) {
  return {
    _handleFile(req, file, cb) {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `carnival-queen/${folder}` },
        (error, result) => {
          if (error) return cb(error);
          cb(null, {
            path: result.secure_url,
            filename: result.public_id,
            size: result.bytes
          });
        }
      );
      file.stream.pipe(uploadStream);
    },
    _removeFile(req, file, cb) {
      if (!file.filename) return cb(null);
      cloudinary.uploader.destroy(file.filename, () => cb(null));
    }
  };
}

function makeUploader(folder) {
  return multer({ storage: makeCloudinaryStorage(folder), limits: { fileSize: 8 * 1024 * 1024 } });
}

module.exports = {
  cloudinary,
  uploadContestantImages: makeUploader('contestants'),
  uploadGalleryImages: makeUploader('gallery'),
  uploadApplicationDocs: makeUploader('applications')
};
