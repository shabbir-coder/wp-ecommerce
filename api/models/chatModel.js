const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ITS: { type: String, required: true },
  number: { type: String, required: true },
  isVerified : {type: Boolean, default: false},
  lastIzantaken: {type: Date},
  isAdmin: {type: Boolean, default: false}
});

const chatLogs = new mongoose.Schema({
  sender: { type: String},
  reciever : {type: String},
  instance_id: {type: String},
  usedFile: {type: mongoose.Schema.Types.ObjectId, ref: 'files'}
}, { timestamps: true }
);


const chatSchema = new mongoose.Schema({
  usedFile: {type: mongoose.Schema.Types.ObjectId, ref: 'files'},
  sender: { type: String},
  reciever: { type: String },
  instance_id: {type: String},
  text: { type: String},
  type: {type: String},
  // Add other message-related fields as needed
}, { timestamps: true }
);

const ChatLogs = mongoose.model('chatLogs', chatLogs);
const Contact = mongoose.model('contact', contactSchema);
const Message = mongoose.model('message', chatSchema);

module.exports = { Contact, Message, ChatLogs };
