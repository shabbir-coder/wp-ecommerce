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



const chatConfigSchema = new mongoose.Schema({
  paymentOptions: { type: String, required: false },
  QRLink: { type: String, required: false },
  paymentLink: { type: String, required: false },
  sessionDuration: {
      hours: { type: Number, required: true },
      minutes: { type: Number, required: true }
  },
  CartKeyword: { type: String, required: true },
  paymentKeyword: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, required: true }
});

const File = mongoose.model('File', fileSchema);
const Images = mongoose.model('imagesCollection', imagesCollectionSchema);
const chatConfig = mongoose.model('ChatConfig', chatConfigSchema);

module.exports = { File, Images, chatConfig};


