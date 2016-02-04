// dependencies
var gm      = require('gm').subClass({ imageMagick: true }) // Enable ImageMagick integration.
  , async   = require('async')
  , AWS     = require('aws-sdk');
    
var s3 = new AWS.S3();

var validImageTypes = ['png', 'jpg', 'jpeg', 'gif'];

var attemptConvert = function(originalKey, wantKey, imgReq, imageType, context) {
  async.waterfall([
    function download(next) {
      // Download the image from S3 into a buffer.
      s3.getObject({
        Bucket : imgReq.bucket,
        Key    : originalKey
      }, next);
    },
    function convert(response, next) {
      gm(response.Body).size(function(err, size) {
        // Transform the image buffer in memory.
        this.resize(imgReq.width, imgReq.height)
          .toBuffer(imageType, function(err, buffer) {
            if (err) {
              next(err);
            } else {
              next(null, response.ContentType, buffer);
            }
          });
      });
    },
    function upload(contentType, data, next) {
      // Stream the transformed image to a different S3 bucket.
      s3.putObject({
        Bucket      : imgReq.bucket,
        Key         : wantKey,
        ACL         : 'public-read',
        Body        : data,
        ContentType : contentType
      }, next);
    },
    function success(response,next) {
      console.log("???????????")
      console.log(response)
      context.fail(s3.endpoint.href+imgReq.bucket+"/"+wantKey);
    }
  ],
  function (err) { 
    context.fail("NotFound");
  });
};

exports.handler = function(imgReq, context) {
  var typeMatch = imgReq.source.match(/\.([^.]*)$/);
  if(!typeMatch) {
    console.log('Invalid Image Type Requested')
    context.fail("BadRequest");
    return;
  }

  var imageType = typeMatch[1];
  if (validImageTypes.indexOf(imageType.toLowerCase()) < 0) {
    console.log('Invalid Image type requested ' + imgReq.source);
    context.fail("BadRequest");
    return;
  }

  var sourceRoot = imgReq.source.slice(0,-(imageType.length+1));
  var wantKey = sourceRoot + "/" + imgReq.width + "_" + imgReq.height + "." + imageType;
  async.waterfall([
    function check(next) {
      // Download the image from S3 into a buffer.
      s3.headObject({
        Bucket : imgReq.bucket,
        Key    : wantKey
      }, next);
    },
    function exists(response,next) {
      context.fail(s3.endpoint.href+imgReq.bucket+"/"+wantKey);
    }
  ],
  function(err) {
    var originalKey = sourceRoot + "/" + "original";
    attemptConvert(originalKey,wantKey,imgReq,imageType,context);
  });
};