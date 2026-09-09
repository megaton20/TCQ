const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


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
