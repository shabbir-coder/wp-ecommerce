const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: String,
  contentType: String,
  url: String,
  status: {
    type: String,
    enum: ['active', 'pending', 'rejected', 'draft'],
    default: 'pending'
  },
  json: {type: {}},
  uploadedBy: {type: mongoose.Schema.Types.ObjectId },
  activeNumbers: [{type: String}],
  startingKeyword: {type: String},
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const imageSchema = new mongoose.Schema({
  keyName: {type: String },
  imageName: {type: String},
  imageType: {type: String },
  imageUrl: {type: String}
}, { timestamps: true });

const imagesCollectionSchema = new mongoose.Schema({
  fileId: {type: mongoose.Schema.Types.ObjectId },
  images: [{type: imageSchema}],
  uploadedBy: {type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

const File = mongoose.model('File', fileSchema);
const Images = mongoose.model('imagesCollection', imagesCollectionSchema);

module.exports = { File , Images};


