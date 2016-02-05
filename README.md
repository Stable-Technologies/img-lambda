#About

This is the AWS lambda function used with AWS API Gateway and S3 to create an image rewriting / caching service. The idea is for urls of the following form:

`/imageservice/200/200/mypic_timestamp.jpg`

will be saved as `mypic_timestamp/200_200.jpg` in an s3 bucket, with this lambda function handling the creation and uploading of the new images to s3 on demand. 

#API

This lambda function is designed to be used with AWS API Gateway and as such, is a little strange. In order to allow for HTTP return codes to work, it will only use `context.fail` to generate the final output.

There are 3 possible outputs:
* `context.fail("http://path/to/s3/img")` The desired image already exists or was generated, meant to be used in a `Location` header for a `status code 301` or `status code 302` 
* `context.fail("BadRequest")` The request was malformed (ie `status code 400`) 
* `context.fail("NotFound")` The source image does not exist / was never uploaded. (ie `status code 404`)

possible optional query string parameters:
* `q` quality, 0-100 (defaults to 100)
* `bg` a background color to use if a transparent png is being converted to a jpg. (defaults to white)

# Notes on Setting Up AWS API Gateway

## Models

### ConvertInputModel
Used in a `Integration Request` mapping template to transform HTTP parameters into JSON for the lambda function.
```
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "title": "ConvertInputModel",
  "type": "object",
  "properties": {
    "source": {"type":"string"},
    "width": {"type":"integer"},
    "height": {"type":"integer"},
    "bucket": {"type": "string"},
    "querystring": {
      "type":"object"
    }
  }
}
```

## Method Request
Add query string `q` and `bg`. These control the optional values for quality (0-100) and background color.

## Integration Request

Add the following Mapping Template, model is "ConvertInputModel" as defined above (`application/json`):
```
#set($inputRoot = $input.path('$'))
{
  "source" : "$input.params('source')",
  "width" : $input.params('width'),
  "height" : $input.params('height'),
  "bucket" : "roceteer-dev-app",
  "querystring": {
    #foreach($param in $input.params().querystring.keySet())
      "$param": "$util.escapeJavaScript($input.params().querystring.get($param))" #if($foreach.hasNext),#end
    #end
  }
}
```

## Method Responses
In the `GET` method:

Add `400`, `302` and `404`, leave `200` alone.

To each of the added HTTP Status codes (not including `200`), add the following headers:
* `Access-Control-Allow-Headers`
* `Access-Control-Allow-Origin`
* `Access-Control-Allow-Methods`

In addition, to `302` add the following header:
* `Location`

Don't add a `Response Model` to any of them.

## Integration Response

Add the following `Lambda Error Regex -> Method response status` (leave the "Default Mapping" / `200` entry alone)

* `BadRequest` -> `400`
* `http.*` -> `302`
* `NotFound` -> `404`

Mapping values:
* `Access-Control-Allow-Headers` -> `'*'`
* `Access-Control-Allow-Methods` -> `'GET,OPTIONS'`
* `Access-Control-Allow-Origin` -> `'*'`

In addition, for `302`:
* Location -> `integration.response.body.errorMessage`

## Enable CORS
Make sure CORS is enabled (ie there is an OPTIONS method)

#Helpful Links
https://rpgreen.wordpress.com/2016/01/04/how-to-http-redirects-with-api-gateway-and-lambda/
http://www.jayway.com/2015/11/07/error-handling-in-api-gateway-and-aws-lambda/
