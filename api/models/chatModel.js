const { Timestamp } = require('mongodb');
const mongoose = require('mongoose');


const CartStatus = {
  IN_CART: 'inCart',
  IS_PAID: 'isPaid',
  IS_REMOVED: 'isRemoved'
};

const contactSchema = new mongoose.Schema({
  name: { type: String, required: false },
  number: { type: String, required: false },
  isVerified : {type: Boolean, default: false},
  adressTrackingActive: {type: Boolean, default: false},
  trackingStep : {type: Number, default:0},
  address: { type: String, required: false },
  city: {type: String},
  state: {type: String},
  pinCode: {type: Number}
}, {timestamps: true});

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
  isSearchingRequest: { type: Boolean, default:false},
  lastViewedColumn: { type: Number}
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
}, { timestamps: true })

const purchases = new mongoose.Schema({
  userNumber: {type: String},
  product: {type: String},
  quantity: {type: String},
  price: {type: String},
  status: {type: String},
  isRemoved: {type: Boolean , default: false},
  instance_id: {type: String}
}, { timestamps: true })

const itemSchema = new mongoose.Schema({
  product: { type: String, required: true },
  price: { type: String, required: true },
  quantity: { type: Number, required: true },
  total: { type: String, required: true }
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  createdAt: { type: String },
  name: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  items: [itemSchema],
  subTotal: { type: String },
  gst: { type: String },
  otherCharges: { type: String },
  totalAmount: { type: String },
  paymentStatus: { type: String },
  transactionNumber: { type: String },
  paymentDate: { type: String },
  outstandingAmount: { type: String },
  filePath: { type: String },
  updatedAt: {type : Date, default: Date.now()}
}, {Timestamp: true});



const ChatLogs = mongoose.model('chatLogs', chatLogs);
const Contact = mongoose.model('contact', contactSchema);
const Message = mongoose.model('message', chatSchema);
const Cart = mongoose.model('cart', cartSchema);
const Invoice = mongoose.model('invoice', invoiceSchema);


module.exports = { Contact, Message, ChatLogs, Cart, Invoice };
