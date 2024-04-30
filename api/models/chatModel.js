const mongoose = require('mongoose');


const CartStatus = {
  IN_CART: 'inCart',
  IS_PAID: 'isPaid',
  IS_REMOVED: 'isRemoved'
};

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
  usedFile: { type: mongoose.Schema.Types.ObjectId, ref: 'files'},
  sender: { type: String},
  reciever: { type: String },
  instance_id: {type: String},
  text: { type: String},
  type: { type: String},
  isBuyingRequest: { type: Boolean, default:false},
  // Add other message-related fields as needed
}, { timestamps: true }
);

const cartSchema = new mongoose.Schema({
  userNumber: {type: String},
  product: {type: String},
  quantity: {type: String, default:0},
  price: {type: String},
  total : {type: String},
  status: {type: String, enum: Object.values(CartStatus)},
  isRemoved: {type: Boolean , default: false},
  instance_id: {type: String}
})

const purchases = new mongoose.Schema({
  userNumber: {type: String},
  product: {type: String},
  quantity: {type: String},
  price: {type: String},
  status: {type: String},
  isRemoved: {type: Boolean , default: false},
  instance_id: {type: String}
})

const ChatLogs = mongoose.model('chatLogs', chatLogs);
const Contact = mongoose.model('contact', contactSchema);
const Message = mongoose.model('message', chatSchema);
const Cart = mongoose.model('cart', cartSchema);

module.exports = { Contact, Message, ChatLogs, Cart };
