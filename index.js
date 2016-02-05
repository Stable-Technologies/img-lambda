// dependencies
var gm      = require('gm').subClass({ imageMagick: true }) // Enable ImageMagick integration.
  , async   = require('async')
  , AWS     = require('aws-sdk');
    
var s3 = new AWS.S3();

var validImageTypes = ['png', 'jpg', 'jpeg', 'gif'];

function validBg(input) {
  var reg = /[^A-Za-z0-9#]/;
  if(input.length <= 10 && !reg.test(input)) {
    return true;
  } else {
    return false;
  }
}

var attemptConvert = function(originalKey, wantKey, imgReq, imageType, context, quality,bg) {
  async.waterfall([
    function download(next) {
      // Download the image from S3 into a buffer.
      s3.getObject({
        Bucket : imgReq.bucket,
        Key    : originalKey
      }, next);
    },
    function convert(response, next) {
      var checkStripAlpha = function(img) {
        if(imageType === 'jpg' || imageType === 'jpeg') {
          return img.background(bg).alpha('remove')
        } else {
          return img
        }
      };
      gm(response.Body).size(function(err, size) {
        // Transform the image buffer in memory.
        var img = this
          .resize(imgReq.width, imgReq.height)
          .quality(quality)
          .noProfile();
        checkStripAlpha(img).toBuffer(imageType, function(err, buffer) {
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
      context.fail(s3.endpoint.href+imgReq.bucket+"/"+wantKey);
    }
  ],
  function (err) {
    context.fail("NotFound");
  });
};

exports.handler = function(imgReq, context) {
  if( imgReq.source == null ||
      imgReq.querystring == null ||
      imgReq.width == null ||
      imgReq.height == null ||
      imgReq.bucket == null) {
    console.log("Required Parameters are missing!");
    context.fail("BadRequest");
  }
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

  //figure out what the s3 url would be
  var quality = ('q' in imgReq.querystring) ?  Math.min(100,Math.max(0,parseInt(imgReq.querystring.q))) : 100;
  var bg = ('bg' in imgReq.querystring && validBg(imgReq.querystring.bg)) ? imgReq.querystring.bg : 'white';
  var bgPath = ""
  if((imageType === "jpg" || imageType === "jpeg") && bg !== 'white') { bgPath = "bg_"+bg; }
  var sourceRoot = imgReq.source.slice(0,-(imageType.length+1));
  var wantKey = sourceRoot + "/" + imgReq.width + "_" + imgReq.height + "q" + quality + bgPath + "." + imageType;

  //Check if the image already exists
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
    attemptConvert(originalKey,wantKey,imgReq,imageType,context,quality,bg);
  });
};