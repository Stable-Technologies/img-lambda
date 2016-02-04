// dependencies
var   gm      = require('gm').subClass({ imageMagick: true }) // Enable ImageMagick integration.
    , async   = require('async')
    , AWS     = require('aws-sdk');
    
var s3 = new AWS.S3();

var transform = function(masterKey, wantKey, srcBucket, imageType, context, width, height) {
  async.waterfall([
    function download(next) {
      // Download the image from S3 into a buffer.
      s3.getObject({
        Bucket : srcBucket,
        Key    : masterKey
      }, next);
    },
    function tranform(response, next) {
      gm(response.Body).size(function(err, size) {
        // Transform the image buffer in memory.
        this.resize(width, height)
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
        Bucket      : srcBucket,
        Key         : wantKey,
        ACL         : 'public-read',
        Body        : data,
        ContentType : contentType
      }, next);
    },
    function wat(response,next) { 
      context.fail(s3.endpoint.href+srcBucket+"/"+wantKey);
    }
  ],
  function (err) { 
    console.log("Unable to resize!",err);
    context.fail("NotFound");
  });
};

exports.handler = function(imgReq, context) {
    var srcBucket = "roceteer-dev-app"
    var srcKey = imgReq.source;

    var typeMatch = srcKey.match(/\.([^.]*)$/);

    if(!typeMatch) {
      context.fail("BadRequest");
      return;
    }

    var validImageTypes = ['png', 'jpg', 'jpeg', 'gif'];

    var imageType = typeMatch[1];
    if (validImageTypes.indexOf(imageType.toLowerCase()) < 0) {
      console.log('Invalid Image type requested ' + srcKey);
      context.fail("BadRequest");
      return;
    }

    var sourceBase = srcKey.slice(0,-4);

    var wantKey = sourceBase + "/" + imgReq.width + "_" + imgReq.height + "." + imageType;

    console.log("WANT TO LOAD: " + wantKey);

    async.waterfall([
        function check(next) {
	    // Download the image from S3 into a buffer.
	    s3.headObject({
              Bucket : srcBucket,
	      Key    : wantKey
            }, next);
        },
        function wat(response,next) {
          context.fail(s3.endpoint.href+srcBucket+"/"+wantKey);
        }
    ],
    function(err) {
      var originalKey = sourceBase + "/" + "original";
      transform(originalKey,wantKey,srcBucket,imageType,context,imgReq.width,imgReq.height);
    });    
    //if(imgReq.height === 42) {
    //    context.fail("Bad")
    //} else {
    //    context.fail("NotFound")
    //}
    //context.succeed({location : "http://example.com"})
};
