const SetModel = require('../models/setModel')
const {File, Images, chatConfig} = require('../models/fileModel')
const {clearCache} = require('../middlewares/cache')
// setController.js
const dataKey = 'activeSet';
const fs = require('fs')

exports.addSet = async (req, res) => {
  try {
    const newSetData = req.body;
    console.log(req.user)
    newSetData['createdBy']=req.user.userId
    const savedSet = await SetModel.create(newSetData);
    clearCache(dataKey)
    return res.json(savedSet);

  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


exports.validatekeywords = async(req,res)=>{
  try {
    const createdBy = req.user.userId;
    const keyword = req.body.keyword;
    const existingSet = await SetModel.find().lean();
    // const existingSet = await SetModel.find({ createdBy });
    const usedKeywords = existingSet.flatMap((set) => {
      return set.setData.flatMap((data) => {
        return data.keywords;
      });
    });
    if(usedKeywords.includes(keyword)){
      return res.status(200).json({status: false, message: 'Keyword already in use'});
    }
    return res.status(200).json({status: true, message: 'Keyword is available'});
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }

}

exports.updateSet = async (req, res) => {
  try {
    const { id } = req.params;
    req.body.StartingTime
    req.body.EndingTime
    const updatedSet = await SetModel.findByIdAndUpdate(id, req.body, { new: true });
    clearCache(dataKey)
    res.json(updatedSet);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getSetById = async (req, res) => {
  try {
    const { id } = req.params;
    const set = await SetModel.findById(id);
    res.json(set);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.deleteSet = async (req, res) => {
  try {
    const { id } = req.params;
    await SetModel.findByIdAndDelete(id);
    clearCache(dataKey)
    res.json({ message: 'Set deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateSetStatus = async (req, res) => {

  try {
    const { id } = req.params;
    const { status } = req.body;

    // Check if the new status is 'active'
    if (status === 'active') {
      // Find the currently active set and set it to pending
      await SetModel.updateMany({ isActive: true }, { $set: {status: 'pending', updatedAt: new Date()  } });
    }

    // Update the specified set
    const updatedSet = await SetModel.findByIdAndUpdate(id, { status , updatedAt: new Date()  }, { new: true });
    clearCache(dataKey)
    res.json(updatedSet);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getSetsList = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const sets = await SetModel.find()
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const count = await SetModel.countDocuments()
    return res.status(200).json({data:sets, total: count});
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getFile = async (req, res) => {
  try {
    const FileData = await File.findById(req.params.id);
    res.status(200).send({ data: FileData });
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch file', error: error.message });
  }
};

exports.listAllFiles = async (req, res) => {
  try {
    const { page = 1, limit = 10} = req.query;
    const sets = await File.find({isDeleted:false, uploadedBy: req.user.userId})
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const count = await File.countDocuments({isDeleted:false, uploadedBy: req.user.userId})
    return res.status(200).json({data:sets, total: count});
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.uploadFile = async (req, res) => {
  const { originalname, mimetype, buffer, path } = req.file;
  const json = req.body.json ? JSON.parse(req.body.json) : []; // Assuming JSON is sent as a stringified array in the form field 'json'
  console.log('json', json)
  try {
    const newFile = new File({
      filename: originalname,
      contentType: mimetype,
      url: path,
      json: json,
      startingKeyword: json[0].key,
      uploadedBy: req.user.userId
    });
    await newFile.save();
    res.status(201).send({ message: 'File uploaded successfully', fileId: newFile._id });
  } catch (error) {
    res.status(400).send({ message: 'Failed to upload file', error: error.message });
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const deletedFile = await File.findByIdAndDelete(fileId);
    if (!deletedFile) {
      return res.status(404).send({ message: 'File not found' });
    }
    fs.unlink(deletedFile.url, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
      } else {
        console.log('File deleted successfully');
      }
    });
    res.status(200).send({ message: 'File deleted successfully', data: deletedFile });
  } catch (error) {
    res.status(500).send({ message: 'Failed to delete file', error: error.message });
  }
};

exports.updateFileStatus = async (req, res) => {
  try {
    const fileId = req.params.id;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).send({ message: 'Status is required' });
    }

    const updatedFile = await File.findByIdAndUpdate(fileId, { status }, { new: true });
    if (!updatedFile) {
      return res.status(404).send({ message: 'File not found' });
    }
    
    res.status(200).send({ message: 'File status updated successfully', data: updatedFile });
  } catch (error) {
    res.status(500).send({ message: 'Failed to update file status', error: error.message });
  }
};

exports.uploadImages = async (req, res) => {
  if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded.' });
  }

  try {
      const imageDocs = req.files.map(file => ({
          keyName: file.filename.split('.')[0]?.toLowerCase(),
          imageName: file.originalname,
          imageType: file.mimetype,
          imageUrl: file.path  // Assuming you serve static files, adjust URL accordingly
      }));

        // Prepare new image collection document data
        const newImageData = {
          fileId: req.params.fileId,
          images: imageDocs,
          uploadedBy: req.user.userId  // Assuming 'req.user.userId' is set from `authenticateToken`
      };
            // Find an existing document with the same fileId and replace it, or insert a new one if it does not exist
      const options = { upsert: true, new: true, runValidators: true };
      const imageCollection = await Images.findOneAndReplace({ fileId: req.params.fileId }, newImageData, options);

      res.status(201).json({
          message: 'Images uploaded and saved successfully.',
          imageCollection
      });
  } catch (error) {
      res.status(500).json({ message: 'Failed to upload images.', error: error.message });
  }
};

exports.getAllImages = async (req, res) => {
  const fileId = req.params.fileId;
  try {
    // Find the image collection document based on fileId
    const imageCollection = await Images.findOne({ fileId });

    if (!imageCollection) {
      return res.status(404).json({ message: 'No images found for the provided fileId.' });
    }

    res.status(200).json({
      message: 'Images retrieved successfully.',
      images: imageCollection.images
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve images.', error: error.message });
  }
}

exports.uploadImageById = async (req, res) => {
  if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded.' });
  }

  const fileId = req.params.fileId; // This should be the '_id' of the ImageCollection
  const imageId = req.params.ImageId; // Extract imageId from query params

  try {
      const fileData = {
          keyName: req.file.filename,
          imageName: req.file.originalname,
          imageType: req.file.mimetype,
          imageUrl: req.file.path  // Adjust URL as necessary
      };

      let updatedCollection;

      if (imageId) {
          // Update existing image within the images array
          updatedCollection = await Images.findOneAndUpdate(
              { fileId, 'images._id': imageId },
              { $set: { 'images.$': fileData } },
              { new: true }
          );
      } else {
          // Push new image to the images array
          updatedCollection = await Images.findByIdAndUpdate(
              fileId,
              { $push: { images: fileData } },
              { new: true }
          );
      }

      if (!updatedCollection) {
          return res.status(404).json({ message: 'Image collection not found.' });
      }

      res.status(200).json({
          message: imageId ? 'Image updated successfully.' : 'Image uploaded and added to collection successfully.',
          updatedCollection
      });
  } catch (error) {
      res.status(500).json({ message: 'Failed to upload/update image.', error: error.message });
  }
};

exports.createChatConfig = async (req, res) => {
  try {
    const createdBy = req.user.userId;
    let chatForm = await chatConfig.findOne({ createdBy });

    if (!chatForm) {
        // If no chat form exists for the user, create a new one
        chatForm = new chatConfig({ ...req.body, createdBy });
        await chatForm.save();
        res.status(201).json(chatForm);
    } else {
        // If a chat form already exists, update it
        chatForm = await chatConfig.findOneAndUpdate({ createdBy }, req.body, { new: true });
        res.json(chatForm);
    }
} catch (error) {
    return res.status(400).json({ message: error.message });
}

}
exports.getChatConfig = async (req, res)=>{
  try {
    const createdBy = req.user.userId;
    let chatForm = await chatConfig.findOne({ createdBy });
    return res.status(201).json({data: chatForm});

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}