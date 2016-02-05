#About

This is the AWS lambda function used with AWS API Gateway and S3 to create an image rewriting / caching service. The idea is for urls of the following form:

`/imageservice/200/200/mypic_timestamp.jpg`

will be saved as `mypic_timestamp/200_200.jpg` in an s3 bucket, with this lambda function handling the creation and uploading of the new images to s3 on demand. 

#API

This lambda function is designed to be used with AWS API Gateway and as such, is a little strange. In order to allow for HTTP return codes to work, it will only use `context.fail` to generate the final output.

There are 3 possible outputs:
* - `context.fail("http://path/to/s3/img")` The desired image already exists or was generated, meant to be used in a `Location` header for a `status code 301` or `status code 302` 
* - `context.fail("BadRequest")` The request was malformed (ie `status code 400`) 
* - `context.fail("NotFound")` The source image does not exist / was never uploaded. (ie `status code 404`)

#Helpful Links
https://rpgreen.wordpress.com/2016/01/04/how-to-http-redirects-with-api-gateway-and-lambda/
http://www.jayway.com/2015/11/07/error-handling-in-api-gateway-and-aws-lambda/
