// const {getIO} = require('../../connection/socket')
const axios = require('axios');
const Instance = require('../models/instanceModel')
const {Message, Contact, ChatLogs, Cart, Invoice} = require('../models/chatModel');
const User = require('../models/user');
const {File, Images, chatConfig} = require('../models/fileModel')
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs')
const { getCachedData } = require('../middlewares/cache');
const moment = require('moment-timezone');
const handlebars = require('handlebars');
const pdf = require('html-pdf');


const dataKey = 'activeSet';


const recieveMessages = async (req, res)=>{
  try {
    const messageObject = req.body;
    if(messageObject.data?.data?.messages?.[0]?.key?.fromMe === true) return res.send()
    if(["messages.upsert"].includes(req.body?.data?.event)){
      // console.log(messageObject.data.data.messages?.[0]?.message)
      let message;
      const currentTime = moment();

      message = messageObject.data.data.messages?.[0]?.message?.extendedTextMessage?.text || messageObject.data.data.messages?.[0]?.message?.conversation || '';
      let remoteId = messageObject.data.data.messages?.[0]?.key.remoteJid.split('@')[0];
      message = '_'+message.toLowerCase();
      const recieverId = await Instance.findOne({instance_id: messageObject.instance_id})
      const newMessage = {
        reciever : ''+recieverId?.number,
        sender: remoteId,
        instance_id: messageObject?.instance_id,
        text: message,
        type: 'text'
      }
      // const savedMessage = new Message(newMessage);
      // await savedMessage.save();
      const sendMessageObj={
        number: remoteId,
        type: 'text',
        instance_id: messageObject?.instance_id,
      }
      
      console.log(recieverId)

      if(!recieverId) return res.send(true);

      if(recieverId?.isDeleted){
        const response = await sendMessageFunc({...sendMessageObj,message: 'Number has been deleted or deactivated by propreiter.'});
        return res.send(true) 
      }
      
      let config = await chatConfig.findOne({createdBy: recieverId.createdBy}) 
      let { hours, minutes } = config.sessionDuration;

      let nowTime = new Date();
      let sessionDurationMillis = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);

      let sessionStartTime = new Date(nowTime.getTime() - sessionDurationMillis);

      let start = new Date();
      start.setHours(0,0,0,0);

      let end = new Date();
      end.setHours(23,59,59,999);

      const previousChat =  await Message.findOne({
        sender:remoteId, 
        reciever: recieverId?.number ,
        instance_id: messageObject?.instance_id,
        updatedAt: { $gte: sessionStartTime, $lt: nowTime }
      }).sort({updatedAt:-1})


      let useSet;
      if(!previousChat){
        useSet = await File.find({uploadedBy: recieverId.createdBy ,status:'active', isDeleted:false});
        for (const set of useSet) {
          const firstKey = set.startingKeyword.toLowerCase();
          if (message === firstKey) {
              newMessage.usedFile = set._id;
              const savedMessage = new Message(newMessage);
              await savedMessage.save();
              const response = await sendMessageFunc(
                {...sendMessageObj,
                  message: set.json.find(obj => obj?.key === firstKey)?.value});
              return res.send(true);
          } else {
              // const response = await sendMessageFunc({...sendMessageObj, message: `Send ${firstKey.replace('_', '')} to start your chat`});
              return res.send(true);
          }
        }
      }else{
        useSet = await File.findOne({_id:previousChat.usedFile,isDeleted:false});
        if(!useSet){
          const response = await sendMessageFunc({...sendMessageObj,message: `Your chat is deleted by admin.`});
          return res.send(true)  
        }
        newMessage.usedFile = useSet._id;
        let replyObj = useSet.json.find(obj => obj?.key === message);
        if(replyObj){
          if(replyObj?.price){
            const image = await Images.findOne(
              { 
                fileId: useSet._id,
                "images.keyName": message.replace('_', '')
              },
              { 
                "images.$": 1 
              }
            );
            console.log(image?.images[0])
            if(image){
              sendMessageObj.type='media',
              sendMessageObj.media_url= process.env.IMAGE_URL + image?.images[0]?.imageUrl,
              sendMessageObj.filename = image?.images[0]?.imageName
              replyObj.value += '\nType "Buy" to purchase product'
            }
          }
          const response = await sendMessageFunc({...sendMessageObj,message: replyObj.value});
          const savedMessage = new Message(newMessage);
          await savedMessage.save();
          return res.send(true);
        }else{
          if(message==='_buy'){
            if(useSet.json.find(obj => obj?.key === previousChat.text)?.price){
              previousChat.isBuyingRequest=true;
              await previousChat.save();
              const response = await sendMessageFunc({...sendMessageObj, message: 'Provide quantity , type only the unit of quanity you want.'});
            }else{
              const response = await sendMessageFunc({...sendMessageObj, message: 'Product not selected , type appropriate product code first.'});
            }
            return res.send(true); 
          }
          if(/^(100|[1-9][0-9]?)$/.test(parseInt(message.replace('_','')))){
            if(!previousChat.isBuyingRequest){
              const response = await sendMessageFunc({...sendMessageObj, message: 'Product not selected , type appropriate product code then type \'buy\' first.'});
              return res.send(true); 
            }
            const carts = await Cart.find({
              userNumber: remoteId,
              status:'inCart', 
              _id: { $ne: previousChat?.cartId },
              product : {$ne: previousChat.text},
              updatedAt: { $gte: sessionStartTime, $lt: nowTime }
            });
            console.log('carts',carts)
            let grandTotal = 0;
            carts?.forEach(item => grandTotal += parseInt(item?.total));

            let product = useSet.json.find(obj => obj?.key === previousChat.text);
            const previousCart = await Cart.findOne({
              userNumber: remoteId,
              product : previousChat.text,
              instance_id : messageObject?.instance_id,
              status : 'inCart',
              updatedAt: { $gte: sessionStartTime, $lt: nowTime }
            });
            if(previousCart){
              previousCart.quantity = message.replace('_','');
              previousCart.total = (+product?.price)*(+message.replace('_',''));
              let cartSummary = `*Your Total till now :* ${+grandTotal+(+previousCart.total)}\r\n`;
              const replyMessage = `✨✨ *Product ${previousChat.text.replace('_','')}* has been added to your cart\r\n` +
              `${previousCart.product.replace('_','')} x ${previousCart.quantity} = *${previousCart.total}*  _( ${product.price} )_\r\n\r\n` +
              cartSummary +
              `Type *'${config.CartKeyword}'* to check your cart` ;
              
              await previousCart.save()
              const response = await sendMessageFunc({...sendMessageObj, message: replyMessage});
              return res.send(true);

            }else{

              const newCart = { 
                userNumber: remoteId,
                product : previousChat.text,
                price : product?.price,
                quantity : message.replace('_',''),
                total: (+product?.price)*(+message.replace('_','')),
                status : 'inCart',
                instance_id : messageObject?.instance_id
              }
              let cartSummary = `*Your Total till now :* ${+grandTotal+(+newCart.total)}\r\n`;
              const replyMessage = `✨ *Product ${previousChat.text.replace('_','')}* has been added to your cart\r\n` +
              `${newCart.product.replace('_','')} x ${newCart.quantity} = *${newCart.total}*  _( ${newCart.price} each )_\r\n\r\n` +
              cartSummary + `Type *'${config.CartKeyword}'* to check your cart` ;
  
              const cartData = await new Cart(newCart).save();
  
              const response = await sendMessageFunc({...sendMessageObj, message: replyMessage});
              return res.send(true);
            }
            
          }
          if(message === '_' + config.CartKeyword.toLowerCase()){

            const carts = await Cart.find({userNumber: remoteId, status:'inCart', updatedAt: { $gte: sessionStartTime, $lt: nowTime }});
            if(!carts.length){
              const response = await sendMessageFunc({...sendMessageObj,message: 'No cart found!, Type \'Products\' and start shopping '});
              return res.send(true);    
            }
            let grandTotal = 0;
            carts.forEach(item => grandTotal += parseInt(item.total));
            let cartSummary = "_product ---- qty x price = total_\r\n\r\n";
            carts.forEach((item, i) => {
                cartSummary += `${i+1} - ${item.product}_ ------ ${item.quantity} x ${item.price} ==== *${item.total}*\r\n`;
            });
            cartSummary += `\r\n*Grand Total: ${grandTotal}*`;
            cartSummary += `\r\n\r\nTo remove product from your ${config?.CartKeyword}, type *remove product code* . Example 'remove de1p1'.`;
            cartSummary += `\r\nType *${config.paymentKeyword}* to pay and confirm your order`
            const response = await sendMessageFunc({...sendMessageObj,message: cartSummary});
            return res.send(true);  
          }
          if(message==='_' + config.paymentKeyword.toLowerCase()){
            const contact = await Contact.findOne({number: remoteId})
            if(!contact){
              await new Contact({number: remoteId, adressTrackingActive: true}).save();
              const response = await sendMessageFunc({...sendMessageObj,message: 'Please provide your name'});
              return res.send(true);  
            }else{
              if(contact.adressTrackingActive){
                const trackSteps = ['name', 'address', 'city', 'state', 'pinCode'];
                const updateStep = trackSteps[contact.trackingStep] 
                const response = await sendMessageFunc({...sendMessageObj,message: 'Please provide your ' + updateStep});
                return res.send(true);  
              }else{
                let userAddress = `*Hi ${contact.name.charAt(0).toUpperCase() + contact.name.slice(1)}*`;
                userAddress += `\n\rYour Delivery *Address*`
                userAddress += `\n\r${contact.address},`
                userAddress += `\n\r${contact.city} - ${contact.pinCode}`;
                userAddress += `\n\r${contact.state}`;
                userAddress += `\n\rCheck your address once, Type "Confirm" to proceed. Type "change" to change`
                console.log('contact', contact);
                const response = await sendMessageFunc({...sendMessageObj,message: userAddress});
                return res.send(true); 
              }
            }
          }
          if(message==='_change'){
            const contact = await Contact.findOne({number: remoteId,adressTrackingActive : false})
            if(contact){
              contact.adressTrackingActive = true;
              contact.trackingStep = 0;
              contact.save()
              const response = await sendMessageFunc({...sendMessageObj,message: 'Please provide your name' });
              return res.send(true);
            }
          }
          if(message==='_confirm'){
            const contact = await Contact.findOne({number: remoteId,adressTrackingActive : false})
            const carts = await Cart.find({userNumber: remoteId, status:'inCart', updatedAt: { $gte: sessionStartTime, $lt: nowTime }});
            const subTotal = carts.reduce((acc, item) => acc + parseFloat(item.total), 0).toFixed(2)
            const gst = 0;
            const otherCharges = 0;
            const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 }).exec();
            const lastInvoiceNumber = lastInvoice ? parseInt(lastInvoice.invoiceNumber.replace('INV', '')) : 0;
            const newInvoiceNumber = `INV${String(lastInvoiceNumber + 1).padStart(7, '0')}`;

            const templateVar = {
              "invoiceNumber": newInvoiceNumber,
              "createdAt": currentTime.format('MMM DD, YYYY, hh:mm a'),
              "name": contact.name,
              "address": contact.address,
              "city": contact.city,
              "state": contact.state,
              "pincode": contact.pinCode,
              "items": carts.map(item => ({
                product: item.product.replace('_',''),
                price: parseFloat(item.price).toFixed(2),
                quantity: item.quantity,
                total: parseFloat(item.total).toFixed(2)
              })),
              "subTotal": subTotal,
              "gst": gst,
              "otherCharges": otherCharges,
              "totalAmount": subTotal,
            }

            let payment = {};

            if(payment){
              templateVar["paymentStatus"] = payment?.paymentStatus || 'N/A',
              templateVar["transactionNumber"] = payment.transactionNumber || 'N/A',
              templateVar["paymentDate"] = payment.time || 'N/A',
              templateVar["outstandingAmount"] = templateVar.totalAmount - ( payment.amount || 0);
            }
            
            const options = {
              format: 'A4'
            };
          
            const templateSource = fs.readFileSync(`${process.cwd()}/api/assets/pdfs/invoice.hbs`, 'utf8');
            const template = handlebars.compile(templateSource);
            const html = template(templateVar);
            const fileName = `invoice-${new Date().getTime()}.pdf`
            const filePath = `/uploads/pdfs/${fileName}`
            templateVar.filePath = filePath;

            await new Invoice(templateVar).save();
            pdf.create(html, options).toFile(`${process.cwd()}${filePath}`, function(err, res) {
              if (err) return console.log(err);
              console.log('PDF created successfully:', res.filename);
            });
            console.log(contact, carts)

            
            sendMessageObj.type='media',
            sendMessageObj.media_url= process.env.IMAGE_URL + filePath,
            sendMessageObj.filename = fileName
            const message = 'Please Download your Invoice\nThanks for order'
          

            const response = await sendMessageFunc({...sendMessageObj,message });
            return res.send(true);
          }
          if(/_remove/i.test(message)){
            const product = message.split(' ')
            if(!product[1]){
              const response = await sendMessageFunc({...sendMessageObj,message: `*Product* *not found* in your ${config?.CartKeyword}`});
              return res.send(true);  
            }
            const cart = await Cart.findOne({
              userNumber: remoteId,
              product:'_'+product[1],
              status:'inCart',
              updatedAt: { $gte: sessionStartTime, $lt: nowTime }
            });
            console.log(cart)
            if(!cart){
              const response = await sendMessageFunc({...sendMessageObj,message: `*Product-${product[1]}* *not found* in your ${config?.CartKeyword}`});
              return res.send(true);  
            }else{
              cart.isRemoved = true;
              cart.status = 'isRemoved'
              console.log(cart)
              await cart.save();

              let cartSummary = `*Product-${product[1]}* *removed* from your ${config?.CartKeyword}`;
              cartSummary += '\r\nYour updated cart is as follows 👇\r\n\r\n'
              const carts = await Cart.find({userNumber: remoteId, status:'inCart', updatedAt: { $gte: sessionStartTime, $lt: nowTime }});
            if(!carts.length){
              const response = await sendMessageFunc({...sendMessageObj,message: 'No cart found!, Type \'Products\' and start shopping '});
              return res.send(true);    
            }
            let grandTotal = 0;
            carts.forEach(item => grandTotal += parseInt(item.total));
            cartSummary += "_product ---- qty x price = total_\r\n\r\n";
            carts.forEach((item, i) => {
                cartSummary += `${i+1} - ${item.product}_ ------ ${item.quantity} x ${item.price} ==== *${item.total}*\r\n`;
            });
            cartSummary += `\r\n*Grand Total: ${grandTotal}*`;
            cartSummary += `\r\n\r\nTo remove product from your ${config?.CartKeyword}, type *remove product code* . Example 'remove de1p1'.`;
            cartSummary += `\r\nType *${config.paymentKeyword}* to pay and confirm your order`
            const response = await sendMessageFunc({...sendMessageObj,message: cartSummary});
            return res.send(true);

            }
          }else{
            const activeContact = await Contact.findOne({number: remoteId, adressTrackingActive: true});
            if(activeContact){
              const trackSteps = ['name', 'address', 'city', 'state', 'pinCode'];
              const updateStep = trackSteps[activeContact.trackingStep] 
              activeContact[updateStep]=message.replace('_','');
              activeContact.trackingStep += 1;
              console.log(activeContact)
              if(activeContact.trackingStep === trackSteps.length){
                activeContact.adressTrackingActive = false
                activeContact.save()
                let userAddress = `*Hi ${activeContact.name.charAt(0).toUpperCase() + activeContact.name.slice(1)}*`;
                userAddress += `\n\rYour Delivery *Address* is saved.`
                userAddress += `\n\r${activeContact.address},`
                userAddress += `\n\r${activeContact.city} - ${activeContact.pinCode}`;
                userAddress += `\n\r${activeContact.state}`;
                userAddress += `\n\rType "Confirm" to proceed. Type "change" to change`
                const response = await sendMessageFunc({...sendMessageObj,message: userAddress });
                return res.send(true);
              }
              activeContact.save()
              const response = await sendMessageFunc({...sendMessageObj,message:`Please Provide ${trackSteps[activeContact.trackingStep]}` });
              return res.send(true);
            }
            const response = await sendMessageFunc({...sendMessageObj,message:'Invalid Input' });
            return res.send(true);
          }
        }
      }
    }else{
      return res.send(true);
    }

  } catch (error) {
    console.error(error);

    res.status(500).json({ error });
  } 
}

const sendMessageFunc = async (message)=>{
  console.log('message',message)
  const url = process.env.LOGIN_CB_API
  const access_token = process.env.ACCESS_TOKEN_CB
  const response = await axios.get(`${url}/send`,{params:{...message,access_token}})
  return true;
}

const getReport = async (req, res)=>{
  const { fromDate, toDate } = req.query;
  
  if (fromDate && toDate) {
    startDate = new Date(fromDate);
    endDate = new Date(toDate);
}

  let dateFilter = {};
  if (startDate && endDate) { // If both startDate and endDate are defined, add a date range filter
    dateFilter = {
        "updatedAt": {
            $gte: startDate,
            $lt: endDate
        }
    };
}

  let query =[
    {$match: { instance_id:req.params.id ,...dateFilter } },
    {$lookup : {
      from: 'contacts',
      localField: 'requestedITS',
      foreignField: 'ITS',
      as: 'contact'
    }},
    {$lookup : {
      from: 'instances',
      localField: 'instance_id',
      foreignField: 'instance_id',
      as: 'instance'
    }},
    {$unwind:{
      path: '$instance',
      preserveNullAndEmptyArrays: true
    }},
    {$unwind:{
      path: '$contact',
      preserveNullAndEmptyArrays: true
    }},
    {
      $addFields: {
        PhoneNumber: { $toString: "$contact.number" }, // Convert to string
        location: {
          $let: {
            vars: {
              lastKey: {
                $arrayElemAt: [
                  { $objectToArray: "$otherMessages" }, // Convert otherMessages object to array of key-value pairs
                  { $subtract: [{ $size: { $objectToArray: "$otherMessages" } }, 1] } // Get the index of the last element
                ]
              }
            },
            in: { $toDouble: "$$lastKey.v" } // Convert the value of the last element to double
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        Name: '$contact.name',
        PhoneNumber: 1,
        ITS: '$contact.ITS',
        Time: '$updatedAt',
        Response: '$finalResponse',
        updatedAt: { $dateToString: { format: "%m %d %Y", date: "$updatedAt" } },
        location: 1
      }
    }
  ]
  const data = await ChatLogs.aggregate(query);
  // console.log(data)
  
  const csvWriter = createCsvWriter({
    path: './download.csv',
    header: [
      { id: 'Name', title: 'Name' },
      { id: 'PhoneNumber', title: 'Phone Number', stringQuote: '"' },
      { id: 'ITS', title: 'ITS' },
      { id: 'Response', title: 'Response' },
      { id: 'updatedAt', title: 'Updated At' },
      { id: 'location', title: 'Location' },
    ]
  });

  await csvWriter.writeRecords(data);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=report.csv');

  const fileStream = fs.createReadStream('./download.csv');
  fileStream.pipe(res);
}


async function getReportdataByTime(startDate, endDate, id){

  let dateFilter = {};
  if (startDate && endDate) { // If both startDate and endDate are defined, add a date range filter
    dateFilter = {
        "updatedAt": {
            $gte: startDate,
            $lt: endDate
        }
    };
  }


  let query =[
    {$match: { instance_id:id ,...dateFilter, isValid:true } },
    {$lookup : {
      from: 'contacts',
      localField: 'requestedITS',
      foreignField: 'ITS',
      as: 'contact'
    }},
    {$lookup : {
      from: 'instances',
      localField: 'instance_id',
      foreignField: 'instance_id',
      as: 'instance'
    }},
    {$unwind:{
      path: '$instance',
      preserveNullAndEmptyArrays: true
    }},
    {$unwind:{
      path: '$contact',
      preserveNullAndEmptyArrays: true
    }},
    {
      $addFields: {
        PhoneNumber: { $toString: "$contact.number" }, // Convert to string
        location: {
          $let: {
            vars: {
              lastKey: {
                $arrayElemAt: [
                  { $objectToArray: "$otherMessages" }, // Convert otherMessages object to array of key-value pairs
                  { $subtract: [{ $size: { $objectToArray: "$otherMessages" } }, 1] } // Get the index of the last element
                ]
              }
            },
            in: { $toDouble: "$$lastKey.v" } // Convert the value of the last element to double
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        Name: '$contact.name',
        PhoneNumber: 1,
        ITS: '$contact.ITS',
        Time: '$updatedAt',
        Response: '$finalResponse',
        updatedAt: { $dateToString: { format: "%m %d %Y", date: "$updatedAt" } },
        location: 1
      }
    }
  ]
  const data = await ChatLogs.aggregate(query);
  return data ;
}

function isTimeInRange(startTime, endTime, timezoneOffset = 0) {
  // Get the current date/time in UTC
  const nowUtc = new Date();
  console.log({startTime, endTime})
  // Convert it to the target timezone
  const now = new Date(nowUtc.getTime() + timezoneOffset * 60 * 60 * 1000);

  // Parse start and end times as Date objects
  const start = new Date(startTime);
  start.setUTCDate(nowUtc.getUTCDate());
  start.setUTCMonth(nowUtc.getUTCMonth());
  start.setUTCFullYear(nowUtc.getUTCFullYear());

  const end = new Date(endTime);
  end.setUTCDate(nowUtc.getUTCDate());
  end.setUTCMonth(nowUtc.getUTCMonth());
  end.setUTCFullYear(nowUtc.getUTCFullYear());
  console.log(now,start,end)
  // Check if the current time falls within the start and end times
  return now >= start && now <= end;
}

function createInvoice (number) {

}

module.exports = {
  recieveMessages,
  getReport
};
