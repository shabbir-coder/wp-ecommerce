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
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('File', fileSchema);
