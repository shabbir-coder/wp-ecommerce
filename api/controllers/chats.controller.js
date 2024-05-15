// const {getIO} = require('../../connection/socket')
const axios = require('axios');
const Instance = require('../models/instanceModel')
const {Message, Contact, ChatLogs, Cart} = require('../models/chatModel');
const User = require('../models/user');
const {File, Images, chatConfig} = require('../models/fileModel')
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs')
const { getCachedData } = require('../middlewares/cache');
const moment = require('moment-timezone');

const dataKey = 'activeSet';


const recieveMessage2 = async (req, res)=>{
  try {
    // const io = getIO();
    const activeSet = await getCachedData(dataKey)
    const messageObject = req.body;
    if(messageObject.data?.data?.messages?.[0]?.key?.fromMe === true) return res.send()
    if(["messages.upsert"].includes(req.body?.data?.event)){
      // console.log(messageObject.data.data.messages?.[0]?.message)
      let message;
      const currentTime = moment();
      const startingTime = moment(activeSet?.StartingTime);
      const endingTime = moment(activeSet?.EndingTime);

      message = messageObject.data.data.messages?.[0]?.message?.extendedTextMessage?.text || messageObject.data.data.messages?.[0]?.message?.conversation || '';
      let remoteId = messageObject.data.data.messages?.[0]?.key.remoteJid.split('@')[0];
      const senderId = await Contact.findOne({number: remoteId})
      
      const recieverId = await Instance.findOne({instance_id: messageObject.instance_id})
      const newMessage = {
        recieverId : recieverId?._id,
        senderId: senderId?._id,
        instance_id: messageObject?.instance_id,
        text: message,
        type: 'text'
      }
      const savedMessage = new Message(newMessage);
      await savedMessage.save();
      const sendMessageObj={
        number: remoteId,
        type: 'text',
        instance_id: messageObject?.instance_id,
      }
      
      if (!currentTime.isBetween(startingTime, endingTime)) {
        const response =  await sendMessageFunc({...sendMessageObj,message: "Registrations are closed now" });
        return res.send(true);      
      }
    
      // io.emit(messageObject?.instance_id.toString() , savedMessage);
      let start = new Date();
      start.setHours(0,0,0,0);

      let end = new Date();
      end.setHours(23,59,59,999);

      if(['report','reports'].includes(message.toLowerCase()) && senderId?.isAdmin){
        const reports = await getReportdataByTime(start,end, messageObject?.instance_id)
        const locationNames = ['Burhani Masjid', 'Saifee Masjid', 'Masakin Warqa', 'Majma', 'Not Attending'];

        const counts = reports.reduce((acc, {location}) => (acc[location] = (acc[location] || 0) + 1, acc), {});

        let reportString = 'Location\t\t\tCounts\n';
        locationNames.forEach((name, index) => {
          reportString += `${index + 1}.) ${name}\t= ${counts[index + 1] || 0}\n`;
        });

        const response =  await sendMessageFunc({...sendMessageObj, message: reportString });
        return res.send(true);
      }
      
      if(!senderId) {
        if(['izan','izzan','izaan','izann','iizan','iizzan'].includes(message.toLowerCase())){
          const response =  await sendMessageFunc({...sendMessageObj,message: 'Whatsapp Number not found on Anjuman Najmi Profile'});
          return res.send({message:'Account not found'});
        } else {
          return res.send({message:'Account not found'});
        }
      }

      if(['izan','izzan','izaan','izann','iizan','iizzan'].includes(message.toLowerCase())){
        console.log('verify')

        const response =  await sendMessageFunc({...sendMessageObj,message: activeSet.NumberVerifiedMessage });
        senderId.isVerified = true
        await senderId.save()
        return res.send(true)

      } else if ( senderId?.isVerified && /^\d{8}$/.test(message)){
        const ITSmatched = await Contact.findOne({number: remoteId, ITS:message})
        let responseText= '';
        const NewChatLog = await ChatLogs.findOneAndUpdate(
          {
            senderId: senderId?._id,
            instance_id: messageObject?.instance_id,
            requestedITS: message, // Ensure there is a registeredId
            updatedAt: { $gte: start, $lt: end } // Documents updated today
          },
          {
            $set: {
              updatedAt: Date.now(),
              isValid: ITSmatched? true: false
            }
          },
          {
            upsert: true, // Create if not found, update if found
            new: true // Return the modified document rather than the original
          }
        )
        if(ITSmatched){
           
            const izanDate = new Date(ITSmatched.lastIzantaken)
            if( izanDate >= start && izanDate <= end){
              console.log('saving from here')
              const response = await sendMessageFunc({...sendMessageObj,message:'Already registered ! Type cancel/change to update your venue' });
              return res.send(true)
            }
          // await sendMessageFunc({...sendMessageObj,message: 'Your ITS verified !  '})
          // responseText = 'Apne aaj raat na jaman nu izan araz kare che , Reply yes/no for confirmation'
          responseText = activeSet.ITSverificationMessage.replace('${name}', ITSmatched.name );
        } else {
          responseText = activeSet.ITSverificationFailed;
        }
        const response = await sendMessageFunc({...sendMessageObj,message: responseText});
        return res.send(true);

      // } else if (senderId.isVerified && ['yes','ok','okay','no'].includes(message.toLowerCase())){
      // // console.log('accept')
      // const response = await sendMessageFunc({...sendMessageObj,message:message.toLowerCase()!='no'? activeSet.AcceptanceMessage : activeSet.RejectionMessage })
      // await ChatLogs.findOneAndUpdate(  
      // {
      //         senderId: senderId?._id,
      // instance_id: messageObject?.instance_id,
      // updatedAt: { $gte: start, $lt: end }
      // },
      // {
      //         $set: {
      // finalResponse: message.toLowerCase()
      // }
      //       },
      // { 
      //         new: true,
      // sort: { updatedAt: -1 }
      // }
      //     )
      //   return res.send(true);

      } else if (senderId.isVerified && /^\d{4,7}$/.test(message)){
        const response =  await sendMessageFunc({...sendMessageObj,message: 'Incorrect ITS, Please enter valid ITS only' });
        return res.send(true)
      } else if (senderId.isVerified && /^\d{2,3}$/.test(message)){
        const response =  await sendMessageFunc({...sendMessageObj,message: 'Enter only valid choice nos' });
        return res.send(true)
      }  else if (senderId.isVerified && (message.match(/\n/g) || []).length !== 0){
        const response =  await sendMessageFunc({...sendMessageObj,message: 'Invalid Input' });
        return res.send(true)
      } else {
        if(!senderId.isVerified) return res.send(true);
        const latestChatLog = await ChatLogs.findOne(
          {
              senderId: senderId?._id,
              instance_id: messageObject?.instance_id,
              updatedAt: { $gte: start, $lt: end }
          }
        ).sort({ updatedAt: -1 });

        if(!latestChatLog.isValid){
          const response =  await sendMessageFunc({...sendMessageObj,message: 'Please enter valid ITS first' });
          return res.send(true);
        }

        const messages = Object.values(latestChatLog?.otherMessages || {});
        const requestedITS = await Contact.findOne({number: remoteId, ITS: latestChatLog?.requestedITS})
          
        const izanDate = new Date(requestedITS?.lastIzantaken)

        if( izanDate >= start && izanDate <= end && !['cancel','change'].includes(message.toLowerCase())){
          if(!['1','2','3','4','5'].includes(message.toLowerCase())){
            const response = await sendMessageFunc({...sendMessageObj,message:'Invalid Input' });
            return res.send(true)    
          }
          const response = await sendMessageFunc({...sendMessageObj,message:'Already registered ! Type cancel/change to update your venue' });
          return res.send(true)
        }
        if(['cancel','change'].includes(message.toLowerCase())){

          const latestChatLog = await ChatLogs.findOne(
            {
                senderId: senderId?._id,
                instance_id: messageObject?.instance_id,
                updatedAt: { $gte: start, $lt: end }
            }
          ).sort({ updatedAt: -1 });
          let lastKeyToDelete = null;
          if(!latestChatLog){
            const response =  await sendMessageFunc({...sendMessageObj,message: 'Nothing to cancel' });
            return res.send(true);
          }
          for (const [key, value] of Object.entries(latestChatLog?.otherMessages)) {
            if (!isNaN(value)) {
              lastKeyToDelete = key;
            }
          }
          
          if (lastKeyToDelete) {
            const update = { $unset: { [`otherMessages.${lastKeyToDelete}`]: "" }, $set: {updatedAt: Date.now() }
            };
            await ChatLogs.updateOne({ _id: latestChatLog?._id }, update);
          }

          const ITSmatched = await Contact.findOne({ITS: latestChatLog.requestedITS});
          ITSmatched.lastIzantaken=null
          await ITSmatched.save()

          const response =  await sendMessageFunc({...sendMessageObj,message: activeSet?.ITSverificationMessage.replace('${name}', ITSmatched.name )});
          return res.send(true);
        }

        if(!['1','2','3','4','5'].includes(message.toLowerCase())){
          const response = await sendMessageFunc({...sendMessageObj, message: 'Incorrect input. \nPlease enter corresponding number against each venue option only'} );
          return res.send(true);
        }

        const reply = processUserMessage(message, activeSet);
        
        if(latestChatLog?.requestedITS && reply?.message) {
          const reply = processUserMessage(message, activeSet);
          if(reply.messageType === '2'){
            sendMessageObj.type='media',
            sendMessageObj.media_url=reply?.mediaFile,
            sendMessageObj.filename = 'image.jpg'
          }
          const ITSmatched = await Contact.findOne({ITS: latestChatLog?.requestedITS});
          ITSmatched.lastIzantaken = new Date();
          ITSmatched.save()
          // console.log('reply', reply)
          const response = await sendMessageFunc({...sendMessageObj,message:reply?.message });

          const messages = Object.values(latestChatLog?.otherMessages || {});
          const isMessagePresent = messages.includes(message.toLowerCase());
          if (isMessagePresent) {
              // If the message is already present, do not update and return
              return latestChatLog;
          }
          let messageCount = latestChatLog?.otherMessages ? Object.keys(latestChatLog?.otherMessages).length : 0;
          messageCount++;
          const keyName = `FEILD_${messageCount}`;
          const updateFields = { $set: { [`otherMessages.${keyName}`]: message.toLowerCase() , updatedAt: Date.now()} };

          await ChatLogs.findOneAndUpdate(
            {
                senderId: senderId?._id,
                instance_id: messageObject?.instance_id,
                updatedAt: { $gte: start, $lt: end }
            },
            updateFields,
            { 
                new: true,
                sort: { updatedAt: -1 }
            }
          );
  
          return res.send(true);
        }
        const response = await sendMessageFunc({...sendMessageObj,message:'Invalid Input' });
        return res.send(true);
      }
    }else{
      return res.send(true);
    }
    // Save the message to the database

    // // Emit the message to all clients in the conversation room

  } catch (error) {
    console.error(error);

    res.status(500).json({ error: 'Internal server error' });
  } 
}

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
          if(/^\d+$/.test(parseInt(message.replace('_','')))){
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
            const response = await sendMessageFunc({...sendMessageObj,message: config.paymentLink});
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
  return response;
}

function processUserMessage(message, setConfig) {
  // Iterate through setData array to find matching keywords
  // console.log(setConfig.setData)
  if (!message) {
    return null;
  }
  for (const data of setConfig.setData) {
      for (const keyword of data.keywords) {
          if (keyword.toLowerCase().includes(message.toLowerCase())) {
              return data.answer;
          }
      }
  }
  return null; // Return default message if no matching keyword is found
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

module.exports = {
  recieveMessages,
  getReport
};
